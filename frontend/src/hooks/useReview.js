import { useCallback, useReducer, useRef } from "react";
import { ApiError, streamReview } from "@/lib/api";

const initial = {
  status: "idle", // idle | running | done | error
  mode: null,
  startedAt: 0,
  providers: {},
  partial: {},
  final: null,
  error: null,
  reviewedCode: "",
  cached: false,
};

function reducer(state, action) {
  switch (action.type) {
    case "begin":
      return {
        ...initial,
        status: "running",
        mode: action.mode,
        startedAt: Date.now(),
        reviewedCode: action.code,
      };
    case "start":
      if (action.data.cached) return { ...state, cached: true };
      return {
        ...state,
        providers: Object.fromEntries(
          action.data.plan.map((p) => [
            p.provider,
            { state: p.role === "fallback" ? "standby" : "queued", since: Date.now() },
          ]),
        ),
      };
    case "status": {
      const { provider, state: s, model, message, details } = action.data;
      const prev = state.providers[provider] ?? {};
      return {
        ...state,
        providers: {
          ...state.providers,
          [provider]: {
            ...prev,
            state: s,
            model: model ?? prev.model,
            message,
            details,
            since: s === "running" ? Date.now() : prev.since,
          },
        },
      };
    }
    case "result": {
      const { provider, model, durationMs, review } = action.data;
      return {
        ...state,
        partial: {
          ...state.partial,
          [provider]: {
            ...review,
            issues: review.issues.map((i, n) => ({ ...i, id: `${provider}-${n}`, confirmed: false })),
          },
        },
        providers: {
          ...state.providers,
          [provider]: { state: "done", model, durationMs, issueCount: review.issues.length },
        },
      };
    }
    case "final":
      return {
        ...state,
        status: "done",
        final: action.data,
        cached: action.data.cached,
        providers: Object.fromEntries(action.data.providers.map((p) => [p.provider, p])),
      };
    case "error":
      return { ...state, status: "error", error: action.error };
    case "cancel":
      // Keep anything that already arrived; a Groq result is still useful
      // even if the user stopped waiting for Gemini.
      return { ...state, status: Object.keys(state.partial).length ? "done" : "idle", cancelled: true };
    default:
      return state;
  }
}

export function useReview() {
  const [state, dispatch] = useReducer(reducer, initial);
  const controller = useRef(null);

  const run = useCallback(async (payload) => {
    controller.current?.abort();
    const ac = new AbortController();
    controller.current = ac;
    dispatch({ type: "begin", mode: payload.mode, code: payload.code });
    try {
      await streamReview(payload, {
        signal: ac.signal,
        onEvent: (type, data) => {
          if (["start", "status", "result", "final"].includes(type)) dispatch({ type, data });
        },
      });
    } catch (err) {
      if (ac.signal.aborted) return;
      const error =
        err instanceof ApiError
          ? { message: err.message, details: err.details, status: err.status }
          : { message: "Could not reach the review server. Check your connection and try again." };
      dispatch({ type: "error", error });
    } finally {
      if (controller.current === ac) controller.current = null;
    }
  }, []);

  const cancel = useCallback(() => {
    controller.current?.abort();
    controller.current = null;
    dispatch({ type: "cancel" });
  }, []);

  // What to show: the merged final review, or the latest provider result
  // while the other provider is still working.
  const partials = Object.values(state.partial);
  const review = state.final?.review ?? partials.at(-1) ?? null;

  return { ...state, review, run, cancel };
}

// API client. Same-origin by default (the Express server serves this app in
// production, and Vite proxies /api in development). Set VITE_API_URL only
// when the API is deployed on a different domain.
const BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

export class ApiError extends Error {
  constructor(message, { status, details } = {}) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

async function readError(res) {
  try {
    const body = await res.json();
    return new ApiError(body.error ?? `Request failed (${res.status})`, {
      status: res.status,
      details: body.details,
    });
  } catch {
    return new ApiError(`Request failed (${res.status})`, { status: res.status });
  }
}

export async function fetchMeta(signal) {
  const res = await fetch(`${BASE}/api/meta`, { signal });
  if (!res.ok) throw await readError(res);
  return res.json();
}

/**
 * Starts a review and reports Server-Sent Events as they arrive:
 * start, status, result (one per provider), final, error.
 * Resolves with the final payload.
 */
export async function streamReview(payload, { signal, onEvent }) {
  const res = await fetch(`${BASE}/api/review`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify(payload),
    signal,
  });
  if (!res.ok) throw await readError(res);

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  let final = null;

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;

    let boundary;
    while ((boundary = buffer.indexOf("\n\n")) !== -1) {
      const block = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      if (!block || block.startsWith(":")) continue; // heartbeat

      let event = "message";
      let data = "";
      for (const line of block.split("\n")) {
        if (line.startsWith("event: ")) event = line.slice(7);
        else if (line.startsWith("data: ")) data += line.slice(6);
      }
      const parsed = data ? JSON.parse(data) : {};

      if (event === "error") {
        throw new ApiError(parsed.message, { status: parsed.status, details: parsed.details });
      }
      if (event === "final") final = parsed;
      onEvent?.(event, parsed);
    }
  }

  if (!final) throw new ApiError("The connection closed before the review finished.");
  return final;
}

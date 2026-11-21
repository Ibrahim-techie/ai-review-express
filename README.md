# AI Review

Code review from two independent models, Groq and Gemini, with every finding
pinned to its line in the editor and a corrected version you can apply in one
step. Express API plus a React (Vite, Tailwind v4, ChaiUI, Monaco) frontend,
deployable as a single service.

## What it does

- **Three modes**
  - **Quick**: Groq only, usually back in a few seconds.
  - **Cross-check** (default): Groq and Gemini review in parallel. Findings
    both models report are merged and marked "Both models", which is the
    strongest signal two free models can give.
  - **Deep**: Gemini's strongest free model (`gemini-4-hydrogen`) with high
    thinking; Groq is the fallback.
- **Structured findings**: severity, category, exact lines, explanation and
  a suggested fix, shown as marks beside the line numbers in the editor.
- **Changes tab**: a diff of the corrected file; Apply writes it into the
  editor as one undoable edit.
- **Live progress** over Server-Sent Events: Groq's result appears as soon
  as it lands, while Gemini is still working.
- Focus areas, notes for the reviewer, open file, copy review as Markdown,
  light and dark themes, keyboard shortcut (Ctrl/Cmd + Enter).

## How the free tiers are used

| | Groq | Gemini |
|---|---|---|
| Models | `openai/gpt-oss-120b`, `qwen/qwen3.8-27b`, `openai/gpt-oss-20b` | `gemini-3.8-flash`, `3.6-flash`, `3.5-flash`, `3.5-flash-lite`; deep: `gemini-4-hydrogen` |
| Strength | Sub-second to a few seconds | 1M-token context, strongest free reasoning |
| Free-tier limit that matters | 8K tokens/minute per model | Congestion: 503 "high demand" and slow queues |

What the server does about it:

- **Model rotation.** Each Groq model has its own quota, so a 429 on one
  moves to the next instead of failing.
- **Token budgeting.** Groq rejects any request whose input plus
  `max_completion_tokens` exceeds 8K/min, so the server sizes the completion
  budget per request and sends large files to Gemini only.
- **Fallback chains with timeouts.** Each Gemini model gets a bounded
  attempt and the whole chain has a time budget; the slow deep model is the
  only one allowed a long timeout.
- **Structured output.** Strict JSON schema on Groq (constrained decoding)
  and `responseJsonSchema` on Gemini; the server still validates and clamps
  everything (enums, line ranges, list sizes).
- **Calibrated scores.** Model scores vary run to run, so the worst finding
  caps the score (critical 39, high 69, medium 89).
- **Caching.** Identical requests are answered from an in-memory LRU cache
  for an hour. Degraded results (one provider failed) are not cached.
- **Rate limiting** per IP (6/minute, 150/day by default) so one visitor
  can't use up the shared quota.

Grounding with Google Search is not available on the Gemini free tier for
Gemini 3 and newer, so it is not used.

## Run locally

Requires Node 20.12 or newer.

```bash
npm install
npm --prefix frontend install
cp .env.example .env   # add GROQ_API_KEY and/or GEMINI_API_KEY

npm run dev            # API on http://localhost:3000
npm run dev:web        # UI on http://localhost:5173 (proxies /api to :3000)
npm test               # unit tests (no API calls)
```

## Deploy

The production build is one service: Express serves the API and the built
frontend from the same origin, so no CORS or API URL configuration is needed.

**Render (blueprint):** push the repo, then in Render choose New, Blueprint
and select it. `render.yaml` defines the service; you'll be asked for
`GROQ_API_KEY` and `GEMINI_API_KEY`. Health check: `/healthz`. Note that the
free plan sleeps after inactivity, so the first request can take a while.

**Any Node host:**

```bash
npm ci --omit=dev && npm run build
NODE_ENV=production npm start
```

**Docker:**

```bash
docker build -t ai-review .
docker run -p 3000:3000 -e GROQ_API_KEY=... -e GEMINI_API_KEY=... ai-review
```

**Frontend and API on different domains** (for example Vercel plus Render):
build the frontend with `VITE_API_URL=https://your-api.example.com`, and set
`CORS_ORIGIN=https://your-frontend.example.com` on the API.

All settings are listed in [`.env.example`](.env.example).

## API

`POST /api/review`

```json
{
  "code": "function add(a, b) { return a - b }",
  "language": "javascript",
  "mode": "crosscheck",
  "focus": ["bugs", "security"],
  "context": "optional notes for the reviewer"
}
```

- With `Accept: text/event-stream` the response streams events: `start`,
  `status` (per provider: running, retrying, failed, skipped), `result` (one
  per provider), then `final` or `error`.
- Otherwise it responds once with the `final` payload:
  `{ review, mode, providers, cached, durationMs }`, where `review` has
  `summary`, `score`, `language`, `issues[]`, `strengths[]` and
  `improvedCode`.

```bash
curl -s localhost:3000/api/review -H "Content-Type: application/json" \
  -d '{"code":"eval(userInput)","mode":"quick"}'
```

`GET /api/meta` returns configured providers, models and limits.
`GET /healthz` is the health check.

## Project layout

```
src/
  server.js, app.js, config.js     bootstrap, middleware, validated config
  Client/                          Groq and Gemini SDK clients
  services/
    review.service.js              mode planning, parallel runs, merge, cache
    groq.provider.js               token budgeting, strict JSON schema
    gemini.provider.js             thinking levels, JSON schema
    modelChain.js                  per-model fallback with timeouts
    review.schema.js / .prompt.js  schema, normalizing, prompts
    review.merge.js                cross-check matching
  middleware/, validation/, routes/, controllers/, utils/
test/                              node:test unit tests
frontend/                          React app (ChaiUI components in src/components/ui)
```

## Security notes

- API keys are read from the environment only. Never commit `.env`.
- Code is sent to Groq and Google. On the free tier Google may use submitted
  content to improve its models, which the UI says in its footer.
- Model output is treated as untrusted: the prompt fences user input, the
  server validates the JSON, Markdown is sanitized, and code snippets are
  escaped by Monaco's tokenizer.
- Helmet sets a strict Content-Security-Policy (`script-src 'self'`). Monaco
  and fonts are self-hosted, so the page loads nothing from third parties.

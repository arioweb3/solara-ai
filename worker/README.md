# Optional AI Worker

This Worker is an optional proxy for an OpenAI-compatible chat-completions API. The endpoint URL and payload format must match your chosen provider.

Set these in the Cloudflare Worker settings:
- `AI_API_KEY` as a **secret**, not a plain committed value.
- `AI_API_URL` as a variable (for example, the provider's chat completions endpoint).
- `AI_MODEL` as a variable.
- `ALLOWED_ORIGIN` as the exact deployed website origin (no trailing slash), e.g. `https://arioweb3.github.io`.

Then add this before `app.js` in `index.html`:
```html
<script>window.SOLARA_AI_ENDPOINT = "https://your-worker.workers.dev";</script>
```

Review provider terms, usage costs, rate limiting, and privacy before enabling. Add stricter rate limiting before public production use.

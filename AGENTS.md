# AGENTS.md

Same rules as the global instructions, plus what is specific to this repo.

## What this is

A phone-first English look-up app: a Vue 3 + Reka UI SPA (`src/`) served by a small Express server
(`server/`) that proxies streaming chat completions to OpenRouter. The API key stays on the PC.

## Commands

```bash
npm run dev        # vite :5180 (proxies /api, /auth to :8787) + server :8787, watch mode
npm run build      # vue-tsc + tsc --noEmit, then vite build into dist/
npm start          # serve dist/ + API from one process (what the phone talks to)
npm run typecheck  # both project references, no output
npm run icons      # regenerate PWA icons from design/icon-1024.png
```

The nginx vhost for the desktop alias (`http://translator.localhost`, port 80 → 8787) is versioned as
`deploy/nginx-translator.localhost.conf`; the live copy is `/etc/nginx/sites-enabled/translator.localhost`
and every `*.localhost` name is also listed on the landing page at `http://localhost/`
(`/var/www/localhost/index.html`) — update both places together.
`proxy_buffering off` there is required for SSE, and its loopback ACL is what stops a LAN client from
reading the pairing token through the proxy.

Always run `npm run typecheck` (or `npm run build`) before saying a change works — the SPA and the
server are separate TS projects (`tsconfig.app.json`, `tsconfig.server.json`).

## Layout

- `src/components/` — `LookupView` (phone app), `PairScreen` (PC, shows the QR), `ResultCard`,
  `HistorySheet`, `SettingsSheet`.
- `src/lib/` — markdown rendering, settings/history persistence, display mode, wake lock, speech,
  toasts, language table.
- `server/` — `config.ts` (load/merge/persist), `auth.ts` (cookie + device tracking),
  `openrouter.ts` (SSE client), `prompt.ts` (the dictionary prompt), `index.ts` (routes).

## Things that bite

- **`config.json` is runtime state, not source.** It is git-ignored, generated on first start, and
  the auth token is written back into it. `config.example.json` is the committed template — keep the
  two in sync when adding keys.
- **Scoped CSS does not reach Reka's Select content or viewport.** Style them with `:deep()`.
- **Never portal a Reka popover out of a modal Dialog** — the dialog's pointer-events lock makes it
  untappable. `SelectPortal disabled` keeps it inside.
- **`req.on('close')` fires once the request body is read** on modern Node, which would abort every
  look-up immediately. Watch `res.on('close')` and check `res.writableEnded` instead.
- **The pairing page is loopback-only** unless `auth.allowRemotePairing` is set; the QR contains the
  token, so do not loosen that casually.
- The phone UI is deliberately pitch black; do not introduce elevated greys or accent colours beyond
  the ones in `src/style.css`.

## Testing a look-up without spending money

Point `openrouter.baseUrl` at any OpenAI-compatible SSE endpoint (a throwaway mock is enough) and set
`openrouter.apiKey` to a dummy value. Then `npm run build && npm start`, open `http://localhost:8787`,
scan-pair with `?k=<token>`, and drive the UI with a headless browser.

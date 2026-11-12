# Duel game server

The Node side of Arena of Kits (`/game.html`). Architecture, protocol and match flow:
[docs/architecture/multiplayer.md](../docs/architecture/multiplayer.md).

| Command | |
|---|---|
| `npm run dev` | Vite + this server on 5173 (`/ws`) |
| `npm run build && npm run game:server` | standalone on 8787, serving `dist/` |
| `npm run test:server` | socket-level end-to-end test (temporary data files); `node server/smoke-test.mjs --shop` plays only the hero shop, the raid ranks and the week's boards |
| `SHOP=off` in the environment | the hero shop switched off: every hero is free (`pipeline/designs/hero-shop.md`) |
| `npm run cf:dev` / `npm run cf:deploy` | the Cloudflare version (`worker/index.mjs`, `wrangler.jsonc`) |

Accounts live in `server/data/accounts.json` (git-ignored), under `users`; beside them, under `meta`, the day the hero shop
arrived (every account from before it owns all the heroes there were) and the week's boards. Delete the file to start over.

## Test accounts

Created on this machine during the 2026-10-29 verification (local test values, not real credentials):

| Name | Password |
|---|---|
| `duelist_a` | `test-a-1234` |
| `duelist_b` | `test-b-1234` |
| `cf_duelist_a` | `test-cf-a-1234` (only in the local `npm run cf:dev` state, `.wrangler/`) |
| `cf_duelist_b` | `test-cf-b-1234` (same) |

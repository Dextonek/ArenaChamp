# Duel game server

The Node side of Arena of Kits (`/game.html`). Architecture, protocol and match flow:
[docs/architecture/multiplayer.md](../docs/architecture/multiplayer.md).

| Command | |
|---|---|
| `npm run dev` | Vite + this server on 5173 (`/ws`) |
| `npm run build && npm run game:server` | standalone on 8787, serving `dist/` |
| `npm run test:server` | socket-level end-to-end test (temporary data file) |
| `npm run cf:dev` / `npm run cf:deploy` | the Cloudflare version (`worker/index.mjs`, `wrangler.jsonc`) |

Accounts live in `server/data/accounts.json` (git-ignored). Delete the file to start over.

## Test accounts

Created on this machine during the 2026-10-29 verification (local test values, not real credentials):

| Name | Password |
|---|---|
| `duelist_a` | `test-a-1234` |
| `duelist_b` | `test-b-1234` |
| `cf_duelist_a` | `test-cf-a-1234` (only in the local `npm run cf:dev` state, `.wrangler/`) |
| `cf_duelist_b` | `test-cf-b-1234` (same) |

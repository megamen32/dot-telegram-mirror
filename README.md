# dot-telegram-mirror

A small adapter-based Telegram ↔ dot text mirror extracted from UserIO.
MIT licensed. **Experimental integration library**, not an official OpenAI or
Telegram product and not a turnkey hosted bot.

## Included
- Owner-scoped inbound admission and a persistent delivery journal.
- New visible user and assistant text mirrored with labels, stable receipts,
  restart deduplication and same-message edits.
- No history backfill on activation. Missing cursors pause rather than replay.
- Exact browser route, room and draft checks before submitting.
- Explicitly labelled reply context; experimental native reply support.
- An injected MCP browser transport and Telegram send/edit/context adapters.
- Offline tests and example. No credentials or account history.

## Limitations
**Images, files, albums and voice are not implemented in this release.**
Native replies are off by default: asynchronous panels need further live
verification; ambiguous targets are held for review, never guessed.
Secret filtering is conservative and incomplete, not a DLP guarantee.
A stable-text delay is heuristic, not proof that streaming has finished.
Only visible messages are observed. This is not a conversation export.
Queued/uncertain writes are intentionally not automatically replayed after restart.

This extraction has offline tests, but has **not replaced a live deployment**.
Preserve a working deployment until the replacement is verified on the intended
authorized account.

## Quick offline check
Requires Node.js 22+. No third-party runtime dependencies.

    npm test
    npm run demo

The demo uses invented IDs and fake adapters. It makes no network requests.

## Real integration
1. Copy .env.example to a private environment file. Set the exact owner ID,
   room ID and dot URL. Load it before imports, for example Node --env-file=.env.
2. Supply already-authorized Telegram and browser adapters. Never copy session
   keys or start a second Telegram client on another application's MTProto session.
3. Inject browserCall and Telegram send/edit/readReplyContext methods into
   createRuntime from src/runtime.mjs.
4. Pass verified incoming events to runtime.receive(event). Call runtime.tick()
   from your existing supervisor, typically every 15–30 seconds. Its first tick
   records a baseline and sends no old history.
5. Keep the journal private and persistent with one writer. Reconcile provider
   receipts against actual delivery, and stop on unknown writes.

See [adapter contracts](docs/ADAPTERS.md) and [security](SECURITY.md).
Never commit real bindings, journal data, credentials or messages.

## Browser and cloud portability
pageAction uses the visible web UI, not private authentication endpoints.
createDotBrowserCaller(call) takes an authorized MCP transport. There is no
embedded SSH connection or machine address. Its parser currently expects the
Chrome MCP textual tool-result format; other servers need an adapter.

A managed assistant browser is not automatically an unattended daemon. Cloud
operation requires a supported persistent scheduler, protected persistent state,
browser access from that scheduler and permitted network access to Telegram.
A logged-in browser alone does not establish those capabilities. No cookie
extraction, unsupported CDP discovery or credential copying is supported.

## Provenance
Extracted from [UserIO](https://github.com/megamen32/universal-userio), with
personal bindings and host-specific gateway removed. Original MIT notice is in
LICENSE, source hashes in docs/source-inventory.json. Clean Git history.
No UserIO server, enrollment, vault, board credentials or fleet config included.
Run npm run check:public before publishing. This is not a complete secret audit;
review the complete staged diff too.

# Adapter contracts

One owner and room per process. User-supplied text is never identity evidence.

## Incoming event
receive expects verified fields: accountId (telegram:<bot ID>), peerId,
senderId, private, out, isEdit, reconciliation, decimal messageId, nonempty
text and optional decimal replyTo. Groups and reconciliation are not admitted.
This release is text-only.

## Browser
browserCall supports dot_snapshot and dot_send. Snapshot returns
{ok,room,cursor,messages:[{id,role,text,reply_to}]}.
Submit reports submitted_unconfirmed; relay requires a later exact echo.
No retries after an uncertain submission.

createDotBrowserCaller(call) wraps an authorized Chrome MCP. call(tool,args)
returns the serialized JSON-RPC tool response. Only evaluate_script and bounded
list_pages recovery are used. Caller owns MCP authentication and timeouts.
Recovery requires a unique exact dot URL and verified room, never retries sends.
Managed browsers can supply a different adapter through their supported APIs.

## Telegram
- send(owner,text): literal text, no markup/link previews; return actual provider
  message ID, not a queue receipt.
- edit(owner,id,text,expectedHash): verify bot ownership, exact dialog and prior
  body, then edit and read back.
- readReplyContext(id): optional exact outgoing owner-dialog lookup, returning
  {id,out,peerId:{userId},message}. No read ACK or broad history scan.

Use existing authorized communications infrastructure. Core does not enroll
accounts, store passwords or provide a competing notification service.

## Persistence
One runtime per journal. IDs, hashes and receipts are private metadata.
The host supplies process lock, persistence, permissions and shutdown control.
No automatic service installation. Never run old and replacement consumers
concurrently.

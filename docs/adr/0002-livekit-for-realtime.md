# 2. LiveKit for realtime, from day one

Status: **Accepted** — 2026-08-27

## Context

Nexus is hosted on Vercel, so hosting realtime there was the obvious first
question. Vercel shipped native WebSocket support in public beta in June 2026,
but the constraints rule it out as a chat backbone:

- Connections are pinned to a single function instance.
- Capped at 5 minutes by default (30 in extended beta).
- No fan-out to other subscribers.
- Does not survive an instance restart.

Vercel's own knowledge base recommends a third-party realtime provider.

Separately, video and voice were named as likely future directions, and that
turns the realtime choice into an architectural one rather than a vendor one.

## Decision

LiveKit Cloud from day one, behind a `RealtimeTransport` port in
`@nexus/core`. Text messages travel on LiveKit's data channel.

## Rationale

The alternative was Ably now and LiveKit later. Choosing LiveKit immediately
avoids a migration whose cost lands exactly when the product is being handed to
a new team.

The decisive property is that a text conversation and a video call are _the
same object_ in LiveKit's model. A conversation is a room with two
participants. Today they hold `canPublishData`. For video they additionally
hold `canPublish` with `canPublishSources: [CAMERA, MICROPHONE]`. The matching
logic, the moderation, the audit trail, and the database schema are unchanged.

`Conversation.modality` and `capabilitiesFor(modality)` already exist and are
already persisted, so the seam is real rather than aspirational.

LiveKit Agents also gives the enablement sidebar and the judge a natural home
as room participants when those are built, which is worth having ready.

## Consequences

- Heavier infrastructure than a pure pub/sub provider for what is, today, text.
  Accepted deliberately in exchange for the video path.
- LiveKit is for **liveness only**. The database is the record. Realtime events
  carry an id and a timestamp, never content, and clients always refetch the
  transcript from the server — so a forged data packet cannot inject a message
  into anyone's view.
- Rooms cap at 2 participants at the transport layer, so a leaked token cannot
  be used to listen in on a conversation.
- `InMemoryTransport` exists for tests and local development, and the factory
  refuses to return it in production.

## Consequences for the client

Realtime is a nudge, not a delivery mechanism. A background poll runs
underneath it — 15 seconds while the socket is healthy, 3 seconds when it is
not. Seekers are frequently on unreliable mobile networks behind restrictive
middleboxes, and a dropped WebSocket must degrade to "slightly delayed" rather
than "the conversation appears to have stopped".

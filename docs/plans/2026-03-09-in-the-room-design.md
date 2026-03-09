# "In the Room" — Feature Design

*Approved design for the group conversation listening mode. Ready for implementation planning.*

---

## Brand Frame

The brand truth for this feature is already written: **"The right mind in the room — whenever you need it."**

A Sona is not a tool the subscriber activates. It is a presence they invite in. When the subscriber brings their Sona into a group conversation, the Sona is with them — listening, thinking, and speaking when it has something to offer. Nobody else in the room knows. The subscriber carries a trusted mind into any conversation, privately.

This is not a copilot. It is not a productivity feature. It is persistent presence made literal.

---

## Core Experience

The subscriber opens their existing Sona conversation and invites the Sona in. There is no new screen, no separate tool, no mode-switch that feels like launching software. The conversation they already have with their Sona is the interface — the Sona is simply also listening now.

The Sona hears the room through the subscriber's microphone. When the conversation moves into territory where that mind has something genuine to offer — expertise, perspective, a way of seeing the problem — it speaks. Quietly. Privately. In its own voice. The subscriber reads it when they choose to, acts on it or doesn't, and can turn to the Sona directly at any moment.

Nobody else in the room experiences this. The Sona is present only to the subscriber.

---

## Response Modes

The Sona operates in two distinct modes within a listening session, each requiring a different system prompt:

### 1. Listening Aside (proactive)
The Sona speaks when it has something to offer, based on what it is hearing. Cadence: every 90 seconds when the conversation is fast (>150 wpm), every 120 seconds when slower. The timer resets after a subscriber's direct query — the Sona does not speak unprompted immediately after being addressed directly.

The Sona uses its own judgment about whether to reference what triggered the thought or offer a broader observation — exactly as the real person would. The system prompt establishes this:

> *"You are present in a room, listening to a conversation. You are speaking privately to [subscriber name]. Respond as you would if you were physically there — sometimes you'll reference what you just heard, sometimes you'll offer a broader thought. Always be yourself. Keep your thoughts concise — you are leaning in, not holding the floor."*

### 2. Direct Address (subscriber-initiated)
The subscriber types to the Sona at any moment. The Sona responds in full voice, using the full session transcript as context alongside its knowledge base. The same chat API route handles this — with the group session's conversation ID and current transcript passed as additional context.

### 3. Active Participant (Phase 2 — not in scope for this build)
The Sona as a visible participant in a native Sona group room, speaking to the whole group. Requires a third system prompt variant. Designed separately.

---

## The Interface

### The conversation thread
The existing `ChatInterface` is the interface. No new screen.

**Thread history model:** In-room session content is visually sectioned within the thread using a temporal divider:

```
────────────────────────────────
  Elena joined the room · 2:14 PM
────────────────────────────────
```

This divider appears when the session starts and when it ends:

```
────────────────────────────────
  Elena left the room · 3:02 PM
────────────────────────────────
```

This maintains the single-surface principle while making it legible when the subscriber reviews the thread later. The divider uses `#b0b0b0` text, `0.6875rem`, and a `rgba(0,0,0,0.07)` horizontal rule — consistent with existing section label patterns.

### Presence indicator
At the top of the conversation, above the message list:

- A small animated coral dot (`#DE3E7B`, 7px, pulsing at 2.8s — calm, not urgent) followed by `[Name] is in the room` in Muted (`#6b6b6b`), `0.75rem` Geist Sans
- The entire row is a tappable/clickable target that toggles the inline controls disclosure
- Height fixed at 40px maximum on mobile

### Listening aside messages
Proactive Sona thoughts appear in the thread as messages, distinguished by:
- A `2px solid #DE3E7B` left border (inline style — Tailwind v4 constraint)
- `borderRadius: '0 20px 20px 0'` — flat left edge is load-bearing; it makes the border feel continuous, not decorative
- `backgroundColor: '#fafafa'`
- The Sona's name above the message in coral, `0.625rem`, uppercase, `0.1em` tracking
- No label, no badge, no category tag — the coral border is the only distinction needed

Direct address responses carry no special treatment — they are the conversation.

### Controls
Accessed by tapping the presence indicator row. An inline disclosure appears below it — no modal, no drawer, no overlay:

- **Step out for a moment** — pauses the WebSocket stream entirely (microphone capture stops; no audio sent to Deepgram; no contributions generated). The presence indicator shows `[Name] is stepped out` with a static `#b0b0b0` dot.
- **Leave the room** — ends the session, closes the WebSocket, discards the transcript, inserts the "left the room" divider. The conversation persists; the session is over.

On mobile, a **single-tap pause affordance** is exposed directly in the presence bar (a pause icon or the word "Pause" alongside the dot and name) — no need to open the controls disclosure for the most urgent action. This allows the subscriber to go silent instantly when sensitive content arises.

### Microphone state indicator
Anchored just above the chat input, replacing the existing red recording banner (which is suppressed in in-room mode):

- A 6px dot: coral + pulsing at 2.8s when listening; `#b0b0b0` + static when paused
- Label: `Listening` or `Paused` in Dim (`#b0b0b0`), `0.6875rem`
- No red. No alarm. The subscriber should feel accompanied, not surveilled.

### Input placeholder
In in-room mode the input placeholder changes from "Ask a question…" to "Say something to [Name]…" — direct address framing, not question framing.

---

## Architecture

### New infrastructure (three pieces)

**1. Streaming transcription**
The existing `/api/transcribe` handles discrete audio clips. In the Room requires continuous streaming. A new server route proxies a WebSocket connection to Deepgram's real-time streaming API. The subscriber's browser captures audio via MediaStream, streams chunks continuously, and receives a live rolling transcript. The transcript lives client-side — it is working memory for the session, not a stored record.

**2. Contribution trigger**
Client-side timer measures conversation pace (wpm over the last 60 seconds). When the timer fires:
- Check mutual exclusion guard: if a direct-address response is currently in-flight (streaming), discard this contribution — context will have moved on
- Check textarea guard: if the subscriber has unsent text in the input, delay until clear
- POST current transcript window to `/api/group-sessions/[id]/contribute`
- Server runs RAG retrieval against the transcript as the query
- Server builds listening-aside system prompt with transcript as room context
- Streams Sona response back; appears as aside message in thread
- Auto-scroll suppressed if textarea has focus or contains unsent text

**3. Group session management**
Tracks session lifecycle and links to the conversation thread.

### New API routes

```
POST   /api/group-sessions              — start session, create conversation, return session ID
POST   /api/group-sessions/[id]/contribute  — receive transcript window, run RAG, stream aside
PATCH  /api/group-sessions/[id]        — update status (paused / ended)
```

### Database schema

```sql
CREATE TABLE group_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscriber_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  portrait_id     UUID NOT NULL REFERENCES portraits(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  status          TEXT NOT NULL CHECK (status IN ('active', 'paused', 'ended')),
  mode            TEXT NOT NULL DEFAULT 'listening' CHECK (mode IN ('listening', 'active')),
  started_at      TIMESTAMPTZ DEFAULT now(),
  ended_at        TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE conversations
  ADD COLUMN group_session_id UUID REFERENCES group_sessions(id) ON DELETE SET NULL;
```

The raw audio transcript is **always ephemeral** — never stored. The Sona's thoughts (as conversation messages) persist naturally in the linked conversation.

Message provenance stored in existing `messages.metadata` JSONB — no schema change needed:
```json
{ "trigger": "proactive", "session_mode": "listening", "group_session_id": "..." }
```

### Component changes

- `MessageBubble` — add `variant: 'aside' | 'direct' | undefined` prop, driven by `msg.metadata?.trigger`
- `ChatInterface` — add session divider rendering, suppress auto-scroll when textarea focused, add `aria-live="polite"` to message list
- `ChatInput` — add in-room mode prop: suppresses red recording banner, changes placeholder
- New hook: `useGroupSession` — manages WebSocket lifecycle, transcript accumulation, pace detection, contribution timer, mutual exclusion guard

---

## Edge Cases

| Situation | Resolution |
|---|---|
| Proactive aside arrives while subscriber is typing | Aside inserted silently; auto-scroll suppressed if textarea has focus or unsent text |
| Direct-address response in-flight when contribution timer fires | Contribution discarded; timer resets |
| Microphone permission denied | Attempt permission before session starts; surface calm explanation: "Your microphone isn't available" — session does not start |
| Sensitive content / need to go silent instantly | Single-tap pause in presence bar suspends WebSocket immediately |
| Long session battery/data cost | "Step out" explicitly suspends WebSocket (not just suppresses output); subscriber controls when capture runs |

---

## Accessibility

- `aria-live="polite"` on the message list container — proactive insertions announced after current activity, not interrupting
- `role="log"` on the thread container
- `aria-atomic="false"` — screen readers announce incremental additions, not full thread re-reads
- TTS plays aside audio; screen reader announcement of same content would double-read — evaluate suppressing visual `aria-live` for TTS users or providing a preference
- Presence indicator row must be a `<button>` element for keyboard accessibility (Enter/Space to toggle controls)
- Microphone status `aria-label`: "Microphone active, listening to room" / "Microphone paused" — not just "Listening"
- `prefers-reduced-motion`: coral dot animation disabled, static dot shown instead

```css
@keyframes presence-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%       { opacity: 0.45; transform: scale(0.88); }
}

@media (prefers-reduced-motion: reduce) {
  .presence-dot { animation: none !important; }
}
```

---

## What Is Explicitly Out of Scope

- Transcript retention (always ephemeral — no subscriber option to save raw transcript)
- Active participant mode (Sona visible to whole group) — Phase 2, separate design
- External platform integrations (WhatsApp, Slack, Discord) — Phase 3
- TTS for aside messages (to be decided in implementation — the design accommodates either)

---

*Design approved: March 2026*
*Contributors: Product (founder), Brand Guardian, UX Researcher, UX Architect*

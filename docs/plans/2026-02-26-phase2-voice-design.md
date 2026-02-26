# Phase 2 — Voice Design

**Date:** 2026-02-26
**Status:** Approved
**Scope:** Voice input + TTS output for the Neural Heirloom chat interface. Video deferred to a later phase.

---

## Goals

- Users can speak to a Sona instead of typing
- The Sona responds in a natural voice (ElevenLabs), auto-played after each message
- The platform's trust/privacy ethic is enforced: users always know when the mic is active
- Architecture is modular so a unified voice endpoint (Option A) can be layered on later with minimal rework

---

## What We Are Not Building Yet

- Video avatar (HeyGen/Tavus)
- Ambient listening / VAD mode (designed for, not built)
- Sentence-level streaming TTS (Option C optimisation)
- Per-tier voice access gating (column reserved, not enforced)

---

## Database Schema

Two new columns on `portraits`:

```sql
ALTER TABLE portraits
  ADD COLUMN voice_enabled     BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN voice_provider_id TEXT;
```

- `voice_enabled` — admin toggles per Sona; users only see voice controls when this is true
- `voice_provider_id` — ElevenLabs voice clone ID; `NULL` means fall back to `ELEVENLABS_DEFAULT_VOICE_ID` env var

No new tables. Tier enforcement is portrait-level for now; a `min_voice_tier` column can be added when B2C subscriptions exist.

---

## API Endpoints

### `POST /api/transcribe`

| | |
|---|---|
| Auth | Required |
| Content-Type | `multipart/form-data` |
| Body | `audio` — blob (`audio/webm;codecs=opus`) |
| Returns | `{ transcript: string }` |

- Forwards audio to Deepgram Nova-2 pre-recorded endpoint
- Returns 400 if no audio provided, 500 on Deepgram error

### `POST /api/tts`

| | |
|---|---|
| Auth | Required |
| Body | `{ text: string, portrait_id: string }` |
| Returns | Streaming `audio/mpeg` |

- Looks up portrait's `voice_provider_id`; falls back to `ELEVENLABS_DEFAULT_VOICE_ID`
- Returns 403 if `portrait.voice_enabled = false`
- Proxies ElevenLabs streaming audio response — API key never reaches the client

### `POST /api/chat` (existing)

Unchanged. The transcript from `/api/transcribe` is passed here as a normal text message.

---

## Client-Side Architecture

### `useVoice` hook

Manages the recording lifecycle:

```
idle → recording → transcribing → idle
                         ↓
                       error
```

**Exports:**
- `status: 'idle' | 'recording' | 'transcribing'`
- `error: string | null`
- `startRecording(): void`
- `stopRecording(): Promise<string>` — stops recorder, POSTs blob to `/api/transcribe`, returns transcript

**Implementation notes:**
- `MediaRecorder` with `audio/webm;codecs=opus`
- `AnalyserNode` created alongside recorder to drive the waveform visualiser
- On transcript ready, caller passes text into existing `sendMessage` — `useChat` is untouched

### TTS playback

- Triggered automatically in `ChatInterface` after each assistant message completes (voice mode only)
- `HTMLAudioElement` with `src` set to a blob URL from the `/api/tts` response
- `AudioContext` initialised on first mic button press (satisfies browser autoplay policy)
- Manual replay available via speaker icon on each assistant message bubble
- Stop button cuts playback mid-stream

---

## UI

### Voice toggle

Mic icon button in `ChatInput`. Switches between text mode (textarea visible) and voice mode (textarea hidden, recording controls shown).

### Recording states

| State | Visual |
|---|---|
| Idle | Static mic icon, muted colour |
| Recording | Deep red, pulsing ring, live waveform (5–7 animated `div` bars via `AnalyserNode`) |
| Transcribing | Spinner, mic disabled |

### Privacy indicator

While recording: a non-dismissible banner at the top of the chat area reads **"Microphone active — tap to stop"** in a distinct colour. Disappears only when recording stops. Satisfies the platform's trust/privacy ethic regardless of mic button styling.

### Assistant message updates

- Speaker icon added to each assistant bubble
- Animates while audio is playing
- Stop button to cut playback

### Admin — Portrait editor

Two new fields on the Sona edit form:
- **Voice enabled** — boolean toggle
- **Voice ID** — text input for ElevenLabs voice clone ID (optional; leave blank for default)

---

## Environment Variables

```
DEEPGRAM_API_KEY
ELEVENLABS_API_KEY
ELEVENLABS_DEFAULT_VOICE_ID
```

---

## Future Migration Path

**Option A (unified endpoint):** Create `/api/voice-chat` that imports and composes the Deepgram and ElevenLabs logic from the separate modules built here. Client changes from 3 sequential fetches to 1. Existing endpoints remain for mobile. Estimated: ~1 day.

**Option C (sentence-streaming TTS):** Requires different streaming infrastructure on both server and client. Not a direct upgrade from Option B — treat as a new feature.

**Ambient listening / VAD mode:** `useVoice` is designed with a `mode` parameter in mind. VAD mode will use the same `AnalyserNode` infrastructure but trigger `startRecording`/`stopRecording` automatically based on silence thresholds.

# Proposal: Spotify polish and the MBTI Test redesign

Blackjack is out of scope and untouched.

## Spotify: what Spotify allows

- The official Embed IFrame API can `play`, `pause`, `togglePlay`, `seek`, and reports `playback_update` (`isPaused`, `position`, `duration`). It has **no option to hide the album art or title**.
- Spotify's Widget Terms require widgets to be shown "in the form made available by Spotify, without alteration" and forbid obfuscating them "in any way". So hiding the iframe and driving it from custom buttons, or covering its art and title, is off the table.
- `preview_url` audio is no longer available to new Web API apps, and streaming or proxying audio ourselves is not allowed.
- Adding to a playlist or queue needs the visitor's own Spotify login. There is no deep link that performs those actions; the Spotify app or web player offers them on the track page.

**Chosen design:** a compact control strip with no art or title:
- **Play:** loads Spotify's official compact player in place of the strip only when a visitor presses it, and starts playback through the IFrame API. While it plays, Spotify's own visible player shows progress, time and pause, as the terms require.
- **Length and position:** when idle, the strip shows the track length, which the API now returns. After the visitor has played the track, a thin bar shows the real last position.
- **Spotify link and ⋯ menu:** an "Open in Spotify" link, and a menu with:
  - Open in the Spotify app
  - Open in the web player
  - "Add to a playlist or queue in Spotify…" (opens the track where Spotify offers those actions)
  - Copy song link

Nothing is faked, and nothing acts on the owner's account. A side benefit is that the third-party iframe no longer loads on every home page visit.

Alternative, if you prefer: keep the official player always visible. That's simpler but repeats the art and title.

## MBTI Test

Superseded. The owner rejected the AI conversation and paid TTS plan that was here in favour of a free, client-side, scenario-based test. The shipped name is "MBTI-Inspired Personality Test". See `MBTI.md`.

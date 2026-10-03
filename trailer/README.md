# Glidepath trailer (35 s)

`glidepath-trailer.mp4` is a 35-second animated trailer, 1920×1080 at 30 fps with stereo AAC audio.
It contains no game footage or game assets. Every frame is drawn in `trailer.html` as vector motion
graphics, and the score is synthesised with Web Audio.

| Time | Beat |
| --- | --- |
| 0.0–3.2 | Sentinel radar feed: "Somewhere over the open sea", then it zooms in on GLIDEPATH 01 |
| 3.2–8.0 | Takeoff at dawn: **ONE RUNWAY.** |
| 8.0–13.4 | **A WHOLE WORLD.** The Dust Sea, Northreach, Mount Kaela |
| 13.4–20.6 | **THEY SHOOT BACK.** SAMs, flares, a lock and a kill. **SO DO YOU.** |
| 20.6–25.4 | AWACS command picture: **COMMAND THE SKY. CALL THE STRIKE.** (silo salvo) |
| 25.4–29.6 | Mach 1 vapour cone and sonic boom: **BREAK THE BARRIER.** |
| 29.6–35.0 | GLIDEPATH title card: Endless Flight |

- **Watch it live:** open `trailer.html` in a browser and press Play. It plays in real time with sound.
- **Re-render the video:** run `node render.js`. This needs Playwright's Chromium and `ffmpeg`.
  To get preview stills instead, run `node render.js stills 5 17 31`.

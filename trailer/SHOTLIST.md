# GLIDEPATH — "Weapons Free" · 35 s action trailer

A short combat film rendered in real 3D. It uses no game footage or game assets: the aircraft,
missiles, SAM site, island, ocean, sky and clouds are all built procedurally in `film.js`. The
picture is 2.39:1 scope inside a 1920×1080 frame at 30 fps, and the score is synthesised in `score.js`.

**Story:** Viper 1-1 and Viper 1-2 are ordered weapons free against four bandits and a SAM site.
They meet them head-on, survive a missile, and fight their way through. The film ends on a
sonic-boom hero pass and the title.

| # | Time | Shot | Camera | Action / FX | Sound |
|---|------|------|--------|-------------|-------|
| 1 | 0.0–2.6 | **Canopy dawn** | Dolly along the fuselage from the wing root to the nose | Low golden sun glints off the gold canopy above a sea of cumulus. Radio: *"Four bandits inbound. Weapons free."* | Drone, radio static, heartbeat |
| 2 | 2.6–4.6 | **Formation** | Telephoto pan from 340 m | Two jets cross the island mountains in echelon, bank toward the lens and light the afterburners | BRAAM, afterburner kick |
| 3 | 4.6–6.2 | **Bandits** | Low, looking up | Three dark fighters dive out of a cloud bank and scream overhead. Card: **OUTNUMBERED.** | Diving scream, Doppler |
| 4 | 6.2–7.8 | **The merge** | Locked off, side-on | Head-on pass at 500 m/s closure, both jets knife-edge. Time ramps to 0.14× at the crossing, then snaps back | Time-stretch whoosh, double Doppler |
| 5 | 7.8–9.6 | **Fox two** | Rigged under the bandit's wing | The missile drops off the rail, ignites and races away toward Viper 1-1 | Clunk, ignition roar |
| 6 | 9.6–12.4 | **Flares** | Flying ahead of the jet, looking back | Hard break and barrel roll while dumping flares. The missile chases, decoys onto a flare and detonates. Radio: *"Break right!"* | Lock tone, flare pops, blast |
| 7 | 12.4–14.2 | **Reversal** | Wing-mounted, looking at the canopy | A max-G pull into the sun, with vapour boiling off the wing and wingtip vortices | Wind roar, strain, riser |
| 8 | 14.2–17.2 | **Guns** | Over the shoulder | Tracers walk onto a jinking bandit, which takes hits, catches fire and explodes. The lens flies into the fireball | Drums, cannon BRRRT, explosion |
| 9 | 17.2–19.2 | **Wave-top** | 4 m off the water | Both jets blast past at 15 m in the sun's glitter path, throwing up rooster tails of spray | Two Doppler flybys |
| 10 | 19.2–21.4 | **SAM site** | Ground level by the launcher | Two SAMs launch in sequence: blast, dust and climbing smoke columns. Card: **OUTGUNNED.** | Rocket roars |
| 11 | 21.4–23.4 | **Defeat** | Wide over the island | SAM trails arc up toward the jet, which dives and flares. Two airbursts | Airburst booms |
| 12 | 23.4–25.6 | **Strike** | Chasing the jet's own missile | Two missiles run down onto the SAM site: fireballs, ground shock, secondary cook-off | Huge impacts |
| 13 | 25.6–28.0 | **Last bandit** | Behind the bandit, then beside it | Above the cloud deck, a bandit guns at Viper 1-1 through a climbing turn. Viper 1-2's missile arrives from the side and kills it in slow motion. Radio: *"Fox two. Splash one."* | Gun burst, slow-mo blast |
| 14 | 28.0–30.0 | **Hero pass** | 5 m above the sea, head-on | The jet skims the water out of the low sun, throwing spray. It is in slow motion until the vapour cone forms, then it rips overhead at full speed. Card: **NEVER OUTFLOWN.** | Near silence, then sonic crack |
| 15 | 30.0–35.0 | **Title** | Wide sunset | The pair climb away trailing vapour. **GLIDEPATH · ENDLESS FLIGHT** | Final BRAAM, ring-out |

## Who's who

- **Our side, Viper 1-1 (you) and Viper 1-2 (your wingman):** light grey jets with twin tails, cyan tail bands, cyan formation lights and orange afterburners. Each carries a cyan HUD box with its callsign.
- **Bandits:** black single-tail jets with canards, red tails, red glowing strips and red afterburners. Each carries a red **BANDIT** box. Incoming threats are tagged red **MISSILE** or **SAM**.

## Look

- **Light:** golden hour with the sun 6° high, physically based sky and ocean reflections, and haze for aerial perspective.
- **Lens:** 2.39:1 framing, ACES tone mapping, bloom on fire and sun, chromatic fringing toward the edges, a teal/orange grade, an anamorphic sun flare and grain.
- **Editing:** cuts land on hits in the score. Slow motion is used three times: the merge, the kill and the hero pass. Impact shake is keyed to every explosion.

## Files

| File | What it is |
| --- | --- |
| `index.html` | Plays the trailer live with sound (open it over HTTP; it needs a GPU for full frame rate). |
| `film.js` | Scene, models, effects and the 15 shots. `render(t)` is a pure function of time. |
| `score.js` | The synthesised score and sound design (Web Audio). |
| `render.js` | Renders the MP4 with headless Chromium and ffmpeg: `node render.js`. Use `node render.js stills 7 16.3 29.4` for preview frames. |
| `vendor/` | three.js r170 (MIT), vendored so the page works offline. |
| `glidepath-trailer.mp4` | The finished trailer. |

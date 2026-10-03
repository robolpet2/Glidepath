# Glidepath trailer: "Four Worlds"

A 62-second cinematic trailer built from scratch in three.js. There's no gameplay footage: every shot is
its own procedural 3D scene, inspired by the game's regions. The trailer renders deterministically,
frame by frame, in headless Chromium.

## Shot list

| Time | Shot |
|---|---|
| 0–5 s | **Cold open.** Dawn over the ocean with the island on the horizon. A jet roars overhead. Cards: "ONE ISLAND." / "FOUR WORLDS." |
| 5–11 s | **01 The Heartland.** A chase along the river valley through forests, then a ridge flyby. |
| 11–18 s | **02 The Dust Sea.** The jet threads a canyon of stepped red mesas at sunset, kicking up a dust trail. Then side tracking over the dunes. |
| 18–25 s | **03 Northreach.** The aurora over the frozen lake and the research station. The jet thunders overhead. |
| 25–32 s | **04 Mount Kaela.** The volcano from the sea, then the eruption. At the crater rim, lava bombs fly and the jet streaks through the ash. |
| 32–34.5 s | **Montage.** SAND. ICE. FIRE. EARTH. Four hard cuts on the beat. |
| 34.5–44 s | **HYPER cruise.** "Target: Enemy Island, 2,000 km." The Rocket lights up with a vapor cone and sonic boom. It accelerates to 20 km/s (Mach 59) with the HUD running. Cards: "2,000 KM." / "UNDER TWO MINUTES." |
| 44–54 s | **05 Carrier ops.** The carrier group at golden hour. The jet goes on the catapult, the afterburner lights, and it launches off the bow. |
| 54–62 s | **Title.** GLIDEPATH, "The whole world is your runway". |

## Render

```bash
cd trailer
npm install                     # three + fonts
pip install numpy scipy
node shoot.mjs stills 12.5 40    # preview single frames  -> stills/
node shoot.mjs --range frames 0 62 30   # all 1,860 frames -> frames/ (split the range across workers)
python3 audio.py                 # synthesized score -> score.wav
ffmpeg -framerate 30 -i frames/f%05d.jpg -i score.wav -c:v libx264 -preset slow -crf 17 \
  -pix_fmt yuv420p -c:a aac -b:a 256k -shortest glidepath-trailer.mp4
```

`shoot.mjs` needs Playwright, with Chromium using SwiftShader (no GPU is required).

# Furrever Pet

A tiny desktop pet (Tauri 2 + Vue 3 + TypeScript). No backend, no network, no analytics.

## Run
```bash
npm install
npx tauri icon app-icon.svg
npm run tauri dev
npm run tauri build
```

## Click-through (how it works)
Tauri has no "forward mouse events" option, so:
1. The pet window is click-through by default (`setIgnoreCursorEvents(true)`).
2. Every ~50 ms the frontend calls the Rust command `cursor_in_window`, which returns the global
   cursor position relative to the window (physical px), or `null` if outside.
3. The frontend reads the alpha of the sprite canvas at that pixel (`getImageData`).
4. alpha > 10 → `setIgnoreCursorEvents(false)` (pet gets clicks/drags). Otherwise back to `true`.
5. Polling stops while the pet is hidden and drops to 250 ms while asleep. During a press or drag the
   window stays interactive.

Known limitations
- Up to ~50 ms of latency: a click that lands in the same tick the cursor enters the pet can fall through.
- Asleep, the cursor must rest on the pet ~250 ms before a click registers (to wake it).
- The hit area is the last drawn frame, so it lags fast animations by up to one frame.
- Semi-transparent edge pixels (alpha ≤ 10) are click-through.
- Hearts are drawn on a separate canvas and are not clickable.
- Dragging uses `screenX/Y` × devicePixelRatio. On mixed-DPI multi-monitor setups the pet can jitter
  slightly while straddling two monitors.
- Always-on-top does not cover exclusive-fullscreen games or full-screen macOS Spaces.
- macOS transparency needs Tauri's private API (`macOSPrivateApi`), which the Mac App Store rejects.
- Windows first; macOS untested; Linux/Wayland not supported.

## Sounds

Sound files live in `assets/pets/<pet>/sounds/` (mp3, ogg or wav) and are listed in the pet's `config.json`.
Each sound kind can have several variants. One is picked at random and never the same twice in a row.

| Kind (config key) | Plays when | Dog files |
|---|---|---|
| `click` | single click | `bark1.mp3`, `bark2.mp3`, `bark3.mp3` |
| `doubleClick` | double click (surprised) | `yelp1.mp3` |
| `pickup` | the pet is picked up (drag starts) | `whine1.mp3`, `whine2.mp3` |
| `sneeze` | randomly every ~45–135 s while awake and idle or sitting | `sneeze1.mp3` |
| `growl` | poked 6 times within ~2.5 s (annoyed) | `growl1.mp3` |
| `pant` | the dog's "heh, heh, heh", twice during each panting session (every ~3–6 min, lasting ~8 s) | none yet, synth only |
| `eat` | the pet eats a treat | none yet, synth only |

Behavior
- Only one sound plays at a time. A new sound stops the previous one.
- Cooldowns stop rapid input from stacking sounds: click 350 ms, double click 600 ms, pickup and growl 1.5 s.
- Mute and volume (tray and Settings) apply to every kind.
- Sneezes stop completely while the pet is hidden.

Fallbacks
- Missing files are skipped with a console warning. The app never fails because of a missing sound.
- If a kind has no files, the app uses the Web Audio synth named in `sounds.synth` for that kind
  (`bark`, `yelp`, `purr`, `mew`). **The synth is a placeholder, not meant to ship.**
- Built-in synth sounds: `bark`, `yelp`, `whine`, `growl`, `sneeze`, `purr`, `mew`, `hiss`.
- Kinds with no files and no synth entry stay silent.
- Both default pets have a synth for every kind, so the app is never silent. Real files always take priority.
- The cat has no `pickup`, `sneeze` or `growl` entries, so those are silent for the cat until you add them
  (for example a hiss for `growl`).

Preparing audio files

- Aim for 0.3–1.5 s, mono, with consistent loudness, and 2–3 variants for frequent sounds like barks.
- Trim and convert with ffmpeg (example below starts at 16 s, runs 1.5 s, and fades out over the last 0.2 s).
- Keep `st` equal to `-t` minus the fade length. It is measured from the start of the trimmed clip.
- Restart `npm run tauri dev` after adding or renaming files. Vite finds them at startup.

```bash
ffmpeg -i raw.wav -ss 16 -t 1.5 -ac 1 -b:a 96k -af "loudnorm,afade=t=out:st=1.3:d=0.2" whine1.mp3
```

Licensing

- Only use audio you have the right to ship: CC0, or licenses that allow commercial use.
- Avoid NonCommercial licenses and clips taken from videos, films or unlicensed libraries.
- Every third-party file must be listed in [`CREDITS.md`](CREDITS.md) with title, author, link and license.
- CC BY files require attribution and a note if the file was modified (trimmed, converted, normalized).
- Credits must reach end users, not just the repo. Ship `CREDITS.md` with the installer or show it in Settings.

## Name, gender and check-ins (v0.1.1)

Settings: pet name, boy or girl, your name, and "Pet checks in on me".

- **Collar and lashes:** boys get a blue collar. Girls get a pink collar and eyelashes. The placeholder art draws both
  automatically. Real sprite art is not recoloured. To show them with real art, draw them into the sprites and give each
  animation one sheet per gender in `config.json`:
  `"idle": { "sheet": "sprites/idle.png", "genderSheets": { "boy": "sprites/idle-boy.png", "girl": "sprites/idle-girl.png" }, "frames": 4, "fps": 3, "loop": true }`
  Without `genderSheets`, the plain `sheet` is used for both.
- **Greeting:** shortly after launch, based on the time of day, using your name and the pet's name.
- **Check-ins:** at random every 30 to 90 minutes the pet asks how you are, whether you drank water, or
  if you want to play. Late at night it only asks if it's time to rest. Edit the lines in `src/pets/dialogue.ts`.
- The pet only talks while awake, idle or sitting, and visible. Dragging it dismisses the bubble.
- The speech bubble is a separate small window (`bubble.html`). Near the top of the screen it appears below
  the pet, with its tail still pointing down.
- Names are limited to 20 characters. Everything stays on the device.
- **First run:** on a fresh install the Settings window opens in welcome mode and the pet stays quiet until
  you enter a pet name and your name and press Start. Installs that already have saved settings skip this.

## Panting

Pets with `"tongue": true` in `placeholder` pant for about 8 seconds every 3 to 6 minutes: open mouth, tongue
pulsing, and the `pant` sound. The rest of the time the mouth is closed. Timings are constants at the top of
`PetApp.vue`. With real sprite art, the tongue isn't drawn, so only the sound plays.

## Feed and play (v0.1.2)

- **Right-click the pet** for a bubble with Feed and Play, or use **Feed** and **Play** in the tray menu.
  The pet also sometimes asks for a treat during a check-in.
- **Feed:** a treat (`"treat": "bone"` or `"fish"` in `config.json`, default bone) drops in, the pet eats it
  with the `eat` sound, then hearts appear.
- **Play:** a ball bounces around the pet for about 4 seconds while it hops and makes its click sound.
- Only one session runs at a time. Hiding the pet cancels it. The treat and ball are drawn on the effects
  canvas, so they are never clickable and never count for click-through.
- **Notification card:** every 20 to 60 minutes a small card appears in the bottom-right corner of the pet's
  screen asking if you want to feed or play. It closes after 20 s or on "Not now". If the pet is sitting in
  that corner, the card stacks above it. Turn it off with "Feed/play reminders" in Settings.

## Sleep timer

Settings → "Fall asleep after": 5 minutes (default), 15 minutes, 30 minutes or Never. Idle means no clicks,
hovers or drags. Never also disables the short random naps. Any interaction wakes the pet. Settings saved by
v0.1.0 with sleep turned off migrate to Never. Settings with sleep on use the new 5-minute default.

## How to add a new pet
1. Copy `assets/pets/dog` to `assets/pets/<your-pet>` (the folder name is the pet's id).
2. Edit `config.json`:

| Field | Meaning |
|---|---|
| `name` | Label in the tray and settings |
| `treat` | What the pet is fed: `bone` or `fish` (default `bone`). Optional |
| `frame.width/height` | Logical px size of one frame at "medium" (default 128×128) |
| `placeholder` | `style` (`dog`/`cat`/`blob`) + `body`/`accent`/`belly` colors, plus `tongue` (`true` lets the pet pant), used when art is missing |
| `sounds.click` / `doubleClick` / `pickup` / `sneeze` / `growl` / `pant` / `eat` | File names inside `sounds/`, 2–3 variants recommended for frequent sounds. All optional |
| `sounds.synth` | Fallback per kind: `bark`, `yelp`, `whine`, `growl`, `sneeze`, `pant`, `purr`, `mew`, `hiss`, `munch` or `none`. Optional |
| `animations.<state>` | `sheet`, `frames`, `fps`, `loop`; or `mirrorOf` to flip another animation |

States: `idle, blink, walk-left, walk-right, sit, sleep, happy, surprised, dangle`.
Only `idle` is required; missing states reuse `idle` with a console warning.

3. Sprite sheets: a single horizontal strip of equal frames, transparent PNG/WebP.
   Sheet width = `frames × frame.width`, height = `frame.height`. Integer multiples (2×, 3×) are fine for
   sharper art; the player derives the real frame size from the image. Put them in `sprites/` and match the
   `sheet` paths in the config. Draw the pet standing on the bottom edge and facing forward.
4. Drop sound files into `sounds/` and list them in the config.
5. Add any third-party audio to `CREDITS.md`.
6. Restart `npm run tauri dev` (or rebuild). The pet appears in the tray and in Settings.

Replacing the placeholder art of dog/cat works the same way: add the PNGs named in their `config.json`.
Anything missing keeps using the placeholder.

## Ideas for later
Feeding and hunger, mood that reacts to time of day, more pets (rabbit, bird), seasonal outfits, pet follows
the cursor, drag-and-drop toys, per-pet idle personalities in `config.json`, sound packs, multiple pets at once,
more sound triggers (hungry whine, happy panting, sleepy snore).
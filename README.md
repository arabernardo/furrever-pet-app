# Furever Pet

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

## How to add a new pet
1. Copy `assets/pets/dog` to `assets/pets/<your-pet>` (the folder name is the pet's id).
2. Edit `config.json`:

| Field | Meaning |
|---|---|
| `name` | Label in the tray and settings |
| `frame.width/height` | Logical px size of one frame at "medium" (default 128×128) |
| `placeholder` | `style` (`dog`/`cat`/`blob`) + `body`/`accent`/`belly` colors, used when art is missing |
| `sounds.click` / `doubleClick` / `pickup` / `sneeze` / `growl` | File names inside `sounds/`, 2–3 variants recommended for frequent sounds. All optional |
| `sounds.synth` | Fallback per kind: `bark`, `yelp`, `whine`, `growl`, `sneeze`, `purr`, `mew`, `hiss` or `none`. Optional |
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
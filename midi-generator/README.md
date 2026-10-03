# MIDI Generator

Web-based MIDI generator built on pure music algorithms (no AI). Pick a genre, mood, key and
parts, generate, listen, edit in an FL Studio-style piano roll and export `.mid` files.
Everything runs in the browser: no backend, no sign-up.

The development roadmap lives in [`../docs/PLAN.md`](../docs/PLAN.md).

## Features

- **Generation** — single part or multitrack (drums, bass, chords, melody, arpeggio, pad, riff)
  built on one shared harmony; reproducible by seed, every part can be regenerated on its own
- **Styles** — 15 genres (pop, hip-hop, lo-fi, house, techno, drum & bass, rock, metal,
  death/thrash/doom metal, stoner rock, jazz, funk, ambient) × 9 moods; 13 scales;
  4/4 · 3/4 · 6/8; 1–32 bars; swing, complexity and humanize
- **Playback** — built-in Web Audio synth and drum kit, or one of three sample packs loaded on
  demand (GM Classic, GM Rich, Electronic); loop regions, metronome, live tempo changes
- **Piano roll** — draw / select / delete tools, move and resize with snap (1/4–1/32, triplets),
  box selection, velocity lane, ghost notes of other tracks, zoom, undo/redo; edits are heard
  immediately during playback
- **Export** — one multitrack `.mid` (type 1, PPQ 480, drums on channel 10), single tracks, a ZIP
  of all tracks, or drag a track straight into a DAW (Chromium)
- **UI** — Russian, English and German; dark and light themes; responsive down to tablet width

## Keyboard shortcuts

| Keys | Action |
|---|---|
| Ctrl/⌘ + Enter | Generate |
| Space | Play / stop |
| Ctrl/⌘ + Z, Ctrl/⌘ + Y (or Shift + Z) | Undo, redo |
| P / E / D | Draw, select, delete tool |
| Delete, Ctrl + A / C / X / V / D | Delete, select all, copy, cut, paste at cursor, duplicate |
| ↑ ↓ (Shift: octave), ← → | Transpose, move by snap |
| Alt while dragging | Move or resize without snap |
| Ctrl + wheel, Alt + wheel | Zoom time, zoom rows |

## Stack

React 19 · TypeScript · Vite · zustand + zundo · i18next · @tonejs/midi · smplr · fflate ·
lucide-react · Vitest · oxlint

## Scripts

```bash
npm install          # install dependencies
npm run dev          # start dev server
npm run build        # type-check and build for production
npm run preview      # preview the production build
npm run lint         # run oxlint
npm run test         # run unit tests once
npm run test:watch   # run unit tests in watch mode
npm run check        # lint + tests + build
```

## Project structure

```
src/
  core/        pure logic: data model, PRNG, music theory, genre/mood presets,
               part generators, MIDI/ZIP export
  audio/       Web Audio engine, scheduler, synth voices, sample pack loader
  store/       zustand stores (settings, project + undo history, UI, playback, samples)
  i18n/        i18next setup and locales/{ru,en,de}.json
  components/  React UI (settings panel, track list, transport, piano roll, export)
```

## Sample credits

Sample packs are streamed from public CDNs only when selected and are played back unmodified.

| Pack | Soundfont | Drums |
|---|---|---|
| GM Classic | FluidR3_GM (Frank Wen) — CC BY 3.0 | LinnDrum LM-2 — public domain |
| GM Rich | Musyng Kite — CC BY-SA 3.0 | Casio RZ-1 — public domain |
| Electronic | FatBoy — CC BY-SA 3.0 | Roland TR-808 — public domain |

Soundfonts via [gleitz/midi-js-soundfonts](https://github.com/gleitz/midi-js-soundfonts), drum
machines via [smpldsnds/drum-machines](https://github.com/smpldsnds/drum-machines), loaded with
[smplr](https://github.com/danigb/smplr).

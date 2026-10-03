# MIDI Generator

Web-based MIDI generator built on pure algorithms (no AI). Pick a genre, mood, key, tempo and
parts — drums, chords, bass, melody, arpeggio, pad, riff — then preview, edit in a piano roll and
export `.mid` files. Everything runs in the browser: no backend, no sign-up.

The development roadmap lives in [`../docs/PLAN.md`](../docs/PLAN.md).

## Features (planned)

- Single-part or multitrack generation from a shared harmony, reproducible by seed
- 15 genres × 9 moods, 1–32 bars, 4/4 · 3/4 · 6/8, swing and humanize
- Live preview with a built-in synth or one of three lazy-loaded sample packs
- FL Studio-style piano roll with undo/redo and velocity lane
- Export as a single multitrack `.mid`, per-track files or a ZIP
- UI in Russian, English and German

## Stack

React 19 · TypeScript · Vite · zustand/zundo · i18next · @tonejs/midi · smplr · fflate · Vitest · oxlint

## Scripts

```bash
npm install          # install dependencies
npm run dev          # start dev server
npm run build        # type-check and build for production
npm run preview      # preview the production build
npm run lint         # run oxlint
npm run test         # run unit tests once
npm run test:watch   # run unit tests in watch mode
```

## Project structure

```
src/
  core/        pure logic: data model, music theory, generators, MIDI export
  audio/       Web Audio engine, synth voices, sample pack loader
  store/       zustand stores
  i18n/        i18next setup and locales/{ru,en,de}.json
  components/  React UI
```

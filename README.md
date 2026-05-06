# 诗声 (Poem Voice)

A PWA + Capacitor iOS app for listening to and searching classical Chinese poetry. Uses the browser Web Speech APIs for line-by-line text-to-speech playback and voice-driven search of a 40,000-poem corpus from the Tang and Song dynasties.

## Features

- Text-to-speech playback of poems, line by line, with highlight tracking
- Voice search and voice-driven add to your personal library
- Browse a 40,000-poem corpus (Tang + Song, traditional → simplified converted)
- Save poems with star ratings, optional bold lines, and per-character pinyin annotations
- Online fallback search when a poem isn't in the local corpus
- Installable PWA with offline support; Capacitor wrapper for native iOS

## Tech stack

- React 19 + TypeScript + Vite
- IndexedDB (via `idb`) for the saved-poem library
- Web Speech API (`SpeechRecognition`, `SpeechSynthesis`) — `zh-CN`
- Workbox PWA via `vite-plugin-pwa`
- Capacitor 8 for iOS packaging
- Vitest + Testing Library for tests; ESLint for linting

## Quick start

```bash
npm install            # install deps
npm run build:corpus   # fetch and build public/corpus.json + public/authors.json (one-time)
npm run dev            # start Vite dev server
```

Common scripts:

| Script | What it does |
|---|---|
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | TypeScript compile + Vite production build |
| `npm run lint` | ESLint |
| `npm run test` | Vitest single pass |
| `npm run test:watch` | Vitest watch mode |
| `npm run coverage` | Vitest with coverage |
| `npm run build:corpus` | Rebuild `public/corpus.json` and `public/authors.json` from the upstream `chinese-poetry` GitHub repo |
| `npm run build:ios` | `npm run build` + `npx cap sync ios` |
| `npm run ios:open` | Open the Xcode project |

## Corpus pipeline

`scripts/build-corpus.mjs` fetches Tang and Song poems from the [`chinese-poetry/chinese-poetry`](https://github.com/chinese-poetry/chinese-poetry) GitHub repo, converts traditional → simplified using `opencc-js`, and writes two JSON files into `public/`:

- `public/corpus.json` — up to 40,000 poems
- `public/authors.json` — author bio map keyed by name

These files are **not committed** (gitignored) — run `npm run build:corpus` after cloning. The corpus is served as a static asset and cached by the Workbox service worker; it is never bundled into the JS build.

## Architecture

```
App
├── ListenTab          poem player with voice control, search, and save
│   └── PoemPlayer     line-by-line TTS playback with highlight + rating
└── LibraryTab         browse corpus + saved poems, search, online fallback
    ├── PoemPreview    card preview before adding to library
    └── PoemSearchModal results from online fallback search
```

- `useCorpus` (`src/hooks/useCorpus.ts`) loads `corpus.json` + `authors.json` and merges author bios into each poem.
- `PoemLibrary` (`src/data/PoemLibrary.ts`) persists saved poems in IndexedDB (`poem-library` DB).
- `VoiceController` (`src/voice/VoiceController.ts`) wraps the Web Speech APIs with Chrome-specific workarounds (speak-after-cancel timing, focus-pause guards) and a generation counter to cancel superseded TTS calls.
- `PoemSearch` (`src/data/PoemSearch.ts`) is a pure search function: exact title → partial title → line content, ignoring punctuation.

## iOS

The Capacitor project lives in `ios/`. After web changes:

```bash
npm run build:ios   # rebuild web bundle and sync into ios/App/App/public
npm run ios:open    # open Xcode to run on simulator or device
```

Two Capacitor plugins are bundled: `@capacitor-community/keep-awake` and `@capacitor-community/speech-recognition`.

## License

[MIT](LICENSE) © 2026 Shiwei

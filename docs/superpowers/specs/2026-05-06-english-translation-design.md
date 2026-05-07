# English Translation Feature Design

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

## Goal

Add a 中/英 language toggle to the poem player. In 英 mode, a poetic English rendering appears beneath each Chinese line and TTS switches to `en-US`. Translations are generated offline via the `claude` CLI and stored in IndexedDB alongside each saved poem.

## Architecture

This is a Phase B implementation: translations are generated only for the user's saved poems, not the full corpus. A three-step export → translate → import workflow bridges the gap between browser IndexedDB and the Node.js build script. Phase A (full corpus pre-bundling) is out of scope here.

**Tech Stack:** React 19 + TypeScript, IndexedDB (`idb`), Web Speech API, Node.js `child_process.execSync`, `claude` CLI

---

## Section 1: Data Model

`SavedPoem` (`src/types.ts`) gains one new optional field:

```typescript
englishLines?: string[]   // parallel to lines[]; one poetic English string per source line
```

- Stored in IndexedDB as part of the existing `SavedPoem` object
- `DB_VERSION` stays at 1 — IndexedDB is schemaless, no migration needed
- A poem with no `englishLines` is valid; 英 mode is silently unavailable for it

---

## Section 2: Offline Translation Workflow

Because Node.js cannot read browser IndexedDB, translation requires a three-step cycle.

### Step 1 — Export (in-app)

Settings modal has an **导出诗库** button. It:
1. Calls `listPoems()` to get all `SavedPoem[]`
2. Serializes to JSON
3. Triggers a browser download of `library.json`

### Step 2 — Build script (`scripts/translate-saved.mjs`)

```
npm run translate:saved -- library.json
```

Behaviour:
1. Read `library.json` (array of `SavedPoem`)
2. Filter poems that have no `englishLines` (skip already-translated)
3. Batch in groups of 10 poems
4. For each batch, call the `claude` CLI:

```bash
claude -p "<system prompt>\n\nPoems JSON:\n<batch JSON>"
```

**System prompt for Claude:**
```
You are a classical Chinese poetry translator. For each poem provided, produce a poetic English rendering — one that preserves the emotional tone, imagery, and cadence of the original. Do NOT produce a literal word-for-word translation. Return a JSON array where each element is:
{ "id": "<poem id>", "englishLines": ["<line 1>", "<line 2>", ...] }
The englishLines array must have exactly the same number of entries as the poem's lines array. Return only valid JSON, no other text.
```

5. Parse the JSON response; merge `englishLines` into the poems by `id`
6. Write the full updated array to `library-translated.json`

Error handling: if a batch fails to parse, log a warning and skip that batch (poems stay untranslated).

### Step 3 — Import (in-app)

Settings modal has an **导入翻译** file picker (`accept=".json"`). It:
1. Reads the selected file
2. Parses as `SavedPoem[]`
3. For each poem that exists in the current library (matched by `id`) and has `englishLines`, calls `savePoem(updated)` with the new `englishLines` field
4. Calls `onPoemAdded()` once at the end to refresh the library

---

## Section 3: App UI Changes

### 3a — Settings modal

A `⚙` gear button appears in the app's main tab bar area (top-right, outside the 朗读/诗库 tab buttons). Tapping it opens a `<dialog>` modal (`SettingsModal` component at `src/components/SettingsModal.tsx`).

Modal content:
- **导出诗库** button → triggers export (Section 2, Step 1)
- **导入翻译** `<input type="file" accept=".json">` → triggers import (Section 2, Step 3)
- **关闭** button

`App.tsx` owns `showSettings` state and passes `savedPoems`/`onPoemAdded` to the modal.

### 3b — Language toggle

- State: `lang: 'zh' | 'en'` in `App.tsx`, initialised from `localStorage.getItem('poem-lang') ?? 'zh'`
- Key: `'poem-lang'`
- Passed as prop `lang` and setter `setLang` to `ListenTab` → `PoemPlayer`

A **中/英** toggle button sits in `PoemPlayer`'s `.poem-controls` row, to the left of 朗读/停止. It shows the current mode and switches on tap. When `lang === 'en'` and the poem has no `englishLines`, the button renders with an `unavailable` CSS class (reduced opacity) but remains tappable — tapping it while unavailable does nothing (no mode switch).

### 3c — Bilingual display

When `lang === 'en'` and `poem.englishLines` is present:

```tsx
<p className="poem-line ...">
  {/* existing Chinese char spans / ruby elements */}
</p>
<p className="english-line">
  {poem.englishLines[line.sourceLineIndex] ?? ''}
</p>
```

`englishLines` is indexed by `sourceLineIndex` (not display-line index), matching the same index used for `boldLines` and `charAnnotations`.

When `lang === 'en'` but `poem.englishLines` is absent, display is Chinese-only (no change).

### 3d — Reciting

The **背诵** button is hidden (not disabled) when `lang === 'en'`. English reciting is out of scope.

---

## Section 4: TTS in 英 Mode

### VoiceController

`speakLines` signature gains an optional `lang` parameter:

```typescript
speakLines(
  lines: string[],
  onLineStart: (index: number) => void,
  onDone: () => void,
  rate?: number,
  lang?: string,       // new — defaults to 'zh-CN'
): void
```

Inside the method, `utterance.lang = lang ?? 'zh-CN'`. All existing callers pass no `lang` arg and are unaffected.

### ListenTab

The `onPlay` handler passed to `PoemPlayer` checks `lang`:

```
if lang === 'en' and poem.englishLines exists:
  speakLines(poem.englishLines, onLineStart, onDone, ttsRate, 'en-US')
else:
  speakLines(ttsLines, onLineStart, onDone, ttsRate)   // existing behaviour
```

Same conditional applies to:
- Single-line tap-to-speak (`onSpeakLine`)
- Auto-play advance (speak next poem's lines after title announcement)
- Repeat-play

The title/author announcement before auto-play (`"《title》，author"`) always uses Chinese TTS regardless of `lang`.

---

## Out of Scope

- Phase A (full 40K corpus pre-bundled `translations.json`)
- English STT / English reciting mode
- Translation quality review UI
- Editing English lines in-app
- Poems added via online search (no `englishLines`; 英 button unavailable for them)

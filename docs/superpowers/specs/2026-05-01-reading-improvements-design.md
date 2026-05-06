# Reading Improvements Design

**Date:** 2026-05-01  
**Status:** Approved

---

## Goal

Two improvements to the 诗声 app: (1) TTS speed control so users can slow down or speed up poem playback, and (2) a corpus browser inside the Library tab so users can discover and add poems without needing to know the exact title.

---

## Feature 1: TTS Speed Control

### Architecture

`VoiceController.speakLines()` gains an optional `rate` parameter (number, default 1.0). Each `SpeechSynthesisUtterance` created inside `speakLines` sets `.rate = rate`. The rate range used in the UI is 0.5–2.0.

`useVoiceController` exposes:
- `ttsRate: number` — current rate, initialized from `localStorage.getItem('tts-rate')` (parsed float, fallback 1.0)
- `setTtsRate(rate: number): void` — updates state and writes to `localStorage`

`PoemPlayer` receives two new props: `ttsRate: number` and `setTtsRate: (r: number) => void`. It renders three preset buttons above the 朗读/停止 control:

| Label | Rate |
|-------|------|
| 慢 | 0.7 |
| 正常 | 1.0 |
| 快 | 1.4 |

The active preset is highlighted. Changing speed does not interrupt current playback; the new rate takes effect on the next 朗读 tap.

### Files

- **Modify:** `src/voice/VoiceController.ts` — add `rate` param to `speakLines`
- **Modify:** `src/hooks/useVoiceController.ts` — add `ttsRate` state + `setTtsRate`
- **Modify:** `src/components/PoemPlayer.tsx` — add speed preset buttons + props
- **Modify:** `src/App.tsx` — pass `ttsRate`/`setTtsRate` through to PoemPlayer via ListenTab
- **Modify:** `src/components/ListenTab.tsx` — forward `ttsRate`/`setTtsRate` to PoemPlayer
- **Modify:** `src/styles.css` — styles for speed preset buttons

---

## Feature 2: Library Sub-tabs + Corpus Browser

### Architecture

The Library tab gains two sub-tabs rendered as toggle buttons at the top:

- **我的诗库** (default) — existing saved poem list + 添加新诗 button
- **浏览诗库** — corpus browser

The active sub-tab is local React state (`'mine' | 'browse'`) inside `LibraryTab`.

### 我的诗库 sub-tab

Identical to the current Library tab behavior:
- Saved poem list (tap to play via `onPoemSelect`)
- 添加新诗 button (voice or text search → PoemPreview → confirm/cancel)
- Empty state message when library is empty

### 浏览诗库 sub-tab

- Search input with placeholder "搜索诗库..."
- When input is empty: shows the first 50 poems from corpus (sorted by corpus order)
- When input has text: shows up to 50 matching results from `searchPoems(corpus, query)`
- Poems already in `savedPoems` (matched by `id`) are excluded from results
- Each result row: title + author · dynasty, with a ＋ button on the right
- Tapping the row or the ＋ button calls `setPreview(poem)` — triggers the existing `PoemPreview` flow (confirm adds to library, cancel dismisses)

### Files

- **Modify:** `src/components/LibraryTab.tsx` — add `activeSubTab` state, sub-tab buttons, 浏览诗库 section
- **Modify:** `src/styles.css` — styles for sub-tab buttons and corpus result rows

---

## Error Handling

- If corpus is still loading when 浏览诗库 is opened, show the existing "正在加载诗库..." message in the browse panel.
- If corpus load failed, show "诗库加载失败" in the browse panel.
- Speed presets are UI-only; if TTS is not supported, the speed buttons are not shown (same condition as the 朗读 button).

---

## Out of Scope

- Playlist / sequential playback of multiple poems
- Favorites or tagging
- Grouping corpus results by author or dynasty
- Pinyin annotations

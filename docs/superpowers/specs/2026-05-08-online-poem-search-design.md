# Online Poem Search — Design Spec

**Date:** 2026-05-08  
**Status:** Approved

## Problem

The "联网找诗" feature calls `api.gushiwen.org/poems/search`, a nonexistent endpoint. Every search shows a spinner then silently returns no results. The feature is completely broken.

## Goal

Fix in-app online poem search so users can find and add poems that are outside the local 40k corpus, without changing the existing `PoemSearchModal` UI or the add-to-library flow.

## Approach: Build-time compact index

### Build pipeline

`scripts/build-corpus.mjs` writes a second output: `public/poem-search-index.json`.

The index is built from the same fetch loop used for `corpus.json`, but without the 40k poem cap — it covers all available Tang (~57k) and Song (~254k) poems. Each entry is a compact object:

```json
{ "t": "静夜思", "a": "李白", "d": "tang", "f": 0, "local": true }
```

Fields:
- `t` — simplified title
- `a` — simplified author  
- `d` — dynasty: `"tang"` | `"song"`
- `f` — file index N (the N in `poet.tang.N.json`, multiples of 1000)
- `local` — `true` if this poem is already in `corpus.json` (skip GitHub fetch at runtime)

Size target: ~80k entries × ~35 bytes ≈ 2.8 MB uncompressed, ~0.6 MB gzipped. Well within the 40 MB Workbox limit.

The build script enforces a size check on `poem-search-index.json` (warn at 5 MB, abort at 10 MB).

### Runtime: `findPoemOnline.ts`

Replaces the dead `searchGushiwen` function entirely.

**Index caching:** Module-level `let indexCache: IndexEntry[] | null = null`. First call fetches `/poem-search-index.json`; subsequent calls are instant.

**Search algorithm:**
1. Normalize query: strip punctuation, convert to simplified Chinese using `opencc-js`
2. Fuzzy-match against `t` (title) and `a` (author) fields — same normalization applied to both
3. Priority: exact title → partial title → author match
4. Take up to 10 index matches, then resolve full poems (up to 5 results returned)

**Full poem resolution per match:**
- If `local: true`: skip — the poem is already in `corpus.json` and will be found by local search. Online search is only for poems outside the local corpus.
- If not local: fetch `https://raw.githubusercontent.com/chinese-poetry/chinese-poetry/master/%E5%85%A8%E5%94%90%E8%AF%97/poet.{d}.{f}.json`, find poem by exact title match, extract `paragraphs` as lines.

**Error handling:**
- Index fetch failure → return `[]`, surface error string `"无法加载诗词索引，请检查网络连接"`
- Individual GitHub batch fetch failure → skip that result silently, return remaining matches
- Timeout: 10 seconds per fetch (using `AbortSignal.timeout`)

### Type / interface changes

`findPoemOnline.ts` exports remain identical:
- `SearchResult` — unchanged
- `findPoemOnline(query: string): Promise<SearchResult[]>` — unchanged signature
- `searchResultToSavedPoem(result: SearchResult): SavedPoem` — `dynasty` now comes from index entry's `d` field instead of hardcoded `'tang'`

No changes to `PoemSearchModal`, `LibraryTab`, or `ListenTab`.

### `poemWebSearch.ts`

Remove the `window.location.href` fallback (destructive on Capacitor — navigates away from the PWA). If popup is blocked, do nothing (the button still opens the browser on non-blocked platforms).

## Testing

New test file: `tests/utils/findPoemOnline.test.ts`

- Mock `fetch` to return a small index (5 entries, mix of local/non-local) + one batch file
- Assert exact title match returns correct `SearchResult`
- Assert partial title match works
- Assert author-only match works  
- Assert no match returns `[]`
- Assert index fetch failure returns `[]`
- Assert that `local: true` entries are filtered out of results (online search is for non-local poems only)
- Assert dynasty is correctly set from index `d` field (not hardcoded `'tang'`)

## Files changed

| File | Change |
|------|--------|
| `scripts/build-corpus.mjs` | Write `public/poem-search-index.json` alongside corpus |
| `src/utils/findPoemOnline.ts` | Replace dead API call with index-based search |
| `src/utils/poemWebSearch.ts` | Remove `window.location.href` fallback |
| `tests/utils/findPoemOnline.test.ts` | New unit tests |

No changes to components, types, or other utilities.

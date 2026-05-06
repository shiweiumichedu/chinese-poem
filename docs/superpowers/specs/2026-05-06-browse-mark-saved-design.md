# Mark saved poems in 浏览诗库 — Design

**Date:** 2026-05-06
**Component:** `src/components/LibraryTab.tsx` (浏览诗库 sub-tab)

## Problem

Today the 浏览诗库 (browse corpus) results hide any poem that the user has already saved to 我的诗库. When a user searches the corpus, they cannot tell whether a poem is missing from the results because (a) it doesn't match, or (b) they already saved it. They lose the contextual signal that "this is already in my library."

## Goal

Show every matching corpus poem in the browse results, marking already-saved poems with their library status (rating or a checkmark) instead of hiding them.

## Behavior

In the 浏览诗库 sub-tab, each result row displays one of three right-side indicators based on the poem's state in 我的诗库:

| Poem state | Indicator | Row interaction |
|---|---|---|
| Not saved | Green `+` (existing) | Button — opens preview → confirm-add flow (existing) |
| Saved, no rating | Checkmark `✓` | Non-interactive (no-op on tap) |
| Saved, with rating (1–5) | 5 stars with `rating` filled, rest empty | Non-interactive (no-op on tap) |

Stars in the browse view are **display-only** — editing ratings remains in 我的诗库.

## Implementation

### `src/components/LibraryTab.tsx`

1. **`browseResults` useMemo** (currently lines 63–67):
   - Drop the `.filter(p => !savedIds.has(p.id))` exclusion.
   - Continue to compute `savedIds` so the renderer can look up state.
   - Also build a `Map<string, SavedPoem>` from `savedPoems` so the renderer can read `rating` in O(1).
   - Keep `slice(0, 50)` cap.

2. **Browse result rendering** (currently lines 361–374):
   - For each `poem` in `browseResults`, look up `saved = savedById.get(poem.id)`.
   - If `saved === undefined` → render existing `<button class="browse-result-item">` with `+` indicator.
   - If `saved` exists → render a `<div class="browse-result-item saved">` (not a button) with:
     - If `saved.rating` is a number 1–5 → render 5 `<span class="star">` with `filled` class for stars `<= rating`.
     - Else → render `<span class="browse-result-saved-check">✓</span>`.

3. **Empty state** (currently lines 376–388):
   - Since saved poems no longer hide, the "所有诗词已添加到诗库" branch (when `browseQuery` is empty) is effectively unreachable in normal use. Simplify to a single message: "未找到匹配的诗" (only shown when `browseQuery` is set and yields nothing).
   - Keep the 联网找诗 button behavior unchanged for the search-with-no-results case.

### `src/styles.css`

Add styles near the existing `.browse-result-*` block (around line 300):

- `.browse-result-item.saved` — `cursor: default;` and remove the hover/active affordance that the button variant has.
- `.browse-result-saved-check` — dim/muted color (e.g. matches the existing `+` color or a subdued grey-gold) at similar font-size to the `+`.
- For the inline star display, reuse `.star` and `.star.filled` classes from the existing `.poem-rating` block (lines 339–346). The existing `.star:hover` rule (line 345) targets any element, so suppress it for browse via `.browse-result-item .star:hover { color: inherit; }` to keep these stars display-only. If sizing needs tweaking, also scope via `.browse-result-item .star { ... }`.

### Tests

Add to `tests/components/` (new file, e.g. `LibraryTab.browseSaved.test.tsx`):

1. A saved poem with `rating: 3` appears in browse results showing 3 filled + 2 empty stars (no `+`).
2. A saved poem with no `rating` appears in browse results showing the checkmark `✓` (no `+`).
3. An unsaved poem still shows `+` and clicking it opens the preview confirmation.
4. Clicking a saved poem's row does NOT open the preview (no-op).

## Out of scope

- Editing ratings from within the browse view (kept in 我的诗库).
- Sort order changes (saved poems appear in their natural corpus order, interleaved with unsaved).
- Modifying the 50-result cap.
- Any change to the 我的诗库 sub-tab or the top "add" search box.

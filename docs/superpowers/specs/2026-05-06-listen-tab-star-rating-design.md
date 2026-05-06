# Listen Tab Star Rating Design

**Date:** 2026-05-06
**Status:** Approved

## Problem

Stars on the 朗读/背诵 (ListenTab/PoemPlayer) page are read-only spans. Users cannot change the rating while listening or reciting without switching to the Library tab.

## Goal

Make the star rating interactive on the PoemPlayer page with an inline confirmation step before the rating is saved.

## Interaction Flow

1. User taps a star (1–5).
2. Stars immediately preview at the tapped level (visual feedback).
3. A confirmation row appears directly below the stars: `"设为 n★？" [确认] [取消]`
4. **Confirm:** saves the rating, clears pending state.
5. **Cancel:** restores original stars, clears pending state without saving.
6. Tapping the currently-set star then confirming clears the rating (toggle — matches LibraryTab behaviour).

## Components

### `src/components/PoemPlayer.tsx` (modified)

**New prop:**
```ts
onRate?: (rating: number) => void
```

**New local state:**
```ts
const [pendingRating, setPendingRating] = useState<number | null>(null)
```

**Star rendering logic:**
- `onRate` is **not** provided → render read-only `<span>` elements (no change to existing callers).
- `onRate` is provided AND `pendingRating === null` → render `<button>` elements; tap sets `pendingRating`.
- `pendingRating !== null` → stars preview at `pendingRating` level; render `<button>` elements disabled to prevent double-tap.

**Confirmation row** (shown only when `pendingRating !== null`):
```tsx
<div className="rating-confirm-row">
  <span>设为 {pendingRating}★？</span>
  <button onClick={handleConfirmRating}>确认</button>
  <button onClick={() => setPendingRating(null)}>取消</button>
</div>
```

`handleConfirmRating`:
```ts
function handleConfirmRating() {
  if (pendingRating === null) return
  onRate?.(pendingRating)
  setPendingRating(null)
}
```

No outside-tap detection needed — the explicit Cancel button is sufficient on mobile.

### `src/components/ListenTab.tsx` (modified)

**New handler:**
```ts
async function handleRate(rating: number) {
  if (!currentPoem) return
  const updated: SavedPoem = {
    ...currentPoem,
    rating: currentPoem.rating === rating ? undefined : rating,
  }
  try {
    await savePoem(updated)
    setCurrentPoem(updated)
  } catch (e) {
    console.error('Failed to save rating', e)
  }
}
```

Pass to `PoemPlayer`:
```tsx
onRate={currentPoem ? handleRate : undefined}
```

`onRate` is only wired when `currentPoem` exists (i.e. the poem has been saved to the library). Corpus poems not yet saved show read-only stars.

## Data Flow

```
User taps star n
  → PoemPlayer: setPendingRating(n)
  → Stars preview at n, confirmation row appears

User taps 确认
  → handleConfirmRating() → onRate(n)
  → ListenTab.handleRate(n)
    → rating = (n === poem.rating) ? undefined : n
    → savePoem(updated)
    → setCurrentPoem(updated)
  → poem.rating updates → stars re-render at saved level
  → setPendingRating(null) → confirmation row hides

User taps 取消
  → setPendingRating(null)
  → Stars revert to poem.rating, confirmation row hides
```

## Error Handling

- `savePoem` failure is caught, logged with `console.error`, and `pendingRating` is cleared. The displayed rating reverts to the pre-tap value since `currentPoem` was not mutated.
- `onRate` not provided → stars remain read-only spans; no state is created.

## Styling

- Pending stars display at the `pendingRating` fill level using the existing `.filled` class.
- Confirmation row uses existing button styles; add `.rating-confirm-row` for layout (flex row, centred, small gap).
- No new colour tokens needed.

## Testing

File: `tests/components/PoemPlayer.rating.test.tsx`

Mock `savePoem`. Cases:
1. Stars render as `<button>` when `onRate` is provided, `<span>` when not.
2. Tapping a star sets `pendingRating` → confirmation row appears with correct label.
3. Tapping 确认 calls `onRate` with the pending value and hides the row.
4. Tapping 取消 does not call `onRate` and hides the row.

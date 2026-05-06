# Listen Tab Star Rating Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make star ratings interactive on the 朗读/背诵 page, with an inline "设为 n★？ [确认] [取消]" confirmation row before saving.

**Architecture:** Add `onRate?` prop and `pendingRating` local state to `PoemPlayer`; stars become `<button>`s when `onRate` is provided, previewing at the tapped level until confirmed. `ListenTab` provides `handleRate` which toggles and saves via IndexedDB. No new files — only `PoemPlayer.tsx`, `ListenTab.tsx`, and `styles.css` change.

**Tech Stack:** React (useState, fireEvent), @testing-library/react, Vitest, idb (via savePoem)

---

## File Map

| Action | Path |
|--------|------|
| Modify | `src/components/PoemPlayer.tsx` |
| Modify | `src/components/ListenTab.tsx` |
| Modify | `src/styles.css` |
| Create | `tests/components/PoemPlayer.rating.test.tsx` |

---

## Task 1: Write failing tests for PoemPlayer star rating

**Files:**
- Create: `tests/components/PoemPlayer.rating.test.tsx`

- [ ] **Step 1: Create the test file**

```tsx
// tests/components/PoemPlayer.rating.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { PoemPlayer } from '../../src/components/PoemPlayer'
import type { SavedPoem } from '../../src/types'

const poem: SavedPoem = {
  id: '1',
  title: '静夜思',
  author: '李白',
  dynasty: 'tang',
  authorBackground: '',
  lines: ['床前明月光', '疑是地上霜', '举头望明月', '低头思故乡'],
  addedAt: 1000,
  rating: 3,
}

const defaultProps = {
  poem,
  onPlay: vi.fn(),
  onStop: vi.fn(),
  isPlaying: false,
  ttsRate: 1.0,
  setTtsRate: vi.fn(),
}

describe('PoemPlayer star rating', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders stars as spans when onRate is not provided', () => {
    render(<PoemPlayer {...defaultProps} />)
    const stars = document.querySelectorAll('.player-star')
    stars.forEach((star) => {
      expect(star.tagName).toBe('SPAN')
    })
  })

  it('renders stars as buttons when onRate is provided', () => {
    const onRate = vi.fn()
    render(<PoemPlayer {...defaultProps} onRate={onRate} />)
    const buttons = screen.getAllByRole('button', { name: /评分/ })
    expect(buttons).toHaveLength(5)
  })

  it('shows confirmation row when a star button is tapped', () => {
    const onRate = vi.fn()
    render(<PoemPlayer {...defaultProps} onRate={onRate} />)
    fireEvent.click(screen.getByRole('button', { name: '评分 4 星' }))
    expect(screen.getByText('设为 4★？')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '确认' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '取消' })).toBeInTheDocument()
  })

  it('calls onRate with tapped value and hides row when 确认 is clicked', () => {
    const onRate = vi.fn()
    render(<PoemPlayer {...defaultProps} onRate={onRate} />)
    fireEvent.click(screen.getByRole('button', { name: '评分 4 星' }))
    fireEvent.click(screen.getByRole('button', { name: '确认' }))
    expect(onRate).toHaveBeenCalledWith(4)
    expect(screen.queryByText('设为 4★？')).not.toBeInTheDocument()
  })

  it('does not call onRate and hides row when 取消 is clicked', () => {
    const onRate = vi.fn()
    render(<PoemPlayer {...defaultProps} onRate={onRate} />)
    fireEvent.click(screen.getByRole('button', { name: '评分 4 星' }))
    fireEvent.click(screen.getByRole('button', { name: '取消' }))
    expect(onRate).not.toHaveBeenCalled()
    expect(screen.queryByText('设为 4★？')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/components/PoemPlayer.rating.test.tsx
```

Expected: tests fail — `onRate` prop doesn't exist yet and stars are always `<span>`.

---

## Task 2: Implement interactive stars and confirmation row in PoemPlayer

**Files:**
- Modify: `src/components/PoemPlayer.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Add `onRate` to `PoemPlayerProps` interface**

In `src/components/PoemPlayer.tsx`, the `PoemPlayerProps` interface ends at line 56 with `onNextPoem?: () => void`. Add the new prop after it:

```ts
// After: onNextPoem?: () => void
onRate?: (rating: number) => void
```

- [ ] **Step 2: Add `onRate` to the function destructuring**

The function signature at line 58 is:
```ts
export function PoemPlayer({ poem, onPlay, onStop, isPlaying, highlightedLine, ttsRate, setTtsRate, onLineEdit, onLineBoldToggle, onSpeakLine, autoPlay, onAutoPlayToggle, repeatPlay, onRepeatPlayToggle, reciting, onReciteToggle, onBack, nextPoem, onNextPoem, onCharAnnotate, onCharAnnotateRemove }: PoemPlayerProps) {
```

Replace it with:
```ts
export function PoemPlayer({ poem, onPlay, onStop, isPlaying, highlightedLine, ttsRate, setTtsRate, onLineEdit, onLineBoldToggle, onSpeakLine, autoPlay, onAutoPlayToggle, repeatPlay, onRepeatPlayToggle, reciting, onReciteToggle, onBack, nextPoem, onNextPoem, onCharAnnotate, onCharAnnotateRemove, onRate }: PoemPlayerProps) {
```

- [ ] **Step 3: Add `pendingRating` state and `handleConfirmRating` function**

The component body starts with several `useState` and `useRef` declarations. After the existing state declarations (around line 75, after the `annotSubstitute` state), add:

```ts
const [pendingRating, setPendingRating] = useState<number | null>(null)

function handleConfirmRating() {
  if (pendingRating === null) return
  onRate?.(pendingRating)
  setPendingRating(null)
}
```

- [ ] **Step 4: Replace the star rating block with the interactive version**

Find and replace the current read-only star block (lines 185–193):

**Remove this:**
```tsx
      {poem.rating !== undefined && (
        <div className="poem-player-rating">
          {[1, 2, 3, 4, 5].map((star) => (
            <span key={star} className={`player-star${(poem.rating ?? 0) >= star ? ' filled' : ''}`}>
              ★
            </span>
          ))}
        </div>
      )}
```

**Replace with:**
```tsx
      {(poem.rating !== undefined || onRate !== undefined) && (
        <div className="poem-player-rating">
          {[1, 2, 3, 4, 5].map((star) => {
            const displayFill = pendingRating !== null ? pendingRating : (poem.rating ?? 0)
            if (onRate !== undefined) {
              return (
                <button
                  key={star}
                  className={`player-star${displayFill >= star ? ' filled' : ''}`}
                  onClick={() => setPendingRating(star)}
                  disabled={pendingRating !== null}
                  aria-label={`评分 ${star} 星`}
                >
                  ★
                </button>
              )
            }
            return (
              <span key={star} className={`player-star${(poem.rating ?? 0) >= star ? ' filled' : ''}`}>
                ★
              </span>
            )
          })}
        </div>
      )}
      {pendingRating !== null && (
        <div className="rating-confirm-row">
          <span>设为 {pendingRating}★？</span>
          <button onClick={handleConfirmRating}>确认</button>
          <button onClick={() => setPendingRating(null)}>取消</button>
        </div>
      )}
```

- [ ] **Step 5: Add CSS for the confirmation row and button star reset**

In `src/styles.css`, find the existing `.poem-player-rating` rule (line 201) and add the new rules directly after line 203 (after `.player-star.filled`):

```css
button.player-star { background: none; border: none; padding: 0; cursor: pointer; }
button.player-star:disabled { cursor: default; }
.rating-confirm-row { display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 12px; font-size: 14px; }
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
npx vitest run tests/components/PoemPlayer.rating.test.tsx
```

Expected:
```
 ✓ tests/components/PoemPlayer.rating.test.tsx (5)
```

- [ ] **Step 7: Run the full test suite**

```bash
npm run test
```

Expected: all tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/components/PoemPlayer.tsx src/styles.css tests/components/PoemPlayer.rating.test.tsx
git commit -m "feat: interactive star rating with confirmation in PoemPlayer"
```

---

## Task 3: Wire `onRate` in ListenTab

**Files:**
- Modify: `src/components/ListenTab.tsx`

`savePoem` is already imported at line 5. `currentPoem` is `SavedPoem | null` state (line 98). `onPoemUpdated` is a prop (line 96).

- [ ] **Step 1: Add `handleRate` function**

Find any existing save handler in `ListenTab.tsx` (e.g. `handleLineEdit` around line 435). Add `handleRate` alongside it:

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
    await onPoemUpdated()
  } catch (e) {
    console.error('Failed to save rating', e)
  }
}
```

- [ ] **Step 2: Pass `onRate` to PoemPlayer**

The `<PoemPlayer>` JSX starts at line 665. Add `onRate` after `onCharAnnotateRemove`:

```tsx
onRate={currentPoem ? handleRate : undefined}
```

The updated `<PoemPlayer>` closing section will look like:

```tsx
          onCharAnnotate={handleCharAnnotate}
          onCharAnnotateRemove={handleCharAnnotateRemove}
          onRate={currentPoem ? handleRate : undefined}
        />
```

- [ ] **Step 3: Run the full test suite**

```bash
npm run test
```

Expected: all tests pass.

- [ ] **Step 4: Run TypeScript check**

```bash
npm run build
```

Expected: no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/ListenTab.tsx
git commit -m "feat: wire star rating handler in ListenTab"
```

---

## Task 4: Build and install on device

- [ ] **Step 1: Sync to iOS**

```bash
npx cap sync ios
```

Expected: `Sync finished`.

- [ ] **Step 2: Build release**

```bash
xcodebuild -workspace ios/App/App.xcworkspace -scheme App -configuration Release -destination generic/platform=iOS build 2>&1 | tail -5
```

Expected: `** BUILD SUCCEEDED **`

- [ ] **Step 3: Install on device**

```bash
xcrun devicectl device install app \
  --device 0B12C94D-F42E-5BF5-ABD7-62347CC85B68 \
  "$(find ~/Library/Developer/Xcode/DerivedData/App-*/Build/Products/Release-iphoneos -name App.app -maxdepth 1 | head -1)"
```

Expected: `App installed: bundleID: com.shiwei.chinesepoem`

- [ ] **Step 4: Manual verification**

  1. Open 诗声, navigate to a saved poem in 朗读 tab.
  2. Tap any star — stars preview at tapped level, confirmation row `"设为 n★？ [确认] [取消]"` appears below.
  3. Tap 确认 — rating saves, confirmation row disappears, stars reflect new value.
  4. Tap a star then 取消 — stars revert, nothing saved.
  5. Tap the currently-active star and confirm — rating is cleared (no stars filled).

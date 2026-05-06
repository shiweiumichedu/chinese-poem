# Recitation Rating Downgrade Prompt — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After a 背诵 session where at least one sentence was "还是不对", ask the user via voice "要不要降一颗星？" and decrease the poem's rating by 1 if they say yes.

**Architecture:** All changes are in `src/components/ListenTab.tsx`. A `hasWrongAnswerRef` boolean ref tracks whether any wrong answer occurred in the current session. At the end of all sentences, if the flag is set and rating ≥ 2, insert the voice prompt before "背诵完成". The `isYes` helper is exported for testing.

**Tech Stack:** React 19, TypeScript, Web Speech API (existing `startListening` / `speakLines`), IndexedDB via `savePoem`

---

### Task 1: Export and test `isYes` helper

**Files:**
- Modify: `src/components/ListenTab.tsx`
- Create: `tests/components/ListenTab.isYes.test.ts`

- [ ] **Step 1: Add and export `isYes` in `ListenTab.tsx`**

Add this function near the top of the file, after the existing helper functions (e.g., after `normalizeReciteText`):

```typescript
export function isYes(text: string): boolean {
  return /[是要降对]/.test(text) && !/不/.test(text)
}
```

- [ ] **Step 2: Write the test file**

Create `tests/components/ListenTab.isYes.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { isYes } from '../../src/components/ListenTab'

describe('isYes', () => {
  it('returns true for 是', () => expect(isYes('是')).toBe(true))
  it('returns true for 要', () => expect(isYes('要')).toBe(true))
  it('returns true for 降', () => expect(isYes('降')).toBe(true))
  it('returns true for 对', () => expect(isYes('对')).toBe(true))
  it('returns false for 不要', () => expect(isYes('不要')).toBe(false))
  it('returns false for 不', () => expect(isYes('不')).toBe(false))
  it('returns false for empty string', () => expect(isYes('')).toBe(false))
  it('returns false for unrelated text', () => expect(isYes('下一首')).toBe(false))
  it('returns false for 好的', () => expect(isYes('好的')).toBe(false))
  it('returns true for 对对', () => expect(isYes('对对')).toBe(true))
})
```

- [ ] **Step 3: Run tests**

```bash
npx vitest run tests/components/ListenTab.isYes.test.ts
```

Expected: all 10 tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/components/ListenTab.tsx tests/components/ListenTab.isYes.test.ts
git commit -m "feat: add isYes helper for voice yes/no detection"
```

---

### Task 2: Add `hasWrongAnswerRef` and wire resets

**Files:**
- Modify: `src/components/ListenTab.tsx`

- [ ] **Step 1: Add the ref**

In `ListenTab`, alongside the other refs (near `recitingRef`), add:

```typescript
const hasWrongAnswerRef = useRef(false)
```

- [ ] **Step 2: Reset in `stopRecitingSession`**

```typescript
function stopRecitingSession() {
  setReciting(false)
  setReciteSentenceIndex(0)
  setRecognizedText('')
  recitingRef.current = false
  hasWrongAnswerRef.current = false
}
```

- [ ] **Step 3: Reset in `startReciting`**

Add `hasWrongAnswerRef.current = false` after `stop()` is called at the top of `startReciting`:

```typescript
function startReciting() {
  const poem = currentPoemRef.current
  if (!poem) return
  const sentences = getReciteSentences(poem)
  if (!sentences.length) return
  stop()
  hasWrongAnswerRef.current = false
  setHighlightedLine(null)
  setReciting(true)
  recitingRef.current = true
  setReciteSentenceIndex(0)
  speakLines([`第${toChineseNumber(1)}句`], () => setHighlightedLine(null), () => {
    beginReciteListening(0)
  })
}
```

- [ ] **Step 4: Set flag in `listenForCorrection`**

In the `else` branch where "还是不对" is spoken, set the flag before calling `speakLines`:

```typescript
} else {
  hasWrongAnswerRef.current = true
  speakLines(['还是不对，请自己纠正'], () => setHighlightedLine(null), () => {
    advanceReciteSentence(sentenceIndex + 1)
  })
}
```

- [ ] **Step 5: Run tests to confirm nothing broken**

```bash
npm run test
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/ListenTab.tsx
git commit -m "feat: track wrong answers during recitation session"
```

---

### Task 3: Insert rating downgrade prompt in `advanceReciteSentence`

**Files:**
- Modify: `src/components/ListenTab.tsx`

- [ ] **Step 1: Replace the end-of-poem branch in `advanceReciteSentence`**

Find this block in `advanceReciteSentence`:

```typescript
if (nextIndex >= sentences.length) {
  speakLines(['背诵完成'], () => setHighlightedLine(null), () => {
    handleReciteComplete()
  })
  return
}
```

Replace with:

```typescript
if (nextIndex >= sentences.length) {
  const proceedToComplete = () => {
    speakLines(['背诵完成'], () => setHighlightedLine(null), () => {
      handleReciteComplete()
    })
  }
  if (hasWrongAnswerRef.current && poem && (poem.rating ?? 0) >= 2) {
    speakLines(['要不要降一颗星？'], () => setHighlightedLine(null), () => {
      startListening((spokenText) => {
        if (isYes(spokenText)) {
          const updated = { ...poem, rating: (poem.rating as number) - 1 }
          setPoem(updated)
          void savePoem(updated).then(() => onPoemUpdated())
          speakLines(['已降一颗星'], () => setHighlightedLine(null), proceedToComplete)
        } else {
          proceedToComplete()
        }
      }, proceedToComplete)
    })
  } else {
    proceedToComplete()
  }
  return
}
```

Note: `poem` is already read earlier in `advanceReciteSentence` as `const poem = currentPoemRef.current` — this reuses that variable. If the existing code reads `poem` before this block, remove the duplicate `const poem` line in the replacement above.

- [ ] **Step 2: Verify `savePoem` is imported**

Check the top of `ListenTab.tsx` for:
```typescript
import { savePoem } from '../data/PoemLibrary'
```

It is already present (used in `handleLineEdit`). No change needed.

- [ ] **Step 3: Run tests**

```bash
npm run test
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/components/ListenTab.tsx
git commit -m "feat: ask to lower rating after recitation with wrong answers"
```

---

### Task 4: Verify `advanceReciteSentence` has no duplicate `poem` variable

**Files:**
- Modify: `src/components/ListenTab.tsx`

- [ ] **Step 1: Check for duplicate `const poem`**

Read the full `advanceReciteSentence` function. The existing code reads `const poem = currentPoemRef.current` near the top. The replacement in Task 3 also references `poem`. Confirm there is only ONE `const poem` declaration in the function — the existing one near the top covers the new usage.

The existing function:
```typescript
function advanceReciteSentence(nextIndex: number) {
  setRecognizedText('')
  const poem = currentPoemRef.current   // ← this covers the new usage too
  if (!poem) return
  const sentences = getReciteSentences(poem)
  if (nextIndex >= sentences.length) {
    // ... new block from Task 3 uses `poem` from above
  }
  ...
}
```

If Task 3's replacement block included a redundant `const poem = currentPoemRef.current`, remove it now.

- [ ] **Step 2: Run full test suite and type-check**

```bash
npm run test && npx tsc -b --noEmit
```

Expected: all tests pass, zero TypeScript errors.

- [ ] **Step 3: Commit if any cleanup was needed (skip if no changes)**

```bash
git add src/components/ListenTab.tsx
git commit -m "fix: remove duplicate poem variable in advanceReciteSentence"
```

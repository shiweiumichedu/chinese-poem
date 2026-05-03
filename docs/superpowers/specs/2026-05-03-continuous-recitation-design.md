# Continuous Recitation & Revised Retry Flow

**Date:** 2026-05-03  
**Scope:** `src/components/ListenTab.tsx` only

---

## Feature 1 — 连续背诵 (continuous recitation)

When both 连续 (`autoPlay`) and 背诵 (`reciting`) are active, finishing the current poem's recitation automatically advances to the next poem and starts reciting it.

### Trigger

Both completion paths in `beginReciteListening` that speak `背诵完成` and then call `stopRecitingSession()` are replaced with a call to a new `handleReciteComplete()` function.

### `handleReciteComplete()`

1. Call `stopRecitingSession()` to reset recite state.
2. If `autoPlayRef.current` is false — stop here (same as current behaviour).
3. If true:
   - Call `getNextPoem()` (existing function — same rating-filter + wrap-around logic).
   - If no next poem — stop.
   - Call `setPoem(next)`.
   - `speakLines([next.title + '，' + next.author], …)` — title/author announcement.
   - On announcement done, wait `AUTHOR_PAUSE_BASE_MS * getAuthorPauseMultiplier(ttsRate)` ms.
   - Call `startReciting()`.

---

## Feature 2 — Revised recitation retry flow

Replace the 3-retry loop (`MAX_RECITE_RETRIES`) with a single correction cycle.

### Normal path (first-try correct)

- Advance: say "下X句" (replaces current "第X句"). No feedback spoken (same as today).

### Wrong on first try

1. Say "重复".
2. Speak the correct sentence.
3. Call `listenForCorrection(sentenceIndex)`.

### `listenForCorrection(sentenceIndex)`

Calls `startListening(onResult, onIdle)` with both callbacks:

| Outcome | Response |
|---|---|
| **Correct** | Say "正确" → advance with "下X句" |
| **Wrong** | Say "还是不对，请自己纠正" → advance with "下X句" |
| **No input** (`onIdle`) | Say "请背诵此句" → loop: call `listenForCorrection(sentenceIndex)` again |

"Advance" means: if `sentenceIndex + 1 >= sentences.length`, call `handleReciteComplete()`; otherwise say "下X句" and call `beginReciteListening(nextIndex)`.

### Advance helper

Extract an `advanceReciteSentence(nextIndex)` helper used by both the normal path and the correction path to avoid duplication:

```
advanceReciteSentence(nextIndex):
  if nextIndex >= sentences.length:
    speakLines(['背诵完成'], …, handleReciteComplete)
  else:
    setReciteSentenceIndex(nextIndex)
    speakLines([`下${toChineseNumber(nextIndex + 1)}句`], …, () => beginReciteListening(nextIndex))
```

### Removed

- `MAX_RECITE_RETRIES` constant and all retry-count state (`reciteRetryCount`, `setReciteRetryCount`, `reciteRetryCountRef`).

---

## Files changed

| File | Change |
|---|---|
| `src/components/ListenTab.tsx` | All changes — new functions, revised retry logic, removed retry state |

No changes to `PoemPlayer`, `VoiceController`, types, or tests.

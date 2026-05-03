---
title: Recitation Rating Upgrade
date: 2026-05-03
status: approved
---

## Summary

After a recitation session where the user answered every sentence correctly on the first try (no "重复" was ever spoken), and the poem is rated below 5 stars, ask the user "要不要加颗星". If they confirm, increment the poem's rating by 1.

## Context

`ListenTab` already asks "要不要降一颗星" when the user fails a correction attempt (`hasWrongAnswerRef`). This feature adds the symmetric upgrade path.

## State

Add one new ref to `ListenTab`:

- `hasRepeatRef: MutableRefObject<boolean>` — set to `true` in `beginReciteListening` immediately before the TTS says "重复". Reset to `false` in `startReciting` and `stopRecitingSession`.

## End-of-session logic (`advanceReciteSentence`)

When `nextIndex >= sentences.length`, evaluate in order:

1. `hasWrongAnswerRef.current && (poem.rating ?? 0) >= 2` → ask "要不要降一颗星" (existing, unchanged)
2. `!hasRepeatRef.current && (poem.rating ?? 0) < 5` → ask "要不要加颗星" (new)
3. Otherwise → `proceedToComplete()` directly

These two branches are mutually exclusive: a failed second attempt (`hasWrongAnswer = true`) can only occur after a failed first attempt (`hasRepeat = true`), so branch 2 can never fire when branch 1 would.

## "Add star" flow

```
speak "要不要加颗星"
  → startListening
      yes → update rating +1, savePoem, onPoemUpdated, speak "已加一颗星" → proceedToComplete
      no  → proceedToComplete
    idle  → proceedToComplete
```

Rating is capped at 5 by the branch condition (`rating < 5`), so no overflow guard is needed.

## Files changed

- `src/components/ListenTab.tsx` — only file modified

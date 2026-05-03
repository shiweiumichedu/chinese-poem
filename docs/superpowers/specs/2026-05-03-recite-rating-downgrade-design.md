# Design: Recitation Rating Downgrade Prompt

**Date:** 2026-05-03

## Overview

When a user completes a 背诵 (recitation) session and at least one sentence was marked "还是不对" (still wrong after correction), the app asks via voice "要不要降一颗星？" at the end of the poem. If the user says yes, the poem's rating is decreased by one star and saved.

## Trigger Condition

- At least one "还是不对" occurred during the current recitation session
- The poem has a defined rating ≥ 2 (rating of 1 cannot go lower; unrated poems are skipped)

## State Change

**New ref:** `hasWrongAnswerRef = useRef(false)` in `ListenTab`

- Reset to `false` in `startReciting()` — fresh for each new recitation
- Reset to `false` in `stopRecitingSession()` — cleared on any stop
- Set to `true` in `listenForCorrection()` when "还是不对" is about to be spoken

## Flow

### Modified: `listenForCorrection`

Before calling `speakLines(['还是不对，请自己纠正'], ...)`, set `hasWrongAnswerRef.current = true`.

### Modified: `advanceReciteSentence`

When `nextIndex >= sentences.length` (all sentences done), before speaking "背诵完成":

```
if hasWrongAnswerRef AND poem.rating >= 2:
  speakLines(['要不要降一颗星？'])
  startListening(response):
    if isYes(response):
      decrease rating by 1, savePoem, onPoemUpdated()
      speakLines(['已降一颗星'])
    // no response or "不" → skip silently
  → then speakLines(['背诵完成']) → handleReciteComplete
else:
  speakLines(['背诵完成']) → handleReciteComplete
```

### Yes/No Detection (`isYes`)

A spoken response is "yes" if it contains any of 是/要/降/对 AND does not contain 不.

Everything else (contains 不, silence timeout → `onIdle`, unrecognized) is treated as no and skipped silently.

## Data Flow

Rating update follows the same pattern as line edits:
1. Compute updated `SavedPoem` with `rating - 1`
2. Call `setPoem(updated)` to update local state
3. Call `savePoem(updated)` to persist to IndexedDB
4. Call `onPoemUpdated()` to refresh library

## Error Handling

- If `startListening` fires `onIdle` (no speech detected): treat as no, proceed to "背诵完成" silently
- If rating would go below 1: condition guards prevent the question from being asked
- If poem has no rating (`undefined`): condition guards prevent the question from being asked

## Files Changed

- `src/components/ListenTab.tsx` — all changes contained here

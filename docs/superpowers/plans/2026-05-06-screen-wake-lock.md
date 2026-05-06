# Screen Wake Lock Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the iPhone screen on during 朗读 and 背诵 sessions by wiring `@capacitor-community/keep-awake` to the existing active-state flag in `ListenTab`.

**Architecture:** A new `useWakeLock(active: boolean)` hook wraps the plugin calls in a `useEffect`; `ListenTab` calls it with `voiceState !== 'idle' || reciting`. No other files change.

**Tech Stack:** React (hooks), `@capacitor-community/keep-awake`, Vitest + `@testing-library/react`

---

## File Map

| Action | Path |
|--------|------|
| Create | `src/hooks/useWakeLock.ts` |
| Create | `tests/hooks/useWakeLock.test.ts` |
| Modify | `src/components/ListenTab.tsx` (add one import + one hook call) |

---

## Task 1: Install the plugin

- [ ] **Step 1: Install npm package**

```bash
npm install @capacitor-community/keep-awake
```

Expected output includes a line like:
```
added 1 package
```

- [ ] **Step 2: Sync native project**

```bash
npx cap sync
```

Expected: ends with `Sync finished` (or equivalent Capacitor 8 message). This updates `ios/App/Podfile.lock` and the Xcode project.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json ios/
git commit -m "chore: install @capacitor-community/keep-awake"
```

---

## Task 2: Write the failing tests for `useWakeLock`

**Files:**
- Create: `tests/hooks/useWakeLock.test.ts`

- [ ] **Step 1: Create the test file**

```ts
// tests/hooks/useWakeLock.test.ts
import { renderHook, act } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'

const keepAwake = vi.fn()
const allowSleep = vi.fn()

vi.mock('@capacitor-community/keep-awake', () => ({
  KeepAwake: { keepAwake, allowSleep },
}))

import { useWakeLock } from '../../src/hooks/useWakeLock'

beforeEach(() => {
  keepAwake.mockClear()
  allowSleep.mockClear()
})

describe('useWakeLock', () => {
  it('calls nothing when active starts false', () => {
    renderHook(() => useWakeLock(false))
    expect(keepAwake).not.toHaveBeenCalled()
    expect(allowSleep).not.toHaveBeenCalled()
  })

  it('calls keepAwake when active becomes true', () => {
    const { rerender } = renderHook(({ active }) => useWakeLock(active), {
      initialProps: { active: false },
    })
    act(() => { rerender({ active: true }) })
    expect(keepAwake).toHaveBeenCalledTimes(1)
    expect(allowSleep).not.toHaveBeenCalled()
  })

  it('calls allowSleep when active flips back to false', () => {
    const { rerender } = renderHook(({ active }) => useWakeLock(active), {
      initialProps: { active: true },
    })
    act(() => { rerender({ active: false }) })
    expect(allowSleep).toHaveBeenCalledTimes(1)
  })

  it('calls allowSleep on unmount while active', () => {
    const { unmount } = renderHook(() => useWakeLock(true))
    unmount()
    expect(allowSleep).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npx vitest run tests/hooks/useWakeLock.test.ts
```

Expected: all 4 tests fail with something like `Cannot find module '../../src/hooks/useWakeLock'`.

---

## Task 3: Implement `useWakeLock`

**Files:**
- Create: `src/hooks/useWakeLock.ts`

- [ ] **Step 1: Create the hook**

```ts
// src/hooks/useWakeLock.ts
import { useEffect } from 'react'
import { KeepAwake } from '@capacitor-community/keep-awake'

export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active) return
    KeepAwake.keepAwake().catch((e) => console.warn('keepAwake failed', e))
    return () => {
      KeepAwake.allowSleep().catch((e) => console.warn('allowSleep failed', e))
    }
  }, [active])
}
```

- [ ] **Step 2: Run the tests to verify they pass**

```bash
npx vitest run tests/hooks/useWakeLock.test.ts
```

Expected:
```
 ✓ tests/hooks/useWakeLock.test.ts (4)
```

- [ ] **Step 3: Run the full test suite to check for regressions**

```bash
npm run test
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useWakeLock.ts tests/hooks/useWakeLock.test.ts
git commit -m "feat: add useWakeLock hook with keep-awake plugin"
```

---

## Task 4: Wire `useWakeLock` into `ListenTab`

**Files:**
- Modify: `src/components/ListenTab.tsx`

`ListenTab.tsx` already declares `voiceState` (prop, line 73) and `reciting` (state, line 103). The hook call goes after the existing `useState`/`useRef` declarations.

- [ ] **Step 1: Add the import**

In `src/components/ListenTab.tsx`, add to the existing import block at the top of the file (after the other local hook imports):

```ts
import { useWakeLock } from '../hooks/useWakeLock'
```

- [ ] **Step 2: Add the hook call**

Directly after the `useState`/`useRef` declarations block (around line 128), add:

```ts
useWakeLock(voiceState !== 'idle' || reciting)
```

- [ ] **Step 3: Run the full test suite**

```bash
npm run test
```

Expected: all tests pass (no `ListenTab` render tests should break since no props or UI changed).

- [ ] **Step 4: Run TypeScript check**

```bash
npm run build
```

Expected: completes without type errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/ListenTab.tsx
git commit -m "feat: keep screen awake during 朗读 and 背诵"
```

---

## Task 5: Device verification (manual)

After the above commits:

- [ ] **Step 1: Open in Xcode and rebuild**

```bash
npx cap open ios
```

In Xcode: Product → Clean Build Folder, then Run on a real device (simulator does not test screen sleep).

- [ ] **Step 2: Verify screen stays on during 朗读**

  1. Open the app, select a poem, tap 朗读.
  2. Leave the phone on a desk for longer than the system auto-lock duration (Settings → Display & Brightness → Auto-Lock).
  3. Screen must stay on while TTS is reading.

- [ ] **Step 3: Verify screen stays on during 背诵**

  1. Tap 背诵 to start a recitation session.
  2. Wait past the auto-lock duration.
  3. Screen must stay on.

- [ ] **Step 4: Verify screen sleeps normally when idle**

  1. Stop playback (tap stop or let it finish).
  2. Wait past the auto-lock duration.
  3. Screen must turn off normally.

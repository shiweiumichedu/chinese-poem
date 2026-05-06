# Screen Wake Lock Design

**Date:** 2026-05-06
**Status:** Approved

## Problem

During 朗读 (read-aloud) and 背诵 (recitation) sessions the iPhone screen turns off due to inactivity, interrupting the user experience.

## Goal

Keep the screen on for the entire duration of an active 朗读 or 背诵 session, releasing the lock as soon as the session ends.

## Approach

Use `@capacitor-community/keep-awake` — a native Capacitor plugin that calls `UIApplication.shared.isIdleTimerDisabled` on iOS. Chosen over the Web Screen Wake Lock API because that API only landed in Safari 16.4, and the app targets all of iOS 16.x.

## Components

### `src/hooks/useWakeLock.ts` (new)

Signature:
```ts
function useWakeLock(active: boolean): void
```

Behaviour:
- `useEffect` watches `active`.
- When `active` becomes `true`: call `KeepAwake.keepAwake()`.
- When `active` becomes `false` or the component unmounts: call `KeepAwake.allowSleep()`.
- Errors from either call are caught and logged with `console.warn` — a plugin failure must never crash the UI.

### `src/components/ListenTab.tsx` (modified)

Add one line near the top of the component body:

```ts
useWakeLock(voiceState !== 'idle' || reciting)
```

`voiceState !== 'idle' || reciting` is already the canonical "something active is happening" expression used for the `isPlaying` prop — reusing it keeps the wake-lock condition in sync with the UI automatically.

No prop changes to `ListenTab`, `PoemPlayer`, `App`, or the voice layer.

## Data Flow

```
voiceState / reciting change
  → useWakeLock(active) re-runs effect
    → active true  → KeepAwake.keepAwake()   (screen stays on)
    → active false → KeepAwake.allowSleep()  (screen resumes normal timeout)
    → unmount      → KeepAwake.allowSleep()  (cleanup)
```

## Error Handling

- `keepAwake()` / `allowSleep()` failures are caught and logged; they do not propagate.
- The plugin is unavailable on web (non-Capacitor) builds; the hook must guard with a try/catch so the web dev server continues to work.

## Testing

File: `tests/hooks/useWakeLock.test.ts`

Mock `@capacitor-community/keep-awake`. Cases:
1. `active` starts `false` → neither method called.
2. `active` flips `true` → `keepAwake` called once.
3. `active` flips `false` after being `true` → `allowSleep` called.
4. Component unmounts while `active` is `true` → `allowSleep` called in cleanup.

## Installation Steps

```bash
npm install @capacitor-community/keep-awake
npx cap sync
```

After `cap sync`, rebuild in Xcode before testing on device.

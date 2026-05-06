import { renderHook } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

vi.mock('@capacitor-community/keep-awake', () => ({
  KeepAwake: { keepAwake: vi.fn(), allowSleep: vi.fn() },
}))

import { KeepAwake } from '@capacitor-community/keep-awake'
import { useWakeLock } from '../../src/hooks/useWakeLock'

let mockKeepAwake: ReturnType<typeof vi.spyOn>
let mockAllowSleep: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  if (mockKeepAwake) mockKeepAwake.mockRestore()
  if (mockAllowSleep) mockAllowSleep.mockRestore()
  mockKeepAwake = vi.spyOn(KeepAwake, 'keepAwake').mockResolvedValue(undefined)
  mockAllowSleep = vi.spyOn(KeepAwake, 'allowSleep').mockResolvedValue(undefined)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useWakeLock', () => {
  it('calls nothing when active starts false', () => {
    renderHook(() => useWakeLock(false))
    expect(mockKeepAwake).not.toHaveBeenCalled()
    expect(mockAllowSleep).not.toHaveBeenCalled()
  })

  it('calls keepAwake when active becomes true', () => {
    const { rerender } = renderHook(({ active }) => useWakeLock(active), {
      initialProps: { active: false },
    })
    rerender({ active: true })
    expect(mockKeepAwake).toHaveBeenCalledTimes(1)
    expect(mockAllowSleep).not.toHaveBeenCalled()
  })

  it('calls allowSleep when active flips back to false', () => {
    const { rerender } = renderHook(({ active }) => useWakeLock(active), {
      initialProps: { active: true },
    })
    rerender({ active: false })
    expect(mockAllowSleep).toHaveBeenCalledTimes(1)
  })

  it('calls allowSleep on unmount while active', () => {
    const { unmount } = renderHook(() => useWakeLock(true))
    unmount()
    expect(mockAllowSleep).toHaveBeenCalledTimes(1)
  })
})

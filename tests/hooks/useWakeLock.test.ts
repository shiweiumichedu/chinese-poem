import { renderHook, act } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

vi.mock('@capacitor-community/keep-awake')

import { KeepAwake } from '@capacitor-community/keep-awake'
import { useWakeLock } from '../../src/hooks/useWakeLock'

const mockKeepAwake = vi.fn().mockResolvedValue(undefined)
const mockAllowSleep = vi.fn().mockResolvedValue(undefined)

beforeEach(() => {
  vi.mocked(KeepAwake).keepAwake = mockKeepAwake
  vi.mocked(KeepAwake).allowSleep = mockAllowSleep
  mockKeepAwake.mockClear()
  mockAllowSleep.mockClear()
})

afterEach(() => {
  vi.clearAllMocks()
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
    act(() => { rerender({ active: true }) })
    expect(mockKeepAwake).toHaveBeenCalledTimes(1)
    expect(mockAllowSleep).not.toHaveBeenCalled()
  })

  it('calls allowSleep when active flips back to false', () => {
    const { rerender } = renderHook(({ active }) => useWakeLock(active), {
      initialProps: { active: true },
    })
    act(() => { rerender({ active: false }) })
    expect(mockAllowSleep).toHaveBeenCalledTimes(1)
  })

  it('calls allowSleep on unmount while active', () => {
    const { unmount } = renderHook(() => useWakeLock(true))
    unmount()
    expect(mockAllowSleep).toHaveBeenCalledTimes(1)
  })
})

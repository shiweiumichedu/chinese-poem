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

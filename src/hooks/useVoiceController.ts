import { useRef, useState, useCallback } from 'react'
import { createVoiceController } from '../voice/VoiceController'
import type { VoiceController } from '../voice/VoiceController'
import type { VoiceState } from '../types'

export function useVoiceController() {
  const controllerRef = useRef<VoiceController | null>(null)
  const [voiceState, setVoiceState] = useState<VoiceState>('idle')

  const getController = useCallback((): VoiceController => {
    if (!controllerRef.current) {
      controllerRef.current = createVoiceController()
    }
    return controllerRef.current
  }, [])

  const startListening = useCallback((onResult: (text: string) => void) => {
    const ctrl = getController()
    ctrl.startListening((text) => {
      setVoiceState('idle')
      onResult(text)
    })
    setVoiceState(ctrl.state)  // reflects actual state (may still be 'idle' if unsupported)
  }, [getController])

  const speakLines = useCallback((
    lines: string[],
    onLineStart: (index: number) => void,
    onDone: () => void
  ) => {
    const ctrl = getController()
    ctrl.speakLines(lines, onLineStart, () => {
      setVoiceState('idle')
      onDone()
    })
    setVoiceState(ctrl.state)  // 'speaking' or 'idle' if lines was empty
  }, [getController])

  const stop = useCallback(() => {
    getController().stop()
    setVoiceState('idle')
  }, [getController])

  return {
    voiceState,
    startListening,
    speakLines,
    stop,
    isSTTSupported: () => getController().isSTTSupported(),
    isTTSSupported: () => getController().isTTSSupported(),
  }
}

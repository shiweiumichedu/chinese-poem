import { useRef, useState, useCallback, useEffect } from 'react'
import { createVoiceController } from '../voice/VoiceController'
import type { VoiceController } from '../voice/VoiceController'
import type { VoiceState } from '../types'

const RATE_KEY = 'tts-rate'

export function useVoiceController() {
  const controllerRef = useRef<VoiceController | null>(null)
  const [voiceState, setVoiceState] = useState<VoiceState>('idle')
  const [ttsRate, setTtsRateState] = useState<number>(() => {
    const stored = localStorage.getItem(RATE_KEY)
    const parsed = parseFloat(stored ?? '')
    return Number.isFinite(parsed) ? parsed : 1.0
  })
  const ttsRateRef = useRef(ttsRate)
  useEffect(() => { ttsRateRef.current = ttsRate }, [ttsRate])

  const getController = useCallback((): VoiceController => {
    if (!controllerRef.current) {
      controllerRef.current = createVoiceController()
    }
    return controllerRef.current
  }, [])

  const setTtsRate = useCallback((rate: number) => {
    localStorage.setItem(RATE_KEY, String(rate))
    ttsRateRef.current = rate
    setTtsRateState(rate)
  }, [])

  const startListening = useCallback((onResult: (text: string) => void) => {
    const ctrl = getController()
    ctrl.startListening(
      (text) => { setVoiceState('idle'); onResult(text) },
      () => setVoiceState('idle')
    )
    setVoiceState(ctrl.state)
  }, [getController])

  const speakLines = useCallback((
    lines: string[],
    onLineStart: (index: number) => void,
    onDone: () => void,
    lang?: string
  ) => {
    const ctrl = getController()
    ctrl.speakLines(lines, onLineStart, () => {
      setVoiceState('idle')
      onDone()
    }, ttsRateRef.current, lang)
    setVoiceState(ctrl.state)
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
    ttsRate,
    setTtsRate,
  }
}

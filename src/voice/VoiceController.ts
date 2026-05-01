import type { VoiceState } from '../types'

export interface VoiceController {
  state: VoiceState
  startListening(onResult: (text: string) => void): void
  speakLines(lines: string[], onLineStart: (index: number) => void, onDone: () => void): void
  stop(): void
  isSTTSupported(): boolean
  isTTSSupported(): boolean
}

export function createVoiceController(): VoiceController {
  let state: VoiceState = 'idle'
  let recognition: SpeechRecognition | null = null

  const SpeechRecognitionClass =
    (window.SpeechRecognition as typeof SpeechRecognition | undefined) ??
    (window.webkitSpeechRecognition as typeof SpeechRecognition | undefined)

  return {
    get state() { return state },

    isSTTSupported() {
      return !!SpeechRecognitionClass
    },

    isTTSSupported() {
      return typeof window.speechSynthesis !== 'undefined'
    },

    startListening(onResult) {
      if (!SpeechRecognitionClass) return
      state = 'listening'
      recognition = new SpeechRecognitionClass()
      recognition.lang = 'zh-CN'
      recognition.continuous = false
      recognition.interimResults = false
      recognition.onresult = (event) => {
        const text = event.results[0][0].transcript
        state = 'idle'
        onResult(text)
      }
      recognition.onerror = () => { state = 'idle' }
      recognition.onend = () => { if (state === 'listening') state = 'idle' }
      recognition.start()
    },

    speakLines(lines, onLineStart, onDone) {
      if (!window.speechSynthesis || lines.length === 0) {
        onDone()
        return
      }
      window.speechSynthesis.cancel()
      state = 'speaking'

      let index = 0

      const speakNext = () => {
        if (index >= lines.length) {
          state = 'idle'
          onDone()
          return
        }
        const utterance = new SpeechSynthesisUtterance(lines[index])
        utterance.lang = 'zh-CN'
        utterance.onstart = () => onLineStart(index)
        utterance.onend = () => {
          index++
          speakNext()
        }
        utterance.onerror = () => {
          state = 'idle'
          onDone()
        }
        window.speechSynthesis.speak(utterance)
      }

      speakNext()
    },

    stop() {
      if (recognition) {
        recognition.abort()
        recognition = null
      }
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel()
      }
      state = 'idle'
    },
  }
}

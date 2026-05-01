import type { VoiceState } from '../types'

export interface VoiceController {
  state: VoiceState
  startListening(onResult: (text: string) => void, onIdle?: () => void): void
  speakLines(lines: string[], onLineStart: (index: number) => void, onDone: () => void, rate?: number): void
  stop(): void
  isSTTSupported(): boolean
  isTTSSupported(): boolean
}

// Preferred Mandarin voices in priority order (macOS, iOS, Edge neural)
const ZH_VOICE_PRIORITY = ['Tingting', 'Ting-Ting', 'zh-CN-XiaoxiaoNeural', 'Meijia']

function pickZhVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis?.getVoices?.() ?? []
  if (voices.length === 0) return null
  for (const name of ZH_VOICE_PRIORITY) {
    const v = voices.find(v => v.name === name || v.name.includes(name))
    if (v) return v
  }
  return voices.find(v => v.lang === 'zh-CN' || v.lang === 'zh_CN')
    ?? voices.find(v => v.lang.startsWith('zh'))
    ?? null
}

export function createVoiceController(): VoiceController {
  let state: VoiceState = 'idle'
  let recognition: SpeechRecognition | null = null
  let speakGeneration = 0

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

    startListening(onResult, onIdle?) {
      if (!SpeechRecognitionClass) return
      // Abort any existing session before starting a new one
      if (recognition) {
        recognition.abort()
        recognition = null
      }
      state = 'listening'
      recognition = new SpeechRecognitionClass()
      recognition.lang = 'zh-CN'
      recognition.continuous = false
      recognition.interimResults = false
      recognition.onresult = (event: SpeechRecognitionEvent) => {
        const text = event.results[0][0].transcript
        state = 'idle'
        onResult(text)
      }
      recognition.onerror = () => { state = 'idle'; onIdle?.() }
      recognition.onend = () => { if (state === 'listening') { state = 'idle'; onIdle?.() } }
      try {
        recognition.start()
      } catch {
        state = 'idle'
        recognition = null
      }
    },

    speakLines(lines, onLineStart, onDone, rate = 1.0) {
      if (!window.speechSynthesis || lines.length === 0) {
        onDone()
        return
      }
      window.speechSynthesis.cancel()
      state = 'speaking'
      const generation = ++speakGeneration  // this call's unique ID

      let index = 0

      const speakNext = () => {
        if (generation !== speakGeneration) return  // superseded by a newer call
        if (index >= lines.length) {
          state = 'idle'
          onDone()
          return
        }
        const utterance = new SpeechSynthesisUtterance(lines[index])
        utterance.lang = 'zh-CN'
        utterance.rate = rate
        const voice = pickZhVoice()
        if (voice) utterance.voice = voice
        utterance.onstart = () => {
          if (generation === speakGeneration) onLineStart(index)
        }
        utterance.onend = () => {
          index++
          speakNext()
        }
        utterance.onerror = () => {
          if (generation !== speakGeneration) return
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

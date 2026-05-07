import type { VoiceState } from '../types'
import { Capacitor } from '@capacitor/core'
import { SpeechRecognition as NativeSpeechRecognition } from '@capacitor-community/speech-recognition'

const INTER_LINE_PAUSE_BASE_MS = 250

function getInterLinePauseMultiplier(rate: number): number {
  if (rate <= 0.25) return 4
  if (rate <= 0.4) return 3
  if (rate <= 0.7) return 2
  return 1
}

export interface VoiceController {
  state: VoiceState
  startListening(onResult: (text: string) => void, onIdle?: () => void): void
  speakLines(lines: string[], onLineStart: (index: number) => void, onDone: () => void, rate?: number, lang?: string): void
  stop(): void
  isSTTSupported(): boolean
  isTTSSupported(): boolean
}

export function createVoiceController(): VoiceController {
  let state: VoiceState = 'idle'
  let recognition: SpeechRecognition | null = null
  let speakGeneration = 0
  let listenGeneration = 0

  const SpeechRecognitionClass =
    (window.SpeechRecognition as typeof SpeechRecognition | undefined) ??
    (window.webkitSpeechRecognition as typeof SpeechRecognition | undefined)
  const isNativeApp = Capacitor.isNativePlatform()

  return {
    get state() { return state },

    isSTTSupported() {
      return !!SpeechRecognitionClass || isNativeApp
    },

    isTTSSupported() {
      return typeof window.speechSynthesis !== 'undefined'
    },

    startListening(onResult, onIdle?) {
      const currentListenGeneration = ++listenGeneration

      if (SpeechRecognitionClass) {
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
        return
      }

      if (isNativeApp) {
        state = 'listening'
        void (async () => {
          try {
            const available = await NativeSpeechRecognition.available()
            if (!available.available) {
              state = 'idle'
              onIdle?.()
              return
            }

            const permission = await NativeSpeechRecognition.requestPermissions()
            if (permission.speechRecognition !== 'granted') {
              state = 'idle'
              onIdle?.()
              return
            }

            await NativeSpeechRecognition.removeAllListeners()
            await NativeSpeechRecognition.addListener('partialResults', (data) => {
              if (currentListenGeneration !== listenGeneration) return
              const text = data.matches?.[0]
              if (!text) return
              state = 'idle'
              void NativeSpeechRecognition.stop()
              void NativeSpeechRecognition.removeAllListeners()
              onResult(text)
            })

            await NativeSpeechRecognition.addListener('listeningState', (data) => {
              if (currentListenGeneration !== listenGeneration) return
              if (data.status === 'stopped' && state === 'listening') {
                state = 'idle'
                onIdle?.()
              }
            })

            const directResult = await NativeSpeechRecognition.start({
              language: 'zh-CN',
              maxResults: 1,
              partialResults: true,
              popup: false,
            })

            const text = directResult.matches?.[0]
            if (text && currentListenGeneration === listenGeneration) {
              state = 'idle'
              void NativeSpeechRecognition.stop()
              void NativeSpeechRecognition.removeAllListeners()
              onResult(text)
            }
          } catch {
            if (currentListenGeneration !== listenGeneration) return
            state = 'idle'
            onIdle?.()
          }
        })()
      }
    },

    speakLines(lines, onLineStart, onDone, rate = 1.0, lang) {
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
        const synthesis = window.speechSynthesis
        if (!synthesis) {
          state = 'idle'
          onDone()
          return
        }
        if (index >= lines.length) {
          state = 'idle'
          onDone()
          return
        }
        // Resume if paused (Chrome bug: focus changes can pause synthesis)
        if (synthesis.paused && typeof synthesis.resume === 'function') {
          synthesis.resume()
        }
        const utterance = new SpeechSynthesisUtterance(lines[index])
        utterance.lang = lang ?? 'zh-CN'
        utterance.rate = rate
        utterance.onstart = () => {
          if (generation === speakGeneration) onLineStart(index)
        }
        utterance.onend = () => {
          index++
          if (index >= lines.length) {
            speakNext()
            return
          }
          const pauseMs = INTER_LINE_PAUSE_BASE_MS * getInterLinePauseMultiplier(rate)
          setTimeout(speakNext, pauseMs)
        }
        utterance.onerror = () => {
          if (generation !== speakGeneration) return
          state = 'idle'
          onDone()
        }
        synthesis.speak(utterance)
      }

      // Chrome bug: speak() called immediately after cancel() in the same tick
      // often silently fails — a zero-delay timeout lets cancel() settle first.
      setTimeout(speakNext, 0)
    },

    stop() {
      listenGeneration++
      if (recognition) {
        recognition.abort()
        recognition = null
      }
      if (isNativeApp) {
        void NativeSpeechRecognition.stop()
        void NativeSpeechRecognition.removeAllListeners()
      }
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel()
      }
      state = 'idle'
    },
  }
}

import { createVoiceController } from '../../src/voice/VoiceController'

// Mock SpeechRecognition
class MockSpeechRecognition {
  lang = ''
  continuous = false
  interimResults = false
  onresult: ((e: SpeechRecognitionEvent) => void) | null = null
  onerror: (() => void) | null = null
  onend: (() => void) | null = null
  start = vi.fn()
  abort = vi.fn()
}

// Mock SpeechSynthesis
const mockSpeak = vi.fn()
const mockCancel = vi.fn()

// Typed helper to set window properties in tests without `any`
function setWindowProp<K extends string>(key: K, value: unknown) {
  (window as unknown as Record<string, unknown>)[key] = value
}
function deleteWindowProp<K extends string>(key: K) {
  delete (window as unknown as Record<string, unknown>)[key]
}

beforeEach(() => {
  vi.clearAllMocks()
  // Install mocks on window
  setWindowProp('SpeechRecognition', MockSpeechRecognition)
  setWindowProp('webkitSpeechRecognition', undefined)
  setWindowProp('speechSynthesis', { speak: mockSpeak, cancel: mockCancel })
})

afterEach(() => {
  deleteWindowProp('SpeechRecognition')
  deleteWindowProp('speechSynthesis')
})

describe('VoiceController', () => {
  it('initial state is idle', () => {
    const ctrl = createVoiceController()
    expect(ctrl.state).toBe('idle')
  })

  it('isSTTSupported returns true when SpeechRecognition exists', () => {
    const ctrl = createVoiceController()
    expect(ctrl.isSTTSupported()).toBe(true)
  })

  it('isSTTSupported returns false when SpeechRecognition missing', () => {
    deleteWindowProp('SpeechRecognition')
    const ctrl = createVoiceController()
    expect(ctrl.isSTTSupported()).toBe(false)
  })

  it('isTTSSupported returns true when speechSynthesis exists', () => {
    const ctrl = createVoiceController()
    expect(ctrl.isTTSSupported()).toBe(true)
  })

  it('startListening sets state to listening and calls recognition.start()', () => {
    const ctrl = createVoiceController()
    ctrl.startListening(vi.fn())
    expect(ctrl.state).toBe('listening')
  })

  it('onresult callback delivers transcript and resets state', () => {
    let instance: MockSpeechRecognition | null = null
    setWindowProp('SpeechRecognition', class extends MockSpeechRecognition {
      constructor() {
        super()
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        instance = this
      }
    })
    const onResult = vi.fn()
    const ctrl2 = createVoiceController()
    ctrl2.startListening(onResult)

    // Simulate recognition result
    instance!.onresult!({
      results: [[{ transcript: '静夜思' }]] as unknown as SpeechRecognitionResultList,
    } as SpeechRecognitionEvent)

    expect(onResult).toHaveBeenCalledWith('静夜思')
    expect(ctrl2.state).toBe('idle')
  })

  it('stop() cancels recognition and TTS, resets state', () => {
    const ctrl = createVoiceController()
    ctrl.startListening(vi.fn())
    ctrl.stop()
    expect(ctrl.state).toBe('idle')
    expect(mockCancel).toHaveBeenCalled()
  })

  it('speakLines calls speechSynthesis.speak once per line', () => {
    const ctrl = createVoiceController()
    const lines = ['床前明月光', '疑是地上霜']

    // Mock SpeechSynthesisUtterance
    setWindowProp('SpeechSynthesisUtterance', class {
      text: string
      lang = ''
      onstart: (() => void) | null = null
      onend: (() => void) | null = null
      onerror: (() => void) | null = null
      constructor(text: string) {
        this.text = text
      }
    })
    // speak() does NOT auto-trigger onend — we verify synchronous behaviour only
    const onLineStart = vi.fn()
    ctrl.speakLines(lines, onLineStart, vi.fn())

    expect(mockSpeak).toHaveBeenCalledTimes(1) // first line queued immediately
    expect(ctrl.state).toBe('speaking')
  })

  it('speakLines chains utterances sequentially and fires onLineStart per line', () => {
    type MockUtt = { text: string; lang: string; onstart: (() => void) | null; onend: (() => void) | null; onerror: (() => void) | null }
    const utts: MockUtt[] = []
    setWindowProp('SpeechSynthesisUtterance', class {
      text: string; lang = ''; onstart: (() => void) | null = null
      onend: (() => void) | null = null; onerror: (() => void) | null = null
      constructor(t: string) { this.text = t; utts.push(this) }
    })
    const onLineStart = vi.fn()
    const onDone = vi.fn()
    const ctrl = createVoiceController()

    ctrl.speakLines(['床前明月光', '疑是地上霜'], onLineStart, onDone)

    expect(mockSpeak).toHaveBeenCalledTimes(1)
    utts[0].onstart!()
    expect(onLineStart).toHaveBeenCalledWith(0)

    utts[0].onend!()
    expect(mockSpeak).toHaveBeenCalledTimes(2)
    utts[1].onstart!()
    expect(onLineStart).toHaveBeenCalledWith(1)

    utts[1].onend!()
    expect(onDone).toHaveBeenCalledTimes(1)
    expect(ctrl.state).toBe('idle')
  })

  it('double startListening aborts old session before starting new one', () => {
    const instances: MockSpeechRecognition[] = []
    setWindowProp('SpeechRecognition', class extends MockSpeechRecognition {
      constructor() {
        super()
        instances.push(this)
      }
    })

    const ctrl = createVoiceController()
    ctrl.startListening(vi.fn())
    const first = instances[0]
    ctrl.startListening(vi.fn())

    expect(first.abort).toHaveBeenCalledTimes(1)
    expect(ctrl.state).toBe('listening')
  })

  it('speakLines called while speaking does not call old onDone', () => {
    setWindowProp('SpeechSynthesisUtterance', class {
      text = ''; lang = ''; onstart = null; onend = null; onerror: ((e: SpeechSynthesisErrorEvent) => void) | null = null
      constructor(t: string) { this.text = t }
    })
    const onDone1 = vi.fn()
    const onDone2 = vi.fn()
    const ctrl = createVoiceController()

    ctrl.speakLines(['第一首'], vi.fn(), onDone1)
    // Call again immediately (interrupts first)
    ctrl.speakLines(['第二首'], vi.fn(), onDone2)

    // onDone1 should NOT be called (its generation was superseded)
    expect(onDone1).not.toHaveBeenCalled()
  })
})

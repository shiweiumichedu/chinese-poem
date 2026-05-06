# Reading Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add TTS speed presets (慢/正常/快) to PoemPlayer and a corpus browser with sub-tabs to LibraryTab.

**Architecture:** Rate flows from a `ttsRateRef` inside `useVoiceController` → passed to `VoiceController.speakLines(rate)` → set on each `SpeechSynthesisUtterance`. LibraryTab gains local `activeSubTab` state and a memoized browse result list filtered from the 40k corpus.

**Tech Stack:** React 19, TypeScript, Vitest, React Testing Library, Web Speech API, CSS custom classes.

---

## File Map

| File | Change |
|------|--------|
| `src/voice/VoiceController.ts` | Add optional `rate` param to `speakLines` interface + implementation |
| `src/hooks/useVoiceController.ts` | Add `ttsRate` state, `ttsRateRef`, `setTtsRate` (localStorage persistence) |
| `src/components/PoemPlayer.tsx` | Add `ttsRate`/`setTtsRate` props, render speed preset buttons |
| `src/components/ListenTab.tsx` | Add `ttsRate`/`setTtsRate` props, forward to PoemPlayer |
| `src/App.tsx` | Destructure `ttsRate`/`setTtsRate` from hook, pass to ListenTab |
| `src/components/LibraryTab.tsx` | Add `activeSubTab` state, `browseQuery`, `useMemo` browse list, new UI |
| `src/styles.css` | Add CSS for speed presets, sub-tabs, browse section |
| `tests/voice/VoiceController.test.ts` | Add test: utterance.rate is set from parameter |
| `tests/components/PoemPlayer.test.tsx` | Add `ttsRate`/`setTtsRate` to all renders, add speed button tests |
| `tests/components/LibraryTab.test.tsx` | Update corpusLoading test, add browse sub-tab tests |

---

### Task 1: VoiceController — add `rate` parameter to `speakLines`

**Files:**
- Modify: `src/voice/VoiceController.ts`
- Test: `tests/voice/VoiceController.test.ts`

- [ ] **Step 1: Write the failing test**

Add this test inside the `describe('VoiceController', ...)` block in `tests/voice/VoiceController.test.ts`:

```ts
it('speakLines sets utterance.rate from the rate parameter', () => {
  type MockUtt = {
    text: string; lang: string; rate: number
    onstart: (() => void) | null; onend: (() => void) | null; onerror: (() => void) | null
  }
  const utts: MockUtt[] = []
  setWindowProp('SpeechSynthesisUtterance', class {
    text: string; lang = ''; rate = 1.0
    onstart: (() => void) | null = null
    onend: (() => void) | null = null
    onerror: (() => void) | null = null
    constructor(t: string) { this.text = t; utts.push(this) }
  })
  const ctrl = createVoiceController()
  ctrl.speakLines(['床前明月光'], vi.fn(), vi.fn(), 0.7)
  expect(utts[0].rate).toBe(0.7)
})

it('speakLines defaults utterance.rate to 1.0 when rate omitted', () => {
  type MockUtt = {
    text: string; lang: string; rate: number
    onstart: (() => void) | null; onend: (() => void) | null; onerror: (() => void) | null
  }
  const utts: MockUtt[] = []
  setWindowProp('SpeechSynthesisUtterance', class {
    text: string; lang = ''; rate = 1.0
    onstart: (() => void) | null = null
    onend: (() => void) | null = null
    onerror: (() => void) | null = null
    constructor(t: string) { this.text = t; utts.push(this) }
  })
  const ctrl = createVoiceController()
  ctrl.speakLines(['床前明月光'], vi.fn(), vi.fn())
  expect(utts[0].rate).toBe(1.0)
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/voice/VoiceController.test.ts
```

Expected: 2 new tests FAIL (property not set yet).

- [ ] **Step 3: Update the VoiceController interface and implementation**

In `src/voice/VoiceController.ts`, make these two changes:

Change the interface (line 6):
```ts
speakLines(lines: string[], onLineStart: (index: number) => void, onDone: () => void, rate?: number): void
```

Change the `speakLines` implementation — add `rate = 1.0` parameter and set it on the utterance:
```ts
speakLines(lines, onLineStart, onDone, rate = 1.0) {
  if (!window.speechSynthesis || lines.length === 0) {
    onDone()
    return
  }
  window.speechSynthesis.cancel()
  state = 'speaking'
  const generation = ++speakGeneration

  let index = 0

  const speakNext = () => {
    if (generation !== speakGeneration) return
    if (index >= lines.length) {
      state = 'idle'
      onDone()
      return
    }
    const utterance = new SpeechSynthesisUtterance(lines[index])
    utterance.lang = 'zh-CN'
    utterance.rate = rate
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/voice/VoiceController.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/voice/VoiceController.ts tests/voice/VoiceController.test.ts
git commit -m "feat: add rate parameter to VoiceController.speakLines"
```

---

### Task 2: useVoiceController — add `ttsRate` state and `setTtsRate`

**Files:**
- Modify: `src/hooks/useVoiceController.ts`

No unit test is added here — the hook's behaviour is tested end-to-end through PoemPlayer and VoiceController tests.

- [ ] **Step 1: Replace `src/hooks/useVoiceController.ts` with the full updated file**

```ts
import { useRef, useState, useCallback } from 'react'
import { createVoiceController } from '../voice/VoiceController'
import type { VoiceController } from '../voice/VoiceController'
import type { VoiceState } from '../types'

const RATE_KEY = 'tts-rate'

export function useVoiceController() {
  const controllerRef = useRef<VoiceController | null>(null)
  const [voiceState, setVoiceState] = useState<VoiceState>('idle')
  const [ttsRate, setTtsRateState] = useState<number>(() => {
    const stored = localStorage.getItem(RATE_KEY)
    return stored ? parseFloat(stored) : 1.0
  })
  const ttsRateRef = useRef(ttsRate)

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
    onDone: () => void
  ) => {
    const ctrl = getController()
    ctrl.speakLines(lines, onLineStart, () => {
      setVoiceState('idle')
      onDone()
    }, ttsRateRef.current)
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
```

- [ ] **Step 2: Run full test suite to confirm nothing broke**

```bash
npx vitest run
```

Expected: all tests PASS (no API surface changed yet, no callers updated yet — TypeScript will be checked in the next tasks).

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useVoiceController.ts
git commit -m "feat: add ttsRate state and setTtsRate to useVoiceController"
```

---

### Task 3: PoemPlayer — speed preset buttons

**Files:**
- Modify: `src/components/PoemPlayer.tsx`
- Test: `tests/components/PoemPlayer.test.tsx`

- [ ] **Step 1: Write the failing tests**

Replace the entire `tests/components/PoemPlayer.test.tsx` with the version below (all existing tests kept, new props added, new speed-button tests appended):

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { act } from 'react'
import { PoemPlayer } from '../../src/components/PoemPlayer'
import type { SavedPoem } from '../../src/types'

const poem: SavedPoem = {
  id: '1',
  title: '静夜思',
  author: '李白',
  dynasty: 'tang',
  authorBackground: '唐代伟大诗人',
  lines: ['床前明月光', '疑是地上霜', '举头望明月', '低头思故乡'],
  addedAt: 1000,
}

const defaultProps = {
  poem,
  onPlay: vi.fn(),
  onStop: vi.fn(),
  isPlaying: false,
  ttsRate: 1.0,
  setTtsRate: vi.fn(),
}

describe('PoemPlayer', () => {
  it('renders poem title, author, dynasty', () => {
    render(<PoemPlayer {...defaultProps} />)
    expect(screen.getByText('静夜思')).toBeInTheDocument()
    expect(screen.getByText(/李白/)).toBeInTheDocument()
    expect(screen.getByText(/李白.*唐/)).toBeInTheDocument()
  })

  it('renders all poem lines', () => {
    render(<PoemPlayer {...defaultProps} />)
    expect(screen.getByText('床前明月光')).toBeInTheDocument()
    expect(screen.getByText('低头思故乡')).toBeInTheDocument()
  })

  it('shows 朗读 button when not playing', () => {
    render(<PoemPlayer {...defaultProps} />)
    expect(screen.getByRole('button', { name: '朗读' })).toBeInTheDocument()
  })

  it('shows 停止 button when playing', () => {
    render(<PoemPlayer {...defaultProps} isPlaying={true} />)
    expect(screen.getByRole('button', { name: '停止' })).toBeInTheDocument()
  })

  it('calls onPlay with poem lines when 朗读 clicked', () => {
    const onPlay = vi.fn()
    render(<PoemPlayer {...defaultProps} onPlay={onPlay} />)
    fireEvent.click(screen.getByRole('button', { name: '朗读' }))
    expect(onPlay).toHaveBeenCalledWith(
      poem.lines,
      expect.any(Function),
      expect.any(Function)
    )
  })

  it('calls onStop when 停止 clicked', () => {
    const onStop = vi.fn()
    render(<PoemPlayer {...defaultProps} onStop={onStop} isPlaying={true} />)
    fireEvent.click(screen.getByRole('button', { name: '停止' }))
    expect(onStop).toHaveBeenCalled()
  })

  it('highlights the correct line during playback', () => {
    const onPlay = vi.fn()
    render(<PoemPlayer {...defaultProps} onPlay={onPlay} />)

    fireEvent.click(screen.getByRole('button', { name: '朗读' }))
    const [, onLineStart] = onPlay.mock.calls[0]
    act(() => { onLineStart(1) })

    const lines = document.querySelectorAll('.poem-line')
    expect(lines[1].className).toContain('highlighted')
    expect(lines[0].className).not.toContain('highlighted')
  })

  it('renders author background when present', () => {
    render(<PoemPlayer {...defaultProps} />)
    expect(screen.getByText('唐代伟大诗人')).toBeInTheDocument()
  })

  it('does not render author background section when empty', () => {
    render(<PoemPlayer {...defaultProps} poem={{ ...poem, authorBackground: '' }} />)
    expect(screen.queryByText('唐代伟大诗人')).not.toBeInTheDocument()
  })

  it('clears highlight when 停止 is clicked', () => {
    const onPlay = vi.fn()
    const { rerender } = render(<PoemPlayer {...defaultProps} onPlay={onPlay} />)
    fireEvent.click(screen.getByRole('button', { name: '朗读' }))
    const [, onLineStart] = onPlay.mock.calls[0]
    act(() => { onLineStart(2) })

    rerender(<PoemPlayer {...defaultProps} onPlay={onPlay} isPlaying={true} />)
    fireEvent.click(screen.getByRole('button', { name: '停止' }))

    const lines = document.querySelectorAll('.poem-line')
    lines.forEach(line => {
      expect(line.className).not.toContain('highlighted')
    })
  })

  it('clears highlight when playback completes (onDone)', () => {
    const onPlay = vi.fn()
    render(<PoemPlayer {...defaultProps} onPlay={onPlay} />)

    fireEvent.click(screen.getByRole('button', { name: '朗读' }))
    const [, onLineStart, onDone] = onPlay.mock.calls[0]
    act(() => { onLineStart(0) })

    const lines = document.querySelectorAll('.poem-line')
    expect(lines[0].className).toContain('highlighted')

    act(() => { onDone() })
    lines.forEach(line => {
      expect(line.className).not.toContain('highlighted')
    })
  })

  it('renders speed preset buttons 慢, 正常, 快', () => {
    render(<PoemPlayer {...defaultProps} />)
    expect(screen.getByRole('button', { name: '慢' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '正常' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '快' })).toBeInTheDocument()
  })

  it('marks the active speed preset with aria-pressed="true"', () => {
    render(<PoemPlayer {...defaultProps} ttsRate={0.7} />)
    expect(screen.getByRole('button', { name: '慢' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: '正常' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: '快' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('calls setTtsRate(0.7) when 慢 is clicked', () => {
    const setTtsRate = vi.fn()
    render(<PoemPlayer {...defaultProps} setTtsRate={setTtsRate} />)
    fireEvent.click(screen.getByRole('button', { name: '慢' }))
    expect(setTtsRate).toHaveBeenCalledWith(0.7)
  })

  it('calls setTtsRate(1.4) when 快 is clicked', () => {
    const setTtsRate = vi.fn()
    render(<PoemPlayer {...defaultProps} setTtsRate={setTtsRate} />)
    fireEvent.click(screen.getByRole('button', { name: '快' }))
    expect(setTtsRate).toHaveBeenCalledWith(1.4)
  })
})
```

- [ ] **Step 2: Run tests to verify new tests fail**

```bash
npx vitest run tests/components/PoemPlayer.test.tsx
```

Expected: new speed-button tests FAIL (props/UI not added yet). Existing tests may fail too if TypeScript rejects missing props — that's expected.

- [ ] **Step 3: Update PoemPlayer.tsx**

Replace `src/components/PoemPlayer.tsx` with:

```tsx
import { useState } from 'react'
import type { SavedPoem } from '../types'
import { DYNASTY_LABEL } from '../constants'

const SPEED_PRESETS = [
  { label: '慢', rate: 0.7 },
  { label: '正常', rate: 1.0 },
  { label: '快', rate: 1.4 },
] as const

interface PoemPlayerProps {
  poem: SavedPoem
  onPlay: (
    lines: string[],
    onLineStart: (index: number) => void,
    onDone: () => void
  ) => void
  onStop: () => void
  isPlaying: boolean
  highlightedLine?: number | null
  ttsRate: number
  setTtsRate: (rate: number) => void
}

export function PoemPlayer({ poem, onPlay, onStop, isPlaying, highlightedLine, ttsRate, setTtsRate }: PoemPlayerProps) {
  const [internalHighlight, setInternalHighlight] = useState<number | null>(null)

  const displayHighlight = highlightedLine !== undefined ? highlightedLine : internalHighlight

  function handlePlay() {
    setInternalHighlight(null)
    onPlay(
      poem.lines,
      (index) => setInternalHighlight(index),
      () => setInternalHighlight(null)
    )
  }

  function handleStop() {
    setInternalHighlight(null)
    onStop()
  }

  return (
    <div className="poem-player">
      <h2 className="poem-title">{poem.title}</h2>
      <p className="poem-author">{poem.author} · {DYNASTY_LABEL[poem.dynasty] ?? poem.dynasty}</p>
      <div className="poem-lines">
        {poem.lines.map((line, i) => (
          <p
            key={i}
            className={`poem-line${i === displayHighlight ? ' highlighted' : ''}`}
          >
            {line}
          </p>
        ))}
      </div>
      <div className="speed-presets">
        {SPEED_PRESETS.map(({ label, rate }) => (
          <button
            key={rate}
            className={`btn-speed${ttsRate === rate ? ' active' : ''}`}
            aria-pressed={ttsRate === rate}
            onClick={() => setTtsRate(rate)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="poem-controls">
        {isPlaying ? (
          <button onClick={handleStop} className="btn-stop">停止</button>
        ) : (
          <button onClick={handlePlay} className="btn-play">朗读</button>
        )}
      </div>
      {poem.authorBackground && (
        <div className="author-background">
          <p>{poem.authorBackground}</p>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify all pass**

```bash
npx vitest run tests/components/PoemPlayer.test.tsx
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/PoemPlayer.tsx tests/components/PoemPlayer.test.tsx
git commit -m "feat: add TTS speed preset buttons to PoemPlayer"
```

---

### Task 4: Wire `ttsRate`/`setTtsRate` through App → ListenTab → PoemPlayer

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/ListenTab.tsx`

No new tests — wiring is covered by component-level tests.

- [ ] **Step 1: Update `src/App.tsx`**

Change the `useVoiceController` destructure to include `ttsRate` and `setTtsRate`, and pass them to ListenTab:

```tsx
import { useState, useEffect } from 'react'
import { useVoiceController } from './hooks/useVoiceController'
import { useCorpus } from './hooks/useCorpus'
import { listPoems } from './data/PoemLibrary'
import { ListenTab } from './components/ListenTab'
import { LibraryTab } from './components/LibraryTab'
import type { AppTab, SavedPoem } from './types'

function App() {
  const [activeTab, setActiveTab] = useState<AppTab>('listen')
  const [libraryPoems, setLibraryPoems] = useState<SavedPoem[]>([])
  const [selectedPoem, setSelectedPoem] = useState<SavedPoem | undefined>(undefined)

  const { corpus, loading: corpusLoading, error: corpusError } = useCorpus()
  const { voiceState, startListening, speakLines, stop, isSTTSupported, ttsRate, setTtsRate } = useVoiceController()
  const sttSupported = isSTTSupported()

  useEffect(() => {
    listPoems().then(setLibraryPoems)
  }, [])

  function handlePoemSelect(poem: SavedPoem) {
    setSelectedPoem(poem)
    setActiveTab('listen')
  }

  async function handlePoemAdded() {
    const updated = await listPoems()
    setLibraryPoems(updated)
  }

  const voiceProps = {
    voiceState,
    startListening,
    speakLines,
    stop,
    isSTTSupported: sttSupported,
  }

  return (
    <div className="app">
      <main className="app-content">
        {corpusError && (
          <div className="corpus-error">
            诗库加载失败，仅可朗读已收藏的诗词
          </div>
        )}
        {activeTab === 'listen' ? (
          <ListenTab
            {...voiceProps}
            libraryPoems={libraryPoems}
            initialPoem={selectedPoem}
            ttsRate={ttsRate}
            setTtsRate={setTtsRate}
          />
        ) : (
          <LibraryTab
            {...voiceProps}
            corpus={corpus}
            corpusLoading={corpusLoading}
            savedPoems={libraryPoems}
            onPoemSelect={handlePoemSelect}
            onPoemAdded={handlePoemAdded}
          />
        )}
      </main>
      <nav className="tab-bar">
        <button
          className={`tab-button${activeTab === 'listen' ? ' active' : ''}`}
          onClick={() => { setSelectedPoem(undefined); setActiveTab('listen') }}
        >
          🎤 朗读
        </button>
        <button
          className={`tab-button${activeTab === 'library' ? ' active' : ''}`}
          onClick={() => { stop(); setActiveTab('library') }}
        >
          📚 诗库
        </button>
      </nav>
    </div>
  )
}

export default App
```

- [ ] **Step 2: Update `src/components/ListenTab.tsx`**

Add `ttsRate` and `setTtsRate` to the props interface and forward them to PoemPlayer:

```tsx
import { useState, useEffect, useRef } from 'react'
import type { SavedPoem, VoiceState } from '../types'
import { searchPoems } from '../data/PoemSearch'
import { PoemPlayer } from './PoemPlayer'

interface ListenTabProps {
  voiceState: VoiceState
  startListening: (onResult: (text: string) => void) => void
  speakLines: (lines: string[], onLineStart: (i: number) => void, onDone: () => void) => void
  stop: () => void
  isSTTSupported: boolean
  libraryPoems: SavedPoem[]
  initialPoem?: SavedPoem
  ttsRate: number
  setTtsRate: (rate: number) => void
}

export function ListenTab({
  voiceState,
  startListening,
  speakLines,
  stop,
  isSTTSupported,
  libraryPoems,
  initialPoem,
  ttsRate,
  setTtsRate,
}: ListenTabProps) {
  const [currentPoem, setCurrentPoem] = useState<SavedPoem | null>(null)
  const [highlightedLine, setHighlightedLine] = useState<number | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [textQuery, setTextQuery] = useState('')
  const autoPlayedRef = useRef(false)

  useEffect(() => {
    if (initialPoem && !autoPlayedRef.current) {
      autoPlayedRef.current = true
      setCurrentPoem(initialPoem)
      speakLines(
        initialPoem.lines,
        (i) => setHighlightedLine(i),
        () => setHighlightedLine(null)
      )
    }
  }, [initialPoem, speakLines])

  useEffect(() => {
    return () => stop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const statusText = voiceState === 'listening'
    ? '正在听...'
    : notFound
    ? '诗库中未找到，请先在诗库中添加'
    : currentPoem
    ? currentPoem.title
    : '说出诗名...'

  function handleSearch(query: string) {
    const results = searchPoems(libraryPoems, query)
    if (results.length > 0) {
      const found = results[0] as SavedPoem
      setCurrentPoem(found)
      setNotFound(false)
      speakLines(
        found.lines,
        (i) => setHighlightedLine(i),
        () => setHighlightedLine(null)
      )
    } else {
      setNotFound(true)
    }
  }

  function handleMicClick() {
    if (voiceState === 'idle') {
      setNotFound(false)
      startListening((text) => {
        handleSearch(text)
      })
    } else {
      stop()
    }
  }

  function handleTextSearch() {
    handleSearch(textQuery)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      handleTextSearch()
    }
  }

  return (
    <div className="listen-tab">
      <div className="listen-status">{statusText}</div>

      {isSTTSupported ? (
        <button
          className={`mic-button${voiceState === 'listening' ? ' active' : ''}`}
          aria-label={
            voiceState === 'listening'
              ? '停止录音'
              : voiceState === 'speaking'
              ? '停止朗读'
              : '开始录音'
          }
          onClick={handleMicClick}
        >
          {voiceState === 'listening' ? '🎙️' : '🎤'}
        </button>
      ) : (
        <div className="text-search">
          <input
            type="text"
            placeholder="输入诗名..."
            aria-label="诗名"
            lang="zh-CN"
            value={textQuery}
            onChange={(e) => setTextQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button onClick={handleTextSearch}>搜索</button>
        </div>
      )}

      {currentPoem && (
        <PoemPlayer
          poem={currentPoem}
          onPlay={(lines, onLineStart, onDone) => speakLines(lines, onLineStart, onDone)}
          onStop={stop}
          isPlaying={voiceState === 'speaking'}
          highlightedLine={highlightedLine}
          ttsRate={ttsRate}
          setTtsRate={setTtsRate}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 3: Run full test suite to confirm TypeScript and tests pass**

```bash
npx vitest run
```

Expected: all tests PASS (ListenTab tests may need `ttsRate`/`setTtsRate` added to their renders — check the output and fix any failures in the ListenTab test file by adding `ttsRate: 1.0, setTtsRate: vi.fn()` to any `makeProps` or inline render calls).

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx src/components/ListenTab.tsx
git commit -m "feat: wire ttsRate through App and ListenTab to PoemPlayer"
```

---

### Task 5: LibraryTab — sub-tabs and corpus browser

**Files:**
- Modify: `src/components/LibraryTab.tsx`
- Test: `tests/components/LibraryTab.test.tsx`

- [ ] **Step 1: Write the failing tests**

Replace `tests/components/LibraryTab.test.tsx` with the full file below. Existing tests are kept (with the corpusLoading test updated to click the browse tab first). New tests are appended.

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { act } from 'react'
import { LibraryTab } from '../../src/components/LibraryTab'
import { savePoem } from '../../src/data/PoemLibrary'
import type { CorpusPoem, SavedPoem, VoiceState } from '../../src/types'

vi.mock('../../src/data/PoemLibrary', () => ({
  savePoem: vi.fn().mockResolvedValue(undefined),
  listPoems: vi.fn().mockResolvedValue([]),
  resetDBCache: vi.fn(),
}))

const corpusPoem: CorpusPoem = {
  id: 'c1',
  title: '静夜思',
  author: '李白',
  dynasty: 'tang',
  authorBackground: '唐代诗人',
  lines: ['床前明月光'],
}

const corpusPoem2: CorpusPoem = {
  id: 'c2',
  title: '春晓',
  author: '孟浩然',
  dynasty: 'tang',
  authorBackground: '',
  lines: ['春眠不觉晓'],
}

const savedPoem: SavedPoem = { ...corpusPoem, addedAt: 1000 }

function makeProps(overrides = {}) {
  return {
    voiceState: 'idle' as VoiceState,
    startListening: vi.fn(),
    speakLines: vi.fn(),
    stop: vi.fn(),
    isSTTSupported: true,
    corpus: [corpusPoem, corpusPoem2],
    corpusLoading: false,
    savedPoems: [],
    onPoemSelect: vi.fn(),
    onPoemAdded: vi.fn(),
    ...overrides,
  }
}

describe('LibraryTab', () => {
  // ── 我的诗库 sub-tab (default) ──

  it('shows empty state when savedPoems is empty', () => {
    render(<LibraryTab {...makeProps()} />)
    expect(screen.getByText('诗库为空，请添加诗词')).toBeInTheDocument()
  })

  it('shows saved poem in list', () => {
    render(<LibraryTab {...makeProps({ savedPoems: [savedPoem] })} />)
    expect(screen.getByText('静夜思')).toBeInTheDocument()
    expect(screen.getByText('李白 · 唐')).toBeInTheDocument()
  })

  it('tapping a saved poem calls onPoemSelect(savedPoem)', () => {
    const onPoemSelect = vi.fn()
    render(<LibraryTab {...makeProps({ savedPoems: [savedPoem], onPoemSelect })} />)
    fireEvent.click(screen.getByText('静夜思').closest('button')!)
    expect(onPoemSelect).toHaveBeenCalledWith(savedPoem)
  })

  it('tapping add button calls startListening', () => {
    const startListening = vi.fn()
    render(<LibraryTab {...makeProps({ startListening })} />)
    fireEvent.click(screen.getByRole('button', { name: /添加新诗/ }))
    expect(startListening).toHaveBeenCalledWith(expect.any(Function))
  })

  it('voice result found shows PoemPreview and calls speakLines with announcement', () => {
    let capturedOnResult: ((text: string) => void) | null = null
    const startListening = vi.fn((onResult) => { capturedOnResult = onResult })
    const speakLines = vi.fn()

    render(<LibraryTab {...makeProps({ startListening, speakLines })} />)
    fireEvent.click(screen.getByRole('button', { name: /添加新诗/ }))

    act(() => capturedOnResult!('静夜思'))

    expect(screen.getByRole('button', { name: '确认添加' })).toBeInTheDocument()
    expect(speakLines).toHaveBeenCalledWith(
      [expect.stringContaining('静夜思')],
      expect.any(Function),
      expect.any(Function)
    )
  })

  it('voice result not found shows addNotFound message', () => {
    let capturedOnResult: ((text: string) => void) | null = null
    const startListening = vi.fn((onResult) => { capturedOnResult = onResult })

    render(<LibraryTab {...makeProps({ startListening })} />)
    fireEvent.click(screen.getByRole('button', { name: /添加新诗/ }))

    act(() => capturedOnResult!('不存在的诗'))

    expect(screen.getByText('未在诗库中找到该诗，请检查诗名')).toBeInTheDocument()
  })

  it('PoemPreview confirm calls savePoem and onPoemAdded', async () => {
    let capturedOnResult: ((text: string) => void) | null = null
    const startListening = vi.fn((onResult) => { capturedOnResult = onResult })
    const onPoemAdded = vi.fn()

    render(<LibraryTab {...makeProps({ startListening, onPoemAdded })} />)
    fireEvent.click(screen.getByRole('button', { name: /添加新诗/ }))

    act(() => capturedOnResult!('静夜思'))

    const confirmBtn = screen.getByRole('button', { name: '确认添加' })
    fireEvent.click(confirmBtn)

    await waitFor(() => expect(savePoem).toHaveBeenCalled())
    expect(savePoem).toHaveBeenCalledWith(expect.objectContaining({
      ...corpusPoem,
      addedAt: expect.any(Number),
    }))
    expect(onPoemAdded).toHaveBeenCalled()
  })

  it('PoemPreview cancel calls stop() and hides preview', () => {
    let capturedOnResult: ((text: string) => void) | null = null
    const startListening = vi.fn((onResult) => { capturedOnResult = onResult })
    const stop = vi.fn()

    render(<LibraryTab {...makeProps({ startListening, stop })} />)
    fireEvent.click(screen.getByRole('button', { name: /添加新诗/ }))

    act(() => capturedOnResult!('静夜思'))

    expect(screen.getByRole('button', { name: '确认添加' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '取消' }))

    expect(stop).toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: '确认添加' })).not.toBeInTheDocument()
  })

  it('shows text input fallback when isSTTSupported is false', () => {
    render(<LibraryTab {...makeProps({ isSTTSupported: false })} />)
    expect(screen.queryByRole('button', { name: /添加新诗/ })).not.toBeInTheDocument()
    expect(screen.getByPlaceholderText('输入诗名...')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '查找' })).toBeInTheDocument()
  })

  it('text input search finds poem and shows preview', () => {
    render(<LibraryTab {...makeProps({ isSTTSupported: false })} />)
    const input = screen.getByPlaceholderText('输入诗名...')
    fireEvent.change(input, { target: { value: '静夜思' } })
    fireEvent.click(screen.getByRole('button', { name: '查找' }))
    expect(screen.getByRole('button', { name: '确认添加' })).toBeInTheDocument()
  })

  it('text input Enter key triggers search', () => {
    render(<LibraryTab {...makeProps({ isSTTSupported: false })} />)
    const input = screen.getByPlaceholderText('输入诗名...')
    fireEvent.change(input, { target: { value: '静夜思' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(screen.getByRole('button', { name: '确认添加' })).toBeInTheDocument()
  })

  // ── Sub-tab navigation ──

  it('renders 我的诗库 and 浏览诗库 sub-tab buttons', () => {
    render(<LibraryTab {...makeProps()} />)
    expect(screen.getByRole('button', { name: '我的诗库' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '浏览诗库' })).toBeInTheDocument()
  })

  it('defaults to 我的诗库 sub-tab', () => {
    render(<LibraryTab {...makeProps()} />)
    expect(screen.getByRole('button', { name: '我的诗库' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('button', { name: '浏览诗库' })).toHaveAttribute('aria-selected', 'false')
  })

  it('switching to 浏览诗库 shows the browse search input', () => {
    render(<LibraryTab {...makeProps()} />)
    fireEvent.click(screen.getByRole('button', { name: '浏览诗库' }))
    expect(screen.getByPlaceholderText('搜索诗库...')).toBeInTheDocument()
  })

  // ── 浏览诗库 sub-tab ──

  it('shows "正在加载诗库..." in browse tab when corpusLoading is true', () => {
    render(<LibraryTab {...makeProps({ corpusLoading: true })} />)
    fireEvent.click(screen.getByRole('button', { name: '浏览诗库' }))
    expect(screen.getByText('正在加载诗库...')).toBeInTheDocument()
  })

  it('shows first 50 corpus poems by default in browse tab', () => {
    render(<LibraryTab {...makeProps()} />)
    fireEvent.click(screen.getByRole('button', { name: '浏览诗库' }))
    expect(screen.getByText('静夜思')).toBeInTheDocument()
    expect(screen.getByText('春晓')).toBeInTheDocument()
  })

  it('browse filters results by search query', () => {
    render(<LibraryTab {...makeProps()} />)
    fireEvent.click(screen.getByRole('button', { name: '浏览诗库' }))
    fireEvent.change(screen.getByPlaceholderText('搜索诗库...'), { target: { value: '春晓' } })
    expect(screen.queryByText('静夜思')).not.toBeInTheDocument()
    expect(screen.getByText('春晓')).toBeInTheDocument()
  })

  it('browse excludes already-saved poems from results', () => {
    render(<LibraryTab {...makeProps({ savedPoems: [savedPoem] })} />)
    fireEvent.click(screen.getByRole('button', { name: '浏览诗库' }))
    // savedPoem has id 'c1' (静夜思) — should not appear in browse results
    const browseSection = screen.getByPlaceholderText('搜索诗库...').closest('div')!
    expect(browseSection).not.toHaveTextContent('静夜思')
    expect(browseSection).toHaveTextContent('春晓')
  })

  it('tapping a browse result opens PoemPreview', () => {
    render(<LibraryTab {...makeProps()} />)
    fireEvent.click(screen.getByRole('button', { name: '浏览诗库' }))
    fireEvent.click(screen.getByRole('button', { name: /添加 静夜思/ }))
    expect(screen.getByRole('button', { name: '确认添加' })).toBeInTheDocument()
  })

  it('browse shows no-results message when query matches nothing', () => {
    render(<LibraryTab {...makeProps()} />)
    fireEvent.click(screen.getByRole('button', { name: '浏览诗库' }))
    fireEvent.change(screen.getByPlaceholderText('搜索诗库...'), { target: { value: 'zzz不存在' } })
    expect(screen.getByText('未找到匹配的诗')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to see which new ones fail**

```bash
npx vitest run tests/components/LibraryTab.test.tsx
```

Expected: new browse/sub-tab tests FAIL, existing tests PASS.

- [ ] **Step 3: Replace `src/components/LibraryTab.tsx` with the full updated file**

```tsx
import { useState, useMemo } from 'react'
import type { CorpusPoem, SavedPoem, VoiceState } from '../types'
import { DYNASTY_LABEL } from '../constants'
import { searchPoems } from '../data/PoemSearch'
import { savePoem } from '../data/PoemLibrary'
import { PoemPreview } from './PoemPreview'

interface LibraryTabProps {
  voiceState: VoiceState
  startListening: (onResult: (text: string) => void) => void
  speakLines: (lines: string[], onLineStart: (i: number) => void, onDone: () => void) => void
  stop: () => void
  isSTTSupported: boolean
  corpus: CorpusPoem[]
  corpusLoading: boolean
  savedPoems: SavedPoem[]
  onPoemSelect: (poem: SavedPoem) => void
  onPoemAdded: () => Promise<void>
}

type SubTab = 'mine' | 'browse'

export function LibraryTab({
  voiceState,
  startListening,
  speakLines,
  stop,
  isSTTSupported,
  corpus,
  corpusLoading,
  savedPoems,
  onPoemSelect,
  onPoemAdded,
}: LibraryTabProps) {
  const [preview, setPreview] = useState<CorpusPoem | null>(null)
  const [addNotFound, setAddNotFound] = useState(false)
  const [addTextQuery, setAddTextQuery] = useState('')
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('mine')
  const [browseQuery, setBrowseQuery] = useState('')

  const browseResults = useMemo(() => {
    const savedIds = new Set(savedPoems.map(p => p.id))
    const pool = browseQuery ? searchPoems(corpus, browseQuery) : corpus
    return pool.filter(p => !savedIds.has(p.id)).slice(0, 50)
  }, [corpus, browseQuery, savedPoems])

  function handleAddByVoice() {
    setAddNotFound(false)
    startListening((text) => {
      const results = searchPoems(corpus, text)
      if (results.length > 0) {
        const found = results[0]
        setPreview(found)
        speakLines(
          [`找到《${found.title}》，${found.author}的诗。确认添加吗？`],
          () => {},
          () => {}
        )
      } else {
        setAddNotFound(true)
      }
    })
  }

  function handleAddByText() {
    const results = searchPoems(corpus, addTextQuery)
    if (results.length > 0) {
      setPreview(results[0])
      setAddNotFound(false)
    } else {
      setAddNotFound(true)
    }
  }

  function handleTextKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      handleAddByText()
    }
  }

  async function handleConfirm() {
    if (!preview) return
    await savePoem({ ...preview, addedAt: Date.now() })
    setPreview(null)
    setAddTextQuery('')
    await onPoemAdded()
  }

  function handleCancel() {
    setPreview(null)
    stop()
  }

  if (preview !== null) {
    return (
      <PoemPreview poem={preview} onConfirm={handleConfirm} onCancel={handleCancel} />
    )
  }

  return (
    <div className="library-tab">
      <div className="sub-tabs">
        <button
          className={`sub-tab${activeSubTab === 'mine' ? ' active' : ''}`}
          aria-selected={activeSubTab === 'mine'}
          onClick={() => setActiveSubTab('mine')}
        >
          我的诗库
        </button>
        <button
          className={`sub-tab${activeSubTab === 'browse' ? ' active' : ''}`}
          aria-selected={activeSubTab === 'browse'}
          onClick={() => setActiveSubTab('browse')}
        >
          浏览诗库
        </button>
      </div>

      {activeSubTab === 'mine' ? (
        <div className="my-library">
          <div className="poem-list">
            {savedPoems.length === 0 ? (
              <p className="empty-library">诗库为空，请添加诗词</p>
            ) : (
              savedPoems.map((poem) => (
                <button
                  key={poem.id}
                  className="poem-list-item"
                  aria-label={`${poem.title} ${poem.author}`}
                  onClick={() => onPoemSelect(poem)}
                >
                  <span className="poem-list-title">{poem.title}</span>
                  <span className="poem-list-meta">
                    {poem.author} · {DYNASTY_LABEL[poem.dynasty] ?? poem.dynasty}
                  </span>
                </button>
              ))
            )}
          </div>

          <div className="add-section">
            {corpusLoading ? (
              <p>正在加载诗库...</p>
            ) : isSTTSupported ? (
              <button
                className="btn-add-poem"
                disabled={voiceState !== 'idle'}
                onClick={handleAddByVoice}
              >
                ＋ 添加新诗 <span aria-hidden="true">🎤</span>
              </button>
            ) : (
              <div className="add-text-section">
                <input
                  type="text"
                  placeholder="输入诗名..."
                  aria-label="诗名"
                  lang="zh-CN"
                  value={addTextQuery}
                  onChange={(e) => setAddTextQuery(e.target.value)}
                  onKeyDown={handleTextKeyDown}
                />
                <button onClick={handleAddByText}>查找</button>
              </div>
            )}
            {addNotFound && (
              <p className="add-not-found">未在诗库中找到该诗，请检查诗名</p>
            )}
          </div>
        </div>
      ) : (
        <div className="browse-section">
          <input
            type="text"
            placeholder="搜索诗库..."
            aria-label="搜索诗库"
            lang="zh-CN"
            value={browseQuery}
            onChange={(e) => setBrowseQuery(e.target.value)}
          />
          {corpusLoading ? (
            <p className="corpus-loading">正在加载诗库...</p>
          ) : (
            <div className="browse-results">
              {browseResults.map((poem) => (
                <div key={poem.id} className="browse-result-item">
                  <button
                    className="browse-result-info"
                    onClick={() => setPreview(poem)}
                  >
                    <span className="browse-result-title">{poem.title}</span>
                    <span className="browse-result-meta">
                      {poem.author} · {DYNASTY_LABEL[poem.dynasty] ?? poem.dynasty}
                    </span>
                  </button>
                  <button
                    className="browse-result-add"
                    aria-label={`添加 ${poem.title}`}
                    onClick={() => setPreview(poem)}
                  >
                    ＋
                  </button>
                </div>
              ))}
              {browseResults.length === 0 && browseQuery && (
                <p className="browse-no-results">未找到匹配的诗</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify all pass**

```bash
npx vitest run tests/components/LibraryTab.test.tsx
```

Expected: all tests PASS.

- [ ] **Step 5: Run full suite**

```bash
npx vitest run
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/LibraryTab.tsx tests/components/LibraryTab.test.tsx
git commit -m "feat: add sub-tabs and corpus browser to LibraryTab"
```

---

### Task 6: Styles — speed presets, sub-tabs, browse section

**Files:**
- Modify: `src/styles.css`

No tests — CSS is verified visually.

- [ ] **Step 1: Append new CSS rules to the end of `src/styles.css`**

```css
/* ── Speed presets ── */
.speed-presets {
  display: flex; gap: 8px; justify-content: center; margin-bottom: 12px;
}
.btn-speed {
  padding: 6px 16px; border-radius: 6px; border: 1px solid #4a4a7a;
  background: #1e1e3a; color: #8888aa; font-size: 14px; cursor: pointer;
}
.btn-speed.active { background: #2a2a5a; color: #e8d5b7; border-color: #8888cc; }

/* ── Library sub-tabs ── */
.sub-tabs {
  display: flex; border-bottom: 1px solid #2a2a4a; margin-bottom: 16px;
}
.sub-tab {
  flex: 1; padding: 10px 8px; border: none; background: transparent;
  color: #8888aa; font-size: 15px; cursor: pointer;
  border-bottom: 2px solid transparent; margin-bottom: -1px;
}
.sub-tab.active { color: #e8d5b7; border-bottom-color: #8888cc; }

/* ── Browse section ── */
.browse-section { padding: 0 0 16px; }
.browse-section input {
  width: 100%; padding: 10px 12px; background: #2a2a4a; border: 1px solid #4a4a7a;
  border-radius: 8px; color: #e8d5b7; font-size: 16px; margin-bottom: 12px;
  box-sizing: border-box;
}
.browse-results { display: flex; flex-direction: column; gap: 6px; }
.browse-result-item {
  display: flex; align-items: center; background: #1e1e3a;
  border: 1px solid #2a2a4a; border-radius: 8px; overflow: hidden;
}
.browse-result-info {
  flex: 1; padding: 10px 12px; border: none; background: transparent;
  text-align: left; cursor: pointer; display: flex; flex-direction: column; gap: 2px;
}
.browse-result-title { font-size: 16px; color: #e8d5b7; }
.browse-result-meta { font-size: 12px; color: #8888aa; }
.browse-result-add {
  padding: 10px 14px; border: none; border-left: 1px solid #2a2a4a;
  background: transparent; color: #88cc88; font-size: 18px; cursor: pointer;
}
.browse-no-results { text-align: center; color: #8888aa; padding: 20px; }
.my-library { display: flex; flex-direction: column; }
```

- [ ] **Step 2: Run full test suite one final time**

```bash
npx vitest run
```

Expected: all tests PASS.

- [ ] **Step 3: Start dev server and verify UI manually**

```bash
npm run dev
```

Check:
- PoemPlayer shows 慢/正常/快 buttons; active one is highlighted; clicking changes highlight; next 朗读 uses new rate
- Library tab shows 我的诗库 / 浏览诗库 toggle
- 浏览诗库 shows poem list; typing filters it; tapping ＋ opens PoemPreview
- Already-saved poems do not appear in browse results

- [ ] **Step 4: Commit**

```bash
git add src/styles.css
git commit -m "feat: add styles for speed presets, sub-tabs, and corpus browser"
```

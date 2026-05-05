# Character Pronunciation Annotation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users long-press any character in a poem to annotate its correct pinyin and TTS substitute, persisting both the visual annotation and the corrected TTS pronunciation.

**Architecture:** Pure helper `buildTtsLine` applies per-character substitutions to source lines before TTS speaks them. PoemPlayer renders characters as individual spans with long-press detection; annotated chars display as `<ruby>` elements. ListenTab owns persistence and wires annotations into all TTS call sites.

**Tech Stack:** React, TypeScript, Vitest + React Testing Library, IndexedDB via `idb`, Web Speech API, HTML `<ruby>` / `<rt>`

---

## File Map

| File | Role |
|------|------|
| `src/types.ts` | Add `CharAnnotation` interface and `charAnnotations?` to `SavedPoem` |
| `src/utils/charAnnotation.ts` | NEW — pure `buildTtsLine()` |
| `src/utils/poemLineDisplay.ts` | Add `sourceCharOffset` to `DisplayLine`, compute in `buildDisplayLines` |
| `src/components/PoemPlayer.tsx` | Char spans, ruby rendering, long-press, annotation popup, updated props |
| `src/components/ListenTab.tsx` | Two handlers, `buildTtsLine` at all TTS call sites, wire new props |
| `src/styles.css` | `ruby`/`rt` styles, annotation popup overlay |
| `tests/utils/charAnnotation.test.ts` | NEW — unit tests for `buildTtsLine` |
| `tests/utils/poemLineDisplay.test.ts` | NEW — tests for `sourceCharOffset` in `buildDisplayLines` |
| `tests/components/PoemPlayer.test.tsx` | Update `onSpeakLine` test; add ruby rendering and popup tests |
| `tests/components/ListenTab.charAnnotation.test.tsx` | NEW — save/remove/TTS integration tests |

---

### Task 1: Types + `buildTtsLine` helper

**Files:**
- Modify: `src/types.ts`
- Create: `src/utils/charAnnotation.ts`
- Create: `tests/utils/charAnnotation.test.ts`

- [ ] **Step 1: Write failing tests for `buildTtsLine`**

Create `tests/utils/charAnnotation.test.ts`:

```typescript
import { buildTtsLine } from '../../src/utils/charAnnotation'
import type { CharAnnotation } from '../../src/types'

describe('buildTtsLine', () => {
  it('returns original line when no annotations', () => {
    expect(buildTtsLine('千里江陵一日还', 0, [])).toBe('千里江陵一日还')
  })

  it('substitutes annotated character at correct position', () => {
    const ann: CharAnnotation[] = [{ lineIndex: 0, charIndex: 6, pinyin: 'huán', substitute: '环' }]
    expect(buildTtsLine('千里江陵一日还', 0, ann)).toBe('千里江陵一日环')
  })

  it('applies multiple substitutions in same line', () => {
    const ann: CharAnnotation[] = [
      { lineIndex: 0, charIndex: 0, pinyin: 'zhǎng', substitute: '张' },
      { lineIndex: 0, charIndex: 4, pinyin: 'jiàng', substitute: '降' },
    ]
    expect(buildTtsLine('长亭外古道边', 0, ann)).toBe('张亭外古道降')
  })

  it('ignores annotations for other lines', () => {
    const ann: CharAnnotation[] = [{ lineIndex: 1, charIndex: 0, pinyin: 'x', substitute: 'X' }]
    expect(buildTtsLine('千里江陵一日还', 0, ann)).toBe('千里江陵一日还')
  })
})
```

- [ ] **Step 2: Run to confirm RED**

```bash
npx vitest run tests/utils/charAnnotation.test.ts
```

Expected: FAIL — `buildTtsLine` not found.

- [ ] **Step 3: Add `CharAnnotation` to `src/types.ts`**

In `src/types.ts`, after the `SavedPoem` interface closing brace, add:

```typescript
export interface CharAnnotation {
  lineIndex: number
  charIndex: number
  pinyin: string
  substitute: string
}
```

And inside `SavedPoem`, after `boldLines?: number[]`:

```typescript
  charAnnotations?: CharAnnotation[]
```

- [ ] **Step 4: Create `src/utils/charAnnotation.ts`**

```typescript
import type { CharAnnotation } from '../types'

export function buildTtsLine(
  line: string,
  lineIndex: number,
  annotations: CharAnnotation[],
): string {
  const relevant = annotations.filter((a) => a.lineIndex === lineIndex)
  if (!relevant.length) return line
  return Array.from(line)
    .map((char, i) => relevant.find((a) => a.charIndex === i)?.substitute ?? char)
    .join('')
}
```

- [ ] **Step 5: Run tests to confirm GREEN**

```bash
npx vitest run tests/utils/charAnnotation.test.ts
```

Expected: 4 passed.

- [ ] **Step 6: Commit**

```bash
git add src/types.ts src/utils/charAnnotation.ts tests/utils/charAnnotation.test.ts
git commit -m "feat: add CharAnnotation type and buildTtsLine helper"
```

---

### Task 2: `sourceCharOffset` in `DisplayLine`

**Files:**
- Modify: `src/utils/poemLineDisplay.ts`
- Create: `tests/utils/poemLineDisplay.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/utils/poemLineDisplay.test.ts`:

```typescript
import { buildDisplayLines } from '../../src/utils/poemLineDisplay'

describe('buildDisplayLines', () => {
  it('sets sourceCharOffset to 0 for unsplit 5-char lines', () => {
    const lines = ['床前明月光', '疑是地上霜']
    const result = buildDisplayLines(lines)
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({ text: '床前明月光', sourceLineIndex: 0, sourceCharOffset: 0 })
    expect(result[1]).toEqual({ text: '疑是地上霜', sourceLineIndex: 1, sourceCharOffset: 0 })
  })

  it('sets correct sourceCharOffset for split clauses', () => {
    // 7-char line with punctuation splits into two clauses
    const lines = ['烽火连三月，家书抵万金']
    const result = buildDisplayLines(lines)
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({ text: '烽火连三月，', sourceLineIndex: 0, sourceCharOffset: 0 })
    expect(result[1]).toEqual({ text: '家书抵万金', sourceLineIndex: 0, sourceCharOffset: 6 })
  })

  it('sets sourceCharOffset to 0 for unsplit long prose lines', () => {
    const lines = ['余幼时即嗜学']
    const result = buildDisplayLines(lines)
    expect(result).toHaveLength(1)
    expect(result[0].sourceCharOffset).toBe(0)
  })
})
```

- [ ] **Step 2: Run to confirm RED**

```bash
npx vitest run tests/utils/poemLineDisplay.test.ts
```

Expected: FAIL — `sourceCharOffset` missing from result objects.

- [ ] **Step 3: Update `src/utils/poemLineDisplay.ts`**

Replace the entire file with:

```typescript
export type DisplayLine = {
  text: string
  sourceLineIndex: number
  sourceCharOffset: number
}

function countChineseChars(text: string): number {
  const matches = text.match(/[一-鿿]/g)
  return matches ? matches.length : 0
}

function splitLineByClause(line: string): string[] {
  return line
    .match(/[^，。！？；、]+[，。！？；、]?/g)
    ?.map((part) => part.trim())
    .filter(Boolean) ?? []
}

export function buildDisplayLines(lines: string[]): DisplayLine[] {
  return lines.flatMap((line, sourceLineIndex) => {
    const clauses = splitLineByClause(line)
    if (!clauses.length) {
      return [{ text: line, sourceLineIndex, sourceCharOffset: 0 }]
    }
    const firstClauseLength = countChineseChars(clauses[0])
    if (firstClauseLength === 7 && clauses.length > 1) {
      let searchFrom = 0
      return clauses.map((text) => {
        const sourceCharOffset = line.indexOf(text, searchFrom)
        searchFrom = sourceCharOffset + text.length
        return { text, sourceLineIndex, sourceCharOffset }
      })
    }
    return [{ text: line, sourceLineIndex, sourceCharOffset: 0 }]
  })
}

export function getDisplaySentences(lines: string[]): string[] {
  return buildDisplayLines(lines).map((line) => line.text)
}
```

- [ ] **Step 4: Run tests to confirm GREEN**

```bash
npx vitest run tests/utils/poemLineDisplay.test.ts
```

Expected: 3 passed.

- [ ] **Step 5: Run full suite to confirm no regressions**

```bash
npx vitest run
```

Expected: all passing.

- [ ] **Step 6: Commit**

```bash
git add src/utils/poemLineDisplay.ts tests/utils/poemLineDisplay.test.ts
git commit -m "feat: add sourceCharOffset to DisplayLine"
```

---

### Task 3: PoemPlayer — char spans, ruby rendering, updated `onSpeakLine`

**Files:**
- Modify: `src/components/PoemPlayer.tsx`
- Modify: `tests/components/PoemPlayer.test.tsx`

- [ ] **Step 1: Write failing tests**

In `tests/components/PoemPlayer.test.tsx`, replace the existing `onSpeakLine` test and add ruby tests. Find:

```typescript
  it('calls onSpeakLine with line text when a line is tapped', () => {
    const onSpeakLine = vi.fn()
    render(<PoemPlayer {...defaultProps} onSpeakLine={onSpeakLine} />)
    fireEvent.click(screen.getByText('床前明月光'))
    expect(onSpeakLine).toHaveBeenCalledWith('床前明月光')
  })
```

Replace with:

```typescript
  it('calls onSpeakLine with line index when a line is tapped', () => {
    const onSpeakLine = vi.fn()
    render(<PoemPlayer {...defaultProps} onSpeakLine={onSpeakLine} />)
    fireEvent.click(screen.getByText('床前明月光'))
    expect(onSpeakLine).toHaveBeenCalledWith(0)
  })

  it('renders annotated character as ruby with pinyin above', () => {
    const poemWithAnnotation = {
      ...poem,
      charAnnotations: [{ lineIndex: 0, charIndex: 0, pinyin: 'chuáng', substitute: '床' }],
    }
    render(<PoemPlayer {...defaultProps} poem={poemWithAnnotation} />)
    const ruby = document.querySelector('ruby')
    expect(ruby).toBeInTheDocument()
    expect(ruby?.textContent).toContain('床')
    const rt = document.querySelector('rt')
    expect(rt?.textContent).toBe('chuáng')
  })
```

- [ ] **Step 2: Run to confirm RED**

```bash
npx vitest run tests/components/PoemPlayer.test.tsx
```

Expected: 2 tests fail — `onSpeakLine` called with wrong type, ruby not rendered.

- [ ] **Step 3: Update `PoemPlayer.tsx` — prop signature and char rendering**

In `src/components/PoemPlayer.tsx`:

**3a.** Change `onSpeakLine` prop type (in the interface):
```typescript
  onSpeakLine?: (lineIndex: number) => void
```

**3b.** Change the destructured prop usage and the `<p>` onClick — find the `onClick` block:
```typescript
              onClick={() => {
                onSpeakLine?.(poem.lines[line.sourceLineIndex])
                startEdit(line.sourceLineIndex)
              }}
```
Replace with:
```typescript
              onClick={() => {
                onSpeakLine?.(line.sourceLineIndex)
                startEdit(line.sourceLineIndex)
              }}
```

**3c.** Replace the text children of the `<p>` element. Find the full `<p>` block (the one with `isBoldLine`):

```typescript
          const isBoldLine = poem.boldLines?.includes(line.sourceLineIndex) ?? false
          return (
            <p
              key={`${line.sourceLineIndex}-${i}`}
              className={`poem-line${line.sourceLineIndex === displayHighlight ? ' highlighted' : ''}${isBoldLine ? ' bold' : ''}${onLineEdit && !isPlaying ? ' editable' : ''}`}
              onClick={() => {
                onSpeakLine?.(line.sourceLineIndex)
                startEdit(line.sourceLineIndex)
              }}
            >
              {line.text}
            </p>
          )
```

Replace with:

```typescript
          const isBoldLine = poem.boldLines?.includes(line.sourceLineIndex) ?? false
          return (
            <p
              key={`${line.sourceLineIndex}-${i}`}
              className={`poem-line${line.sourceLineIndex === displayHighlight ? ' highlighted' : ''}${isBoldLine ? ' bold' : ''}${onLineEdit && !isPlaying ? ' editable' : ''}`}
              onClick={() => {
                onSpeakLine?.(line.sourceLineIndex)
                startEdit(line.sourceLineIndex)
              }}
            >
              {Array.from(line.text).map((char, charOffset) => {
                const sourceCharIndex = line.sourceCharOffset + charOffset
                const annotation = poem.charAnnotations?.find(
                  (a) => a.lineIndex === line.sourceLineIndex && a.charIndex === sourceCharIndex
                )
                if (annotation) {
                  return (
                    <ruby key={charOffset}>
                      {char}<rt>{annotation.pinyin}</rt>
                    </ruby>
                  )
                }
                return <span key={charOffset}>{char}</span>
              })}
            </p>
          )
```

- [ ] **Step 4: Run tests to confirm GREEN**

```bash
npx vitest run tests/components/PoemPlayer.test.tsx
```

Expected: all passing.

- [ ] **Step 5: Run full suite**

```bash
npx vitest run
```

Expected: all passing.

- [ ] **Step 6: Commit**

```bash
git add src/components/PoemPlayer.tsx tests/components/PoemPlayer.test.tsx
git commit -m "feat: render poem chars as spans with ruby annotation support"
```

---

### Task 4: PoemPlayer — long-press detection and annotation popup

**Files:**
- Modify: `src/components/PoemPlayer.tsx`
- Modify: `src/styles.css`
- Modify: `tests/components/PoemPlayer.test.tsx`

- [ ] **Step 1: Write failing tests**

Add to the `describe('PoemPlayer')` block in `tests/components/PoemPlayer.test.tsx`:

```typescript
  it('long press on character opens annotation popup', () => {
    vi.useFakeTimers()
    render(<PoemPlayer {...defaultProps} onCharAnnotate={vi.fn()} />)
    const charSpan = document.querySelector('.poem-line span') as Element
    fireEvent.touchStart(charSpan)
    act(() => { vi.advanceTimersByTime(500) })
    expect(screen.getByPlaceholderText('拼音 (e.g. huán)')).toBeInTheDocument()
    vi.useRealTimers()
  })

  it('popup pre-fills fields for existing annotation', () => {
    vi.useFakeTimers()
    const poemWithAnnotation = {
      ...poem,
      charAnnotations: [{ lineIndex: 0, charIndex: 0, pinyin: 'chuáng', substitute: '床' }],
    }
    render(<PoemPlayer {...defaultProps} poem={poemWithAnnotation} onCharAnnotate={vi.fn()} onCharAnnotateRemove={vi.fn()} />)
    const charSpan = document.querySelector('.poem-line ruby') as Element
    fireEvent.touchStart(charSpan)
    act(() => { vi.advanceTimersByTime(500) })
    expect((screen.getByPlaceholderText('拼音 (e.g. huán)') as HTMLInputElement).value).toBe('chuáng')
    expect((screen.getByPlaceholderText('替换字 (e.g. 环)') as HTMLInputElement).value).toBe('床')
    vi.useRealTimers()
  })

  it('Save button calls onCharAnnotate and closes popup', () => {
    vi.useFakeTimers()
    const onCharAnnotate = vi.fn()
    render(<PoemPlayer {...defaultProps} onCharAnnotate={onCharAnnotate} />)
    const charSpan = document.querySelector('.poem-line span') as Element
    fireEvent.touchStart(charSpan)
    act(() => { vi.advanceTimersByTime(500) })
    fireEvent.change(screen.getByPlaceholderText('拼音 (e.g. huán)'), { target: { value: 'chuáng' } })
    fireEvent.change(screen.getByPlaceholderText('替换字 (e.g. 环)'), { target: { value: '床' } })
    fireEvent.click(screen.getByRole('button', { name: '保存' }))
    expect(onCharAnnotate).toHaveBeenCalledWith(0, 0, 'chuáng', '床')
    expect(screen.queryByPlaceholderText('拼音 (e.g. huán)')).not.toBeInTheDocument()
    vi.useRealTimers()
  })

  it('Remove button calls onCharAnnotateRemove and closes popup', () => {
    vi.useFakeTimers()
    const onCharAnnotateRemove = vi.fn()
    const poemWithAnnotation = {
      ...poem,
      charAnnotations: [{ lineIndex: 0, charIndex: 0, pinyin: 'chuáng', substitute: '床' }],
    }
    render(<PoemPlayer {...defaultProps} poem={poemWithAnnotation} onCharAnnotate={vi.fn()} onCharAnnotateRemove={onCharAnnotateRemove} />)
    const charSpan = document.querySelector('.poem-line ruby') as Element
    fireEvent.touchStart(charSpan)
    act(() => { vi.advanceTimersByTime(500) })
    fireEvent.click(screen.getByRole('button', { name: '删除' }))
    expect(onCharAnnotateRemove).toHaveBeenCalledWith(0, 0)
    expect(screen.queryByPlaceholderText('拼音 (e.g. huán)')).not.toBeInTheDocument()
    vi.useRealTimers()
  })

  it('Cancel button closes popup without calling handlers', () => {
    vi.useFakeTimers()
    const onCharAnnotate = vi.fn()
    render(<PoemPlayer {...defaultProps} onCharAnnotate={onCharAnnotate} />)
    const charSpan = document.querySelector('.poem-line span') as Element
    fireEvent.touchStart(charSpan)
    act(() => { vi.advanceTimersByTime(500) })
    fireEvent.click(screen.getByRole('button', { name: '取消' }))
    expect(onCharAnnotate).not.toHaveBeenCalled()
    expect(screen.queryByPlaceholderText('拼音 (e.g. huán)')).not.toBeInTheDocument()
    vi.useRealTimers()
  })
```

- [ ] **Step 2: Run to confirm RED**

```bash
npx vitest run tests/components/PoemPlayer.test.tsx
```

Expected: 5 new tests fail.

- [ ] **Step 3: Add new props and state to `PoemPlayer.tsx`**

In the `PoemPlayerProps` interface, add after `onCharAnnotateRemove`:

```typescript
  onCharAnnotate?: (lineIndex: number, charIndex: number, pinyin: string, substitute: string) => void
  onCharAnnotateRemove?: (lineIndex: number, charIndex: number) => void
```

In the function signature destructuring, add `onCharAnnotate, onCharAnnotateRemove` after `onLineBoldToggle`.

Add state and refs near the top of the function body (after existing `useRef` declarations):

```typescript
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressFiredRef = useRef(false)
  const [annotationTarget, setAnnotationTarget] = useState<{
    lineIndex: number
    charIndex: number
    char: string
    existing?: { pinyin: string; substitute: string }
  } | null>(null)
  const [annotPinyin, setAnnotPinyin] = useState('')
  const [annotSubstitute, setAnnotSubstitute] = useState('')
```

Add long-press handler functions after `handleEditKeyDown`:

```typescript
  function handleCharTouchStart(
    e: React.TouchEvent,
    lineIndex: number,
    charIndex: number,
    char: string,
  ) {
    longPressFiredRef.current = false
    longPressTimerRef.current = setTimeout(() => {
      longPressFiredRef.current = true
      const existing = poem.charAnnotations?.find(
        (a) => a.lineIndex === lineIndex && a.charIndex === charIndex
      )
      setAnnotationTarget({ lineIndex, charIndex, char, existing })
      setAnnotPinyin(existing?.pinyin ?? '')
      setAnnotSubstitute(existing?.substitute ?? '')
    }, 500)
  }

  function handleCharTouchEnd(e: React.TouchEvent) {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
    if (longPressFiredRef.current) {
      e.preventDefault()
    }
  }
```

- [ ] **Step 4: Add touch handlers to char spans and ruby elements**

Update the character rendering block from Task 3. Replace the `if (annotation)` branch and span:

```typescript
                const touchHandlers = {
                  onTouchStart: (e: React.TouchEvent) =>
                    handleCharTouchStart(e, line.sourceLineIndex, sourceCharIndex, char),
                  onTouchEnd: handleCharTouchEnd,
                }
                if (annotation) {
                  return (
                    <ruby key={charOffset} {...touchHandlers}>
                      {char}<rt>{annotation.pinyin}</rt>
                    </ruby>
                  )
                }
                return <span key={charOffset} {...touchHandlers}>{char}</span>
```

- [ ] **Step 5: Add annotation popup JSX**

Inside the `return (...)` of `PoemPlayer`, just before the closing `</div>` of the component, add:

```tsx
      {annotationTarget && (
        <div className="annotation-popup" onClick={(e) => e.stopPropagation()}>
          <div className="annotation-char">{annotationTarget.char}</div>
          <div className="annotation-fields">
            <input
              placeholder="拼音 (e.g. huán)"
              value={annotPinyin}
              onChange={(e) => setAnnotPinyin(e.target.value)}
            />
            <input
              placeholder="替换字 (e.g. 环)"
              value={annotSubstitute}
              onChange={(e) => setAnnotSubstitute(e.target.value)}
            />
          </div>
          <div className="annotation-buttons">
            <button onClick={() => {
              onCharAnnotate?.(annotationTarget.lineIndex, annotationTarget.charIndex, annotPinyin.trim(), annotSubstitute.trim())
              setAnnotationTarget(null)
            }}>保存</button>
            {annotationTarget.existing && (
              <button onClick={() => {
                onCharAnnotateRemove?.(annotationTarget.lineIndex, annotationTarget.charIndex)
                setAnnotationTarget(null)
              }}>删除</button>
            )}
            <button onClick={() => setAnnotationTarget(null)}>取消</button>
          </div>
        </div>
      )}
```

- [ ] **Step 6: Add CSS to `src/styles.css`**

Add after the existing `.btn-bold.active` rule:

```css
ruby { display: inline; }
rt { font-size: 0.5em; color: #9a8a6a; line-height: 1; }
.annotation-popup {
  position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
  background: #1a1a2a; border: 1px solid #6a6acc; border-radius: 12px;
  padding: 20px; z-index: 100; min-width: 260px; text-align: center;
}
.annotation-char { font-size: 48px; color: #e8d5b7; margin-bottom: 16px; }
.annotation-fields { display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px; }
.annotation-fields input {
  background: #0e0e1e; border: 1px solid #6a6acc; border-radius: 6px;
  color: #e8d5b7; font-size: 16px; padding: 8px 12px; text-align: center;
}
.annotation-buttons { display: flex; gap: 8px; justify-content: center; }
.annotation-buttons button {
  padding: 8px 16px; border-radius: 8px; font-size: 14px; cursor: pointer;
  border: 1px solid #4a4a7a; background: #1e1e3a; color: #8888aa;
}
```

- [ ] **Step 7: Run tests to confirm GREEN**

```bash
npx vitest run tests/components/PoemPlayer.test.tsx
```

Expected: all passing.

- [ ] **Step 8: Run full suite**

```bash
npx vitest run
```

Expected: all passing.

- [ ] **Step 9: Commit**

```bash
git add src/components/PoemPlayer.tsx src/styles.css tests/components/PoemPlayer.test.tsx
git commit -m "feat: add long-press annotation popup to PoemPlayer"
```

---

### Task 5: ListenTab — handlers and TTS wiring

**Files:**
- Modify: `src/components/ListenTab.tsx`
- Create: `tests/components/ListenTab.charAnnotation.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `tests/components/ListenTab.charAnnotation.test.tsx`:

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { act } from 'react'
import { ListenTab } from '../../src/components/ListenTab'
import { savePoem } from '../../src/data/PoemLibrary'
import type { SavedPoem, VoiceState } from '../../src/types'

vi.mock('../../src/data/PoemLibrary', () => ({
  savePoem: vi.fn().mockResolvedValue(undefined),
  listPoems: vi.fn().mockResolvedValue([]),
}))

const poem: SavedPoem = {
  id: '1',
  title: '静夜思',
  author: '李白',
  dynasty: 'tang',
  authorBackground: '',
  lines: ['床前明月光', '疑是地上霜', '举头望明月', '低头思故乡'],
  addedAt: 1000,
}

function makeProps(overrides = {}) {
  return {
    voiceState: 'idle' as VoiceState,
    startListening: vi.fn(),
    speakLines: vi.fn(),
    stop: vi.fn(),
    isSTTSupported: false,
    libraryPoems: [poem],
    ttsRate: 1.0,
    setTtsRate: vi.fn(),
    onPoemUpdated: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

function loadPoem() {
  const input = screen.getByPlaceholderText('输入诗名或诗句...')
  fireEvent.change(input, { target: { value: '静夜思' } })
  fireEvent.keyDown(input, { key: 'Enter' })
}

describe('ListenTab char annotation', () => {
  it('saves new annotation to library when onCharAnnotate fires', async () => {
    const onPoemUpdated = vi.fn().mockResolvedValue(undefined)
    render(<ListenTab {...makeProps({ onPoemUpdated })} />)
    loadPoem()

    // Simulate PoemPlayer calling onCharAnnotate prop by triggering the long-press flow
    vi.useFakeTimers()
    const charSpan = document.querySelector('.poem-line span') as Element
    fireEvent.touchStart(charSpan)
    act(() => { vi.advanceTimersByTime(500) })
    fireEvent.change(screen.getByPlaceholderText('拼音 (e.g. huán)'), { target: { value: 'huán' } })
    fireEvent.change(screen.getByPlaceholderText('替换字 (e.g. 环)'), { target: { value: '环' } })
    fireEvent.click(screen.getByRole('button', { name: '保存' }))
    vi.useRealTimers()

    await waitFor(() => {
      expect(savePoem).toHaveBeenCalledWith(
        expect.objectContaining({
          charAnnotations: expect.arrayContaining([
            expect.objectContaining({ pinyin: 'huán', substitute: '环' }),
          ]),
        })
      )
    })
    expect(onPoemUpdated).toHaveBeenCalled()
  })

  it('removes annotation from library when onCharAnnotateRemove fires', async () => {
    const poemWithAnnotation: SavedPoem = {
      ...poem,
      charAnnotations: [{ lineIndex: 0, charIndex: 0, pinyin: 'chuáng', substitute: '床' }],
    }
    const onPoemUpdated = vi.fn().mockResolvedValue(undefined)
    render(<ListenTab {...makeProps({ libraryPoems: [poemWithAnnotation], onPoemUpdated })} />)
    loadPoem()

    vi.useFakeTimers()
    const rubyEl = document.querySelector('.poem-line ruby') as Element
    fireEvent.touchStart(rubyEl)
    act(() => { vi.advanceTimersByTime(500) })
    fireEvent.click(screen.getByRole('button', { name: '删除' }))
    vi.useRealTimers()

    await waitFor(() => {
      expect(savePoem).toHaveBeenCalledWith(
        expect.objectContaining({ charAnnotations: [] })
      )
    })
  })

  it('uses substitute text when speaking tapped line with annotation', () => {
    const annotatedPoem: SavedPoem = {
      ...poem,
      lines: ['千里江陵一日还', '两岸猿声啼不住'],
      charAnnotations: [{ lineIndex: 0, charIndex: 6, pinyin: 'huán', substitute: '环' }],
    }
    const speakLines = vi.fn()
    render(<ListenTab {...makeProps({ libraryPoems: [annotatedPoem], speakLines })} />)
    loadPoem()

    speakLines.mockClear()
    fireEvent.click(screen.getByText('千里江陵一日还'))
    expect(speakLines).toHaveBeenCalledWith(
      ['千里江陵一日环'],
      expect.any(Function),
      expect.any(Function),
    )
  })
})
```

- [ ] **Step 2: Run to confirm RED**

```bash
npx vitest run tests/components/ListenTab.charAnnotation.test.tsx
```

Expected: all 3 fail.

- [ ] **Step 3: Add import to `ListenTab.tsx`**

At the top of `src/components/ListenTab.tsx`, add:

```typescript
import { buildTtsLine } from '../utils/charAnnotation'
```

- [ ] **Step 4: Add `handleCharAnnotate` and `handleCharAnnotateRemove` to `ListenTab.tsx`**

In `ListenTab.tsx`, after `handleLineBoldToggle`, add:

```typescript
  async function handleCharAnnotate(lineIndex: number, charIndex: number, pinyin: string, substitute: string) {
    if (!currentPoem) return
    const existing = currentPoem.charAnnotations ?? []
    const filtered = existing.filter((a) => !(a.lineIndex === lineIndex && a.charIndex === charIndex))
    const charAnnotations = [...filtered, { lineIndex, charIndex, pinyin, substitute }]
    const updated = { ...currentPoem, charAnnotations }
    setPoem(updated)
    await savePoem(updated)
    await onPoemUpdated()
  }

  async function handleCharAnnotateRemove(lineIndex: number, charIndex: number) {
    if (!currentPoem) return
    const charAnnotations = (currentPoem.charAnnotations ?? [])
      .filter((a) => !(a.lineIndex === lineIndex && a.charIndex === charIndex))
    const updated = { ...currentPoem, charAnnotations }
    setPoem(updated)
    await savePoem(updated)
    await onPoemUpdated()
  }
```

- [ ] **Step 5: Wire props and fix `onSpeakLine` in `<PoemPlayer>` in `ListenTab.tsx`**

Find the `<PoemPlayer>` render block and update `onSpeakLine` and add the two new props:

```typescript
          onSpeakLine={(lineIndex) => {
            stop()
            const line = currentPoem.lines[lineIndex]
            const ttsText = buildTtsLine(line, lineIndex, currentPoem.charAnnotations ?? [])
            speakLines([ttsText], () => {}, () => {})
          }}
          onCharAnnotate={handleCharAnnotate}
          onCharAnnotateRemove={handleCharAnnotateRemove}
```

- [ ] **Step 6: Apply `buildTtsLine` at full-poem TTS call sites**

There are four sites where `poem.lines` is passed to `speakLines` for full playback. Update each:

**Repeat play (line ~149):** Change:
```typescript
        speakLines(current.lines, (i) => setHighlightedLine(i), handlePoemDone)
```
To:
```typescript
        speakLines(
          current.lines.map((l, i) => buildTtsLine(l, i, current.charAnnotations ?? [])),
          (i) => setHighlightedLine(i),
          handlePoemDone,
        )
```

**Autoplay next poem (line ~180):** Change:
```typescript
          speakLines(next.lines, (i) => setHighlightedLine(i), handlePoemDone)
```
To:
```typescript
          speakLines(
            next.lines.map((l, i) => buildTtsLine(l, i, next.charAnnotations ?? [])),
            (i) => setHighlightedLine(i),
            handlePoemDone,
          )
```

**After text search, single result (line ~394):** Change:
```typescript
      speakLines(results[0].lines, (i) => setHighlightedLine(i), handlePoemDone)
```
To:
```typescript
      speakLines(
        results[0].lines.map((l, i) => buildTtsLine(l, i, results[0].charAnnotations ?? [])),
        (i) => setHighlightedLine(i),
        handlePoemDone,
      )
```

**After pick match (line ~404):** Change:
```typescript
    speakLines(match.lines, (i) => setHighlightedLine(i), handlePoemDone)
```
To:
```typescript
    speakLines(
      match.lines.map((l, i) => buildTtsLine(l, i, match.charAnnotations ?? [])),
      (i) => setHighlightedLine(i),
      handlePoemDone,
    )
```

**PoemPlayer `onPlay` callback (line ~625):** Change:
```typescript
          onPlay={(lines, onLineStart, onDone) => {
            stopRecitingSession()
            speakLines(
              lines,
              (i) => { setHighlightedLine(i); onLineStart(i) },
              () => { onDone(); setHighlightedLine(null); handlePoemDone() },
            )
          }}
```
To:
```typescript
          onPlay={(lines, onLineStart, onDone) => {
            stopRecitingSession()
            const ttsLines = lines.map((l, idx) => buildTtsLine(l, idx, currentPoem.charAnnotations ?? []))
            speakLines(
              ttsLines,
              (i) => { setHighlightedLine(i); onLineStart(i) },
              () => { onDone(); setHighlightedLine(null); handlePoemDone() },
            )
          }}
```

- [ ] **Step 7: Apply `buildTtsLine` to recitation's `expected` speak call**

In `beginReciteListening`, find:

```typescript
      speakLines([expected], () => setHighlightedLine(null), () => {
        listenForCorrection(sentenceIndex)
      })
```

The `expected` is a display sentence from `getDisplaySentences`. To apply annotations, build TTS source lines and re-derive display sentences from them. Replace that block with:

```typescript
      const ttsSourceLines = poem.lines.map((l, i) => buildTtsLine(l, i, poem.charAnnotations ?? []))
      const ttsExpected = getDisplaySentences(ttsSourceLines)[sentenceIndex]
      speakLines([ttsExpected], () => setHighlightedLine(null), () => {
        listenForCorrection(sentenceIndex)
      })
```

- [ ] **Step 8: Run tests to confirm GREEN**

```bash
npx vitest run tests/components/ListenTab.charAnnotation.test.tsx
```

Expected: 3 passed.

- [ ] **Step 9: Run full suite**

```bash
npx vitest run
```

Expected: all passing.

- [ ] **Step 10: Build check**

```bash
npm run build
```

Expected: no TypeScript errors, `✓ built in ...`

- [ ] **Step 11: Commit**

```bash
git add src/components/ListenTab.tsx tests/components/ListenTab.charAnnotation.test.tsx
git commit -m "feat: wire char annotation handlers and TTS substitution in ListenTab"
```

---

## Verification

After all tasks complete:

```bash
npx vitest run   # all green
npm run build    # no TypeScript errors
```

Manual test on device:
1. Open a poem → long-press any character (hold ~0.5s) → popup appears with empty fields
2. Enter pinyin (e.g. `huán`) and substitute char (e.g. `环`) → tap 保存
3. The character shows `huán` above it in small text
4. Tap 朗读 → TTS reads `环` instead of `还` at that position
5. Long-press the annotated character again → popup shows pre-filled fields and a 删除 button
6. Tap 删除 → annotation removed, ruby gone
7. Close and reopen the poem → annotation persists

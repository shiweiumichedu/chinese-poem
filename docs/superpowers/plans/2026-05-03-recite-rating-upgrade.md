# Recitation Rating Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After a perfect recitation (no "重复" spoken), ask the user "要不要加颗星" and increment the poem's rating if they confirm.

**Architecture:** Add a `hasRepeatRef` boolean ref to `ListenTab` that is set whenever "重复" is spoken during `beginReciteListening`. At end of session in `advanceReciteSentence`, a new `else if` branch checks `!hasRepeatRef && rating < 5` and runs the prompt/save flow, symmetric to the existing "lower star" branch.

**Tech Stack:** React 18, TypeScript, Vitest + Testing Library, IndexedDB (via `savePoem`)

---

## Files

- Modify: `src/components/ListenTab.tsx`
- Create: `tests/components/ListenTab.reciteRating.test.tsx`

---

### Task 1: Write failing tests

**Files:**
- Create: `tests/components/ListenTab.reciteRating.test.tsx`

The test poem is `['床前明月光', '疑是地上霜', '举头望明月', '低头思故乡']` (4 × 5-char lines → 4 recite sentences).  
Helper `driveRecitation` fires the speakLines done-callbacks and startListening result-callbacks in the correct order to simulate a complete recitation with all first-try correct answers.

**speakLines call order during a clean recitation (after an initial `handleSearch` call):**
- index 0: `poem.lines` (from `handleSearch`)
- index 1: `['第一句']` (from `startReciting`)
- index 2: `['第二句']` (from `advanceReciteSentence(1)`)
- index 3: `['第三句']`
- index 4: `['第四句']`
- index 5: `['要不要加颗星']` ← NEW (after all 4 sentences answered correctly)

**startListening call order:**
- index 0: sentence 0 listener (fires after `done_1`)
- index 1: sentence 1 listener
- index 2: sentence 2 listener
- index 3: sentence 3 listener
- index 4: yes/no listener (fires after `done_5`, the "加颗星" prompt done)

- [ ] **Step 1: Create the test file**

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { act } from 'react'
import { waitFor } from '@testing-library/react'
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
  addedAt: 0,
  rating: 3,
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

/** Loads the poem via text search and returns callback arrays. */
function loadPoem(
  speakLines: ReturnType<typeof vi.fn>,
  startListening: ReturnType<typeof vi.fn>,
) {
  const speakLinesDones: (() => void)[] = []
  const startListeningCallbacks: ((text: string) => void)[] = []
  speakLines.mockImplementation((_lines: string[], _onLineStart: () => void, onDone: () => void) => {
    speakLinesDones.push(onDone)
  })
  startListening.mockImplementation((onResult: (text: string) => void) => {
    startListeningCallbacks.push(onResult)
  })

  const input = screen.getByPlaceholderText('输入诗名或诗句...')
  fireEvent.change(input, { target: { value: '静夜思' } })
  fireEvent.click(screen.getByRole('button', { name: '搜索' }))
  // speakLines[0] = poem.lines (from handleSearch)

  return { speakLinesDones, startListeningCallbacks }
}

/** Drives a perfect 4-sentence recitation. Assumes poem has been loaded (speakLinesDones[0] set). */
function drivePerfectRecitation(
  speakLinesDones: (() => void)[],
  startListeningCallbacks: ((text: string) => void)[],
) {
  const sentences = ['床前明月光', '疑是地上霜', '举头望明月', '低头思故乡']
  // Click 背诵 → speakLines(['第一句']) appended at index 1
  fireEvent.click(screen.getByRole('button', { name: '背诵' }))
  // Drive each sentence
  act(() => speakLinesDones[1]()) // 第一句 done → beginReciteListening(0)
  act(() => startListeningCallbacks[0](sentences[0]))
  act(() => speakLinesDones[2]()) // 第二句 done → beginReciteListening(1)
  act(() => startListeningCallbacks[1](sentences[1]))
  act(() => speakLinesDones[3]()) // 第三句 done → beginReciteListening(2)
  act(() => startListeningCallbacks[2](sentences[2]))
  act(() => speakLinesDones[4]()) // 第四句 done → beginReciteListening(3)
  act(() => startListeningCallbacks[3](sentences[3]))
  // advanceReciteSentence(4) fires → end of session
}

describe('ListenTab recitation rating upgrade', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('offers 要不要加颗星 after perfect recitation when rating < 5', () => {
    const speakLines = vi.fn()
    const startListening = vi.fn()
    render(<ListenTab {...makeProps({ speakLines, startListening })} />)
    const { speakLinesDones, startListeningCallbacks } = loadPoem(speakLines, startListening)

    drivePerfectRecitation(speakLinesDones, startListeningCallbacks)

    const spoken = speakLines.mock.calls.map((c: unknown[]) => c[0])
    expect(spoken).toContainEqual(['要不要加颗星'])
  })

  it('does not offer 加颗星 when poem is already rated 5 stars', () => {
    const poem5 = { ...poem, rating: 5 }
    const speakLines = vi.fn()
    const startListening = vi.fn()
    render(<ListenTab {...makeProps({ speakLines, startListening, libraryPoems: [poem5] })} />)
    const { speakLinesDones, startListeningCallbacks } = loadPoem(speakLines, startListening)

    drivePerfectRecitation(speakLinesDones, startListeningCallbacks)

    const spoken = speakLines.mock.calls.map((c: unknown[]) => c[0])
    expect(spoken).not.toContainEqual(['要不要加颗星'])
  })

  it('saves rating + 1 and speaks 已加一颗星 when user says 要', async () => {
    const speakLines = vi.fn()
    const startListening = vi.fn()
    const onPoemUpdated = vi.fn().mockResolvedValue(undefined)
    render(<ListenTab {...makeProps({ speakLines, startListening, onPoemUpdated })} />)
    const { speakLinesDones, startListeningCallbacks } = loadPoem(speakLines, startListening)

    drivePerfectRecitation(speakLinesDones, startListeningCallbacks)

    // speakLines[5] = ['要不要加颗星']; fire its done callback → startListening[4]
    act(() => speakLinesDones[5]())
    act(() => startListeningCallbacks[4]('要'))

    const spoken = speakLines.mock.calls.map((c: unknown[]) => c[0])
    expect(spoken).toContainEqual(['已加一颗星'])
    await waitFor(() =>
      expect(savePoem).toHaveBeenCalledWith(expect.objectContaining({ rating: 4 }))
    )
  })

  it('skips savePoem and proceeds to complete when user says 不要', () => {
    const speakLines = vi.fn()
    const startListening = vi.fn()
    render(<ListenTab {...makeProps({ speakLines, startListening })} />)
    const { speakLinesDones, startListeningCallbacks } = loadPoem(speakLines, startListening)

    drivePerfectRecitation(speakLinesDones, startListeningCallbacks)

    act(() => speakLinesDones[5]())
    act(() => startListeningCallbacks[4]('不要'))

    const spoken = speakLines.mock.calls.map((c: unknown[]) => c[0])
    expect(spoken).not.toContainEqual(['已加一颗星'])
    expect(spoken).toContainEqual(['背诵完成'])
    expect(savePoem).not.toHaveBeenCalled()
  })

  it('does not offer 加颗星 when 重复 was spoken (wrong first-try answer)', () => {
    const speakLines = vi.fn()
    const startListening = vi.fn()
    render(<ListenTab {...makeProps({ speakLines, startListening })} />)
    const { speakLinesDones, startListeningCallbacks } = loadPoem(speakLines, startListening)

    // Click 背诵 → speakLines('第一句') at index 1
    fireEvent.click(screen.getByRole('button', { name: '背诵' }))

    // Sentence 0: wrong first answer → triggers 重复
    act(() => speakLinesDones[1]()) // 第一句 done → beginReciteListening(0)
    act(() => startListeningCallbacks[0]('错误的答案'))
    // speakLines[2]='重复', speakLines[3]='床前明月光' (expected) → listenForCorrection
    act(() => speakLinesDones[2]()) // 重复 done
    act(() => speakLinesDones[3]()) // expected line done → listenForCorrection(0)
    // Correct on second try → advanceReciteSentence(1) → speakLines['正确'] at 4
    act(() => startListeningCallbacks[1]('床前明月光'))
    act(() => speakLinesDones[4]()) // 正确 done → advanceReciteSentence(1) → 第二句 at 5
    // Sentences 1–3: correct
    act(() => speakLinesDones[5]()) // 第二句 done
    act(() => startListeningCallbacks[2]('疑是地上霜'))
    act(() => speakLinesDones[6]()) // 第三句 done
    act(() => startListeningCallbacks[3]('举头望明月'))
    act(() => speakLinesDones[7]()) // 第四句 done
    act(() => startListeningCallbacks[4]('低头思故乡'))

    const spoken = speakLines.mock.calls.map((c: unknown[]) => c[0])
    expect(spoken).not.toContainEqual(['要不要加颗星'])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/components/ListenTab.reciteRating.test.tsx
```

Expected: all 5 tests fail (feature not yet implemented).

- [ ] **Step 3: Commit test file**

```bash
git add tests/components/ListenTab.reciteRating.test.tsx
git commit -m "test: add failing tests for recitation rating upgrade prompt"
```

---

### Task 2: Implement the feature

**Files:**
- Modify: `src/components/ListenTab.tsx`

- [ ] **Step 1: Add `hasRepeatRef` declaration**

In `src/components/ListenTab.tsx`, find this line (around line 113):

```typescript
const hasWrongAnswerRef = useRef(false)
```

Add immediately after it:

```typescript
const hasRepeatRef = useRef(false)
```

- [ ] **Step 2: Reset `hasRepeatRef` in `stopRecitingSession`**

Find `stopRecitingSession` (around line 203):

```typescript
function stopRecitingSession() {
  setReciting(false)
  setReciteSentenceIndex(0)
  setRecognizedText('')
  recitingRef.current = false
  hasWrongAnswerRef.current = false
}
```

Replace with:

```typescript
function stopRecitingSession() {
  setReciting(false)
  setReciteSentenceIndex(0)
  setRecognizedText('')
  recitingRef.current = false
  hasWrongAnswerRef.current = false
  hasRepeatRef.current = false
}
```

- [ ] **Step 3: Reset `hasRepeatRef` in `startReciting`**

Find these lines in `startReciting` (around line 330):

```typescript
stop()
hasWrongAnswerRef.current = false
setHighlightedLine(null)
```

Replace with:

```typescript
stop()
hasWrongAnswerRef.current = false
hasRepeatRef.current = false
setHighlightedLine(null)
```

- [ ] **Step 4: Set `hasRepeatRef` in `beginReciteListening` before saying 重复**

Find these lines in `beginReciteListening` (around line 316):

```typescript
      speakLines(['重复'], () => setHighlightedLine(null), () => {
        speakLines([expected], () => setHighlightedLine(null), () => {
          listenForCorrection(sentenceIndex)
        })
      })
```

Replace with:

```typescript
      hasRepeatRef.current = true
      speakLines(['重复'], () => setHighlightedLine(null), () => {
        speakLines([expected], () => setHighlightedLine(null), () => {
          listenForCorrection(sentenceIndex)
        })
      })
```

- [ ] **Step 5: Add "add star" branch in `advanceReciteSentence`**

Find the end-of-session block in `advanceReciteSentence` (around line 242). The current closing `else` branch looks like:

```typescript
      } else {
        proceedToComplete()
      }
```

Replace the full `if/else` block (starting at `if (hasWrongAnswerRef.current`) with:

```typescript
      if (hasWrongAnswerRef.current && (poem.rating ?? 0) >= 2) {
        speakLines(['要不要降一颗星？'], () => setHighlightedLine(null), () => {
          startListening((spokenText) => {
            if (isYes(spokenText)) {
              const currentRating = poem.rating ?? 0
              const updated = { ...poem, rating: currentRating - 1 }
              setPoem(updated)
              void (async () => {
                try {
                  await savePoem(updated)
                  await onPoemUpdated()
                } catch (e) {
                  console.error('Failed to save rating update', e)
                }
              })()
              speakLines(['已降一颗星'], () => setHighlightedLine(null), proceedToComplete)
            } else {
              proceedToComplete()
            }
          }, proceedToComplete)
        })
      } else if (!hasRepeatRef.current && (poem.rating ?? 0) < 5) {
        speakLines(['要不要加颗星'], () => setHighlightedLine(null), () => {
          startListening((spokenText) => {
            if (isYes(spokenText)) {
              const currentRating = poem.rating ?? 0
              const updated = { ...poem, rating: currentRating + 1 }
              setPoem(updated)
              void (async () => {
                try {
                  await savePoem(updated)
                  await onPoemUpdated()
                } catch (e) {
                  console.error('Failed to save rating update', e)
                }
              })()
              speakLines(['已加一颗星'], () => setHighlightedLine(null), proceedToComplete)
            } else {
              proceedToComplete()
            }
          }, proceedToComplete)
        })
      } else {
        proceedToComplete()
      }
```

- [ ] **Step 6: Run the new tests**

```bash
npx vitest run tests/components/ListenTab.reciteRating.test.tsx
```

Expected: all 5 tests pass.

- [ ] **Step 7: Run the full test suite**

```bash
npm run test
```

Expected: all tests pass with no regressions.

- [ ] **Step 8: Commit**

```bash
git add src/components/ListenTab.tsx
git commit -m "feat: offer to add a star after perfect recitation"
```

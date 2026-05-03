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
    // onIdle (second arg) intentionally not captured — tests drive all transitions manually
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
  // advanceReciteSentence(4) fires → end of session → speakLines[5]='要不要加颗星' (when feature is active)
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
    expect(spoken).toContainEqual(['要不要加颗星？'])
  })

  it('does not offer 加颗星 when poem is already rated 5 stars', () => {
    const poem5 = { ...poem, rating: 5 }
    const speakLines = vi.fn()
    const startListening = vi.fn()
    render(<ListenTab {...makeProps({ speakLines, startListening, libraryPoems: [poem5] })} />)
    const { speakLinesDones, startListeningCallbacks } = loadPoem(speakLines, startListening)

    drivePerfectRecitation(speakLinesDones, startListeningCallbacks)

    const spoken = speakLines.mock.calls.map((c: unknown[]) => c[0])
    expect(spoken).not.toContainEqual(['要不要加颗星？'])
  })

  it('saves rating + 1 and speaks 已加一颗星 when user says 要', async () => {
    const speakLines = vi.fn()
    const startListening = vi.fn()
    const onPoemUpdated = vi.fn().mockResolvedValue(undefined)
    render(<ListenTab {...makeProps({ speakLines, startListening, onPoemUpdated })} />)
    const { speakLinesDones, startListeningCallbacks } = loadPoem(speakLines, startListening)

    drivePerfectRecitation(speakLinesDones, startListeningCallbacks)

    // speakLines[5] = ['要不要加颗星？']; fire its done callback → startListening[4]
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
    // Correct on second try → speakLines[4]='正确', done → advanceReciteSentence(1) → speakLines[5]='第二句'
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
    expect(spoken).not.toContainEqual(['要不要加颗星？'])
  })
})

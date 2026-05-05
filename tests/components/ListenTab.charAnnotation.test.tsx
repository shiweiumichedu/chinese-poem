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
    fireEvent.click(screen.getByText('千').closest('p')!)
    expect(speakLines).toHaveBeenCalledWith(
      ['千里江陵一日环'],
      expect.any(Function),
      expect.any(Function),
    )
  })
})

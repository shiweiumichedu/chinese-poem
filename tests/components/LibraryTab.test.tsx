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

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

const savedPoem: SavedPoem = { ...corpusPoem, addedAt: 1000 }

function makeProps(overrides = {}) {
  return {
    voiceState: 'idle' as VoiceState,
    startListening: vi.fn(),
    speakLines: vi.fn(),
    stop: vi.fn(),
    isSTTSupported: true,
    corpus: [corpusPoem],
    corpusLoading: false,
    savedPoems: [],
    onPoemSelect: vi.fn(),
    onPoemAdded: vi.fn(),
    ...overrides,
  }
}

describe('LibraryTab', () => {
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

  it('shows "正在加载诗库..." when corpusLoading is true', () => {
    render(<LibraryTab {...makeProps({ corpusLoading: true })} />)
    expect(screen.getByText('正在加载诗库...')).toBeInTheDocument()
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

    // PoemPreview should be visible with confirm/cancel buttons
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
})

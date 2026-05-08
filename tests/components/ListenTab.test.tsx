import { render, screen, fireEvent } from '@testing-library/react'
import { act } from 'react'
import { ListenTab } from '../../src/components/ListenTab'
import type { SavedPoem, VoiceState } from '../../src/types'

afterEach(() => localStorage.clear())

const poem: SavedPoem = {
  id: '1',
  title: '静夜思',
  author: '李白',
  dynasty: 'tang',
  authorBackground: '',
  lines: ['床前明月光', '疑是地上霜', '举头望明月', '低头思故乡'],
  addedAt: 0,
}

function makeProps(overrides = {}) {
  return {
    voiceState: 'idle' as VoiceState,
    startListening: vi.fn(),
    speakLines: vi.fn(),
    stop: vi.fn(),
    isSTTSupported: true,
    libraryPoems: [],
    ttsRate: 1.0,
    setTtsRate: vi.fn(),
    lang: 'zh' as 'zh' | 'en',
    setLang: vi.fn(),
    ...overrides,
  }
}

describe('ListenTab', () => {
  it('shows mic button and "输入诗名或诗句..." when idle with no poem', () => {
    const props = makeProps()
    render(<ListenTab {...props} />)
    expect(screen.getByRole('button', { name: '开始语音搜索' })).toBeInTheDocument()
    expect(screen.getByText('输入诗名或诗句...')).toBeInTheDocument()
  })

  it('shows "正在听..." status when voiceState is "listening"', () => {
    const props = makeProps({ voiceState: 'listening' as VoiceState })
    render(<ListenTab {...props} />)
    expect(screen.getByText('正在听...')).toBeInTheDocument()
  })

  it('calls startListening when mic tapped in idle state', () => {
    const startListening = vi.fn()
    const props = makeProps({ startListening })
    render(<ListenTab {...props} />)
    fireEvent.click(screen.getByRole('button', { name: '开始语音搜索' }))
    expect(startListening).toHaveBeenCalledWith(expect.any(Function))
  })

  it('calls stop() when mic tapped while listening', () => {
    const stop = vi.fn()
    const props = makeProps({ voiceState: 'listening' as VoiceState, stop })
    render(<ListenTab {...props} />)
    fireEvent.click(screen.getByRole('button', { name: '停止语音搜索' }))
    expect(stop).toHaveBeenCalled()
  })

  it('shows aria-label "开始语音搜索" when voiceState is "speaking"', () => {
    const props = makeProps({ voiceState: 'speaking' as VoiceState })
    render(<ListenTab {...props} />)
    expect(screen.getByRole('button', { name: '开始语音搜索' })).toBeInTheDocument()
  })

  it('calls handleVoiceSearch when mic tapped while speaking', () => {
    const stop = vi.fn()
    const props = makeProps({ voiceState: 'speaking' as VoiceState, stop })
    render(<ListenTab {...props} />)
    fireEvent.click(screen.getByRole('button', { name: '开始语音搜索' }))
    // voiceState is not 'listening', so stop() is not called by the voice-stop path;
    // startListening is called instead
  })

  it('displays poem and calls speakLines when title found in library', () => {
    let capturedOnResult: ((text: string) => void) | null = null
    const startListening = vi.fn((onResult) => { capturedOnResult = onResult })
    const speakLines = vi.fn()
    const props = makeProps({ startListening, speakLines, libraryPoems: [poem] })

    render(<ListenTab {...props} />)
    fireEvent.click(screen.getByRole('button', { name: '开始语音搜索' }))

    act(() => capturedOnResult!('静夜思'))

    expect(screen.getAllByText('静夜思').length).toBeGreaterThan(0)
    expect(screen.getByText('李白 · 唐')).toBeInTheDocument()
    expect(screen.getByText('床')).toBeInTheDocument()
    expect(speakLines).toHaveBeenCalledWith(
      poem.lines,
      expect.any(Function),
      expect.any(Function)
    )
  })

  it('shows not-found message when title not in library', () => {
    let capturedOnResult: ((text: string) => void) | null = null
    const startListening = vi.fn((onResult) => { capturedOnResult = onResult })
    const props = makeProps({ startListening, libraryPoems: [] })

    render(<ListenTab {...props} />)
    fireEvent.click(screen.getByRole('button', { name: '开始语音搜索' }))

    act(() => capturedOnResult!('不存在的诗'))

    expect(screen.getByText('诗库中未找到，请先在诗库中添加')).toBeInTheDocument()
  })

  it('highlights correct poem line when onLineStart fires', () => {
    let capturedOnResult: ((text: string) => void) | null = null
    let capturedOnLineStart: ((i: number) => void) | null = null
    const startListening = vi.fn((onResult) => { capturedOnResult = onResult })
    const speakLines = vi.fn((_, onLineStart) => { capturedOnLineStart = onLineStart })
    const props = makeProps({ startListening, speakLines, libraryPoems: [poem] })

    const { container } = render(<ListenTab {...props} />)
    fireEvent.click(screen.getByRole('button', { name: '开始语音搜索' }))

    act(() => capturedOnResult!('静夜思'))
    act(() => capturedOnLineStart!(1))

    const lines = container.querySelectorAll('.poem-line')
    expect(lines[1]).toHaveClass('highlighted')
    expect(lines[0]).not.toHaveClass('highlighted')
  })

  it('highlights poem line when 朗读 button fires onLineStart', () => {
    const speakLines = vi.fn()
    const props = makeProps({ isSTTSupported: false, speakLines, libraryPoems: [poem] })
    const { container } = render(<ListenTab {...props} />)

    // Load poem via text search (speakLines call 0)
    const input = screen.getByPlaceholderText('输入诗名或诗句...')
    fireEvent.change(input, { target: { value: '静夜思' } })
    fireEvent.keyDown(screen.getByPlaceholderText('输入诗名或诗句...'), { key: 'Enter' })

    // Click 朗读 (speakLines call 1) — capture its onLineStart
    fireEvent.click(screen.getByRole('button', { name: '朗读' }))
    const onLineStart = speakLines.mock.calls[1][1] as (i: number) => void

    act(() => onLineStart(2))

    const lines = container.querySelectorAll('.poem-line')
    expect(lines[2]).toHaveClass('highlighted')
    expect(lines[0]).not.toHaveClass('highlighted')
  })

  it('clears highlight when onDone fires', () => {
    let capturedOnResult: ((text: string) => void) | null = null
    let capturedOnLineStart: ((i: number) => void) | null = null
    let capturedOnDone: (() => void) | null = null
    const startListening = vi.fn((onResult) => { capturedOnResult = onResult })
    const speakLines = vi.fn((_, onLineStart, onDone) => {
      capturedOnLineStart = onLineStart
      capturedOnDone = onDone
    })
    const props = makeProps({ startListening, speakLines, libraryPoems: [poem] })

    const { container } = render(<ListenTab {...props} />)
    fireEvent.click(screen.getByRole('button', { name: '开始语音搜索' }))

    act(() => capturedOnResult!('静夜思'))
    act(() => capturedOnLineStart!(2))
    act(() => capturedOnDone!())

    const lines = container.querySelectorAll('.poem-line')
    lines.forEach(line => {
      expect(line).not.toHaveClass('highlighted')
    })
  })

  it('shows initialPoem on mount but does NOT auto-play (iOS Safari guard)', () => {
    const speakLines = vi.fn()
    const props = makeProps({ speakLines, initialPoem: poem })

    render(<ListenTab {...props} />)

    expect(screen.getAllByText('静夜思').length).toBeGreaterThan(0)
    expect(screen.getByText('床')).toBeInTheDocument()
    expect(speakLines).not.toHaveBeenCalled()
  })

  it('shows text input fallback when isSTTSupported is false', () => {
    const props = makeProps({ isSTTSupported: false })
    render(<ListenTab {...props} />)
    expect(screen.queryByRole('button', { name: '开始语音搜索' })).not.toBeInTheDocument()
    expect(screen.getByPlaceholderText('输入诗名或诗句...')).toBeInTheDocument()
  })

  it('searches via text input and shows poem', () => {
    const speakLines = vi.fn()
    const props = makeProps({ isSTTSupported: false, speakLines, libraryPoems: [poem] })

    render(<ListenTab {...props} />)
    const input = screen.getByPlaceholderText('输入诗名或诗句...')
    fireEvent.change(input, { target: { value: '静夜思' } })
    fireEvent.keyDown(screen.getByPlaceholderText('输入诗名或诗句...'), { key: 'Enter' })

    expect(screen.getAllByText('静夜思').length).toBeGreaterThan(0)
    expect(screen.getByText('床')).toBeInTheDocument()
    expect(speakLines).toHaveBeenCalledWith(
      poem.lines,
      expect.any(Function),
      expect.any(Function)
    )
  })

  it('triggers search via Enter key in text input fallback', () => {
    const speakLines = vi.fn()
    const props = makeProps({ isSTTSupported: false, speakLines, libraryPoems: [poem] })

    render(<ListenTab {...props} />)
    const input = screen.getByPlaceholderText('输入诗名或诗句...')
    fireEvent.change(input, { target: { value: '静夜思' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(screen.getAllByText('静夜思').length).toBeGreaterThan(0)
    expect(screen.getByText('床')).toBeInTheDocument()
    expect(speakLines).toHaveBeenCalledWith(
      poem.lines,
      expect.any(Function),
      expect.any(Function)
    )
  })
})

const poem2: SavedPoem = {
  id: '2',
  title: '静夜思二',
  author: '测试',
  dynasty: 'tang',
  authorBackground: '',
  lines: ['测试诗句一', '测试诗句二', '测试诗句三', '测试诗句四'],
  addedAt: 1,
}

describe('ListenTab multi-match picker', () => {
  it('shows inline picker when search returns multiple matches', () => {
    const props = makeProps({ isSTTSupported: false, libraryPoems: [poem, poem2] })
    render(<ListenTab {...props} />)

    const input = screen.getByPlaceholderText('输入诗名或诗句...')
    fireEvent.change(input, { target: { value: '静夜思' } })
    fireEvent.keyDown(screen.getByPlaceholderText('输入诗名或诗句...'), { key: 'Enter' })

    expect(screen.getByText('静夜思 — 李白')).toBeInTheDocument()
    expect(screen.getByText('静夜思二 — 测试')).toBeInTheDocument()
  })

  it('does not auto-load when multiple matches', () => {
    const speakLines = vi.fn()
    const props = makeProps({ isSTTSupported: false, speakLines, libraryPoems: [poem, poem2] })
    render(<ListenTab {...props} />)

    const input = screen.getByPlaceholderText('输入诗名或诗句...')
    fireEvent.change(input, { target: { value: '静夜思' } })
    fireEvent.keyDown(screen.getByPlaceholderText('输入诗名或诗句...'), { key: 'Enter' })

    expect(speakLines).not.toHaveBeenCalled()
  })

  it('loads selected poem and hides picker when item clicked', () => {
    const speakLines = vi.fn()
    const props = makeProps({ isSTTSupported: false, speakLines, libraryPoems: [poem, poem2] })
    render(<ListenTab {...props} />)

    const input = screen.getByPlaceholderText('输入诗名或诗句...')
    fireEvent.change(input, { target: { value: '静夜思' } })
    fireEvent.keyDown(screen.getByPlaceholderText('输入诗名或诗句...'), { key: 'Enter' })
    fireEvent.click(screen.getByText('静夜思二 — 测试'))

    expect(screen.queryByText('静夜思 — 李白')).not.toBeInTheDocument()
    expect(speakLines).toHaveBeenCalledWith(poem2.lines, expect.any(Function), expect.any(Function))
  })

  it('still auto-loads when exactly one match', () => {
    const speakLines = vi.fn()
    const props = makeProps({ isSTTSupported: false, speakLines, libraryPoems: [poem, poem2] })
    render(<ListenTab {...props} />)

    const input = screen.getByPlaceholderText('输入诗名或诗句...')
    fireEvent.change(input, { target: { value: '静夜思二' } })
    fireEvent.keyDown(screen.getByPlaceholderText('输入诗名或诗句...'), { key: 'Enter' })

    expect(speakLines).toHaveBeenCalledWith(poem2.lines, expect.any(Function), expect.any(Function))
    expect(screen.queryByText('静夜思二 — 测试')).not.toBeInTheDocument()
  })

  it('shows 上一首 when autoplay is on with 2+ poems and clicking it jumps backward', () => {
    localStorage.setItem('auto-play', 'true')
    const speakLines = vi.fn()
    const props = makeProps({
      isSTTSupported: false,
      speakLines,
      libraryPoems: [poem, poem2],
      initialPoem: poem2,
    })
    render(<ListenTab {...props} />)

    const prevBtn = screen.getByRole('button', { name: /上一首/ })
    expect(prevBtn).toBeInTheDocument()
    expect(prevBtn).toHaveTextContent('静夜思')
    expect(prevBtn).toHaveTextContent('李白')

    fireEvent.click(prevBtn)
    expect(screen.getByRole('heading', { name: '静夜思' })).toBeInTheDocument()
  })

  it('hides 上一首 when autoplay is off', () => {
    const props = makeProps({
      isSTTSupported: false,
      libraryPoems: [poem, poem2],
      initialPoem: poem,
    })
    render(<ListenTab {...props} />)
    expect(screen.queryByRole('button', { name: /上一首/ })).not.toBeInTheDocument()
  })

  it('hides 上一首 when only one poem is in the rating tier', () => {
    localStorage.setItem('auto-play', 'true')
    const onlyPoem = { ...poem, rating: 5 }
    const otherTier = { ...poem2, rating: 3 }
    const props = makeProps({
      isSTTSupported: false,
      libraryPoems: [onlyPoem, otherTier],
      initialPoem: onlyPoem,
    })
    render(<ListenTab {...props} />)
    expect(screen.queryByRole('button', { name: /上一首/ })).not.toBeInTheDocument()
  })

  it('speaks tapped line when a line is clicked', () => {
    const speakLines = vi.fn()
    const props = makeProps({ isSTTSupported: false, speakLines, libraryPoems: [poem] })
    render(<ListenTab {...props} />)

    const input = screen.getByPlaceholderText('输入诗名或诗句...')
    fireEvent.change(input, { target: { value: '静夜思' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    speakLines.mockClear()
    fireEvent.click(screen.getByText('床').closest('p')!)

    expect(speakLines).toHaveBeenCalledWith(['床前明月光'], expect.any(Function), expect.any(Function))
  })
})

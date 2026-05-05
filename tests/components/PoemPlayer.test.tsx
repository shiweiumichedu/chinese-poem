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
    expect(screen.getByText('床')).toBeInTheDocument()
    expect(screen.getByText('乡')).toBeInTheDocument()
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

  it('renders speed preset buttons 极慢, 较慢, 慢, 正常, 快', () => {
    render(<PoemPlayer {...defaultProps} />)
    expect(screen.getByRole('button', { name: '极慢' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '较慢' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '慢' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '正常' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '快' })).toBeInTheDocument()
  })

  it('marks the active speed preset with aria-pressed="true"', () => {
    render(<PoemPlayer {...defaultProps} ttsRate={0.25} />)
    expect(screen.getByRole('button', { name: '极慢' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: '较慢' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: '慢' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: '正常' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: '快' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('calls setTtsRate(0.25) when 极慢 is clicked', () => {
    const setTtsRate = vi.fn()
    render(<PoemPlayer {...defaultProps} setTtsRate={setTtsRate} />)
    fireEvent.click(screen.getByRole('button', { name: '极慢' }))
    expect(setTtsRate).toHaveBeenCalledWith(0.25)
  })

  it('calls setTtsRate(0.4) when 较慢 is clicked', () => {
    const setTtsRate = vi.fn()
    render(<PoemPlayer {...defaultProps} setTtsRate={setTtsRate} />)
    fireEvent.click(screen.getByRole('button', { name: '较慢' }))
    expect(setTtsRate).toHaveBeenCalledWith(0.4)
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

  it('applies bold class to lines listed in poem.boldLines', () => {
    render(<PoemPlayer {...defaultProps} poem={{ ...poem, boldLines: [0, 2] }} />)
    const lines = document.querySelectorAll('.poem-line')
    expect(lines[0].className).toContain('bold')
    expect(lines[1].className).not.toContain('bold')
    expect(lines[2].className).toContain('bold')
    expect(lines[3].className).not.toContain('bold')
  })

  it('B button appears in edit mode when onLineBoldToggle is provided', () => {
    render(<PoemPlayer {...defaultProps} onLineEdit={vi.fn()} onLineBoldToggle={vi.fn()} />)
    fireEvent.click(screen.getByText('床').closest('p')!)
    expect(screen.getByRole('button', { name: 'B' })).toBeInTheDocument()
  })

  it('B button has active class when line being edited is bold', () => {
    render(
      <PoemPlayer
        {...defaultProps}
        poem={{ ...poem, boldLines: [0] }}
        onLineEdit={vi.fn()}
        onLineBoldToggle={vi.fn()}
      />
    )
    fireEvent.click(screen.getByText('床').closest('p')!)
    expect(screen.getByRole('button', { name: 'B' })).toHaveClass('active')
  })

  it('calls onSpeakLine with line index when a line is tapped', () => {
    const onSpeakLine = vi.fn()
    render(<PoemPlayer {...defaultProps} onSpeakLine={onSpeakLine} />)
    fireEvent.click(screen.getByText('床').closest('p')!)
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

  it('clicking B calls onLineBoldToggle with line index and exits edit mode', () => {
    const onLineBoldToggle = vi.fn()
    render(<PoemPlayer {...defaultProps} onLineEdit={vi.fn()} onLineBoldToggle={onLineBoldToggle} />)
    fireEvent.click(screen.getByText('床').closest('p')!)
    fireEvent.mouseDown(screen.getByRole('button', { name: 'B' }))
    fireEvent.click(screen.getByRole('button', { name: 'B' }))
    expect(onLineBoldToggle).toHaveBeenCalledWith(0)
    expect(screen.queryByRole('button', { name: 'B' })).not.toBeInTheDocument()
  })

})

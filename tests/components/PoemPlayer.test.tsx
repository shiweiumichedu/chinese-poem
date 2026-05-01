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

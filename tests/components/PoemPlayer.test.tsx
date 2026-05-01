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

describe('PoemPlayer', () => {
  it('renders poem title, author, dynasty', () => {
    render(<PoemPlayer poem={poem} onPlay={vi.fn()} onStop={vi.fn()} isPlaying={false} />)
    expect(screen.getByText('静夜思')).toBeInTheDocument()
    expect(screen.getByText(/李白/)).toBeInTheDocument()
    expect(screen.getByText(/李白.*唐/)).toBeInTheDocument()
  })

  it('renders all poem lines', () => {
    render(<PoemPlayer poem={poem} onPlay={vi.fn()} onStop={vi.fn()} isPlaying={false} />)
    expect(screen.getByText('床前明月光')).toBeInTheDocument()
    expect(screen.getByText('低头思故乡')).toBeInTheDocument()
  })

  it('shows 朗读 button when not playing', () => {
    render(<PoemPlayer poem={poem} onPlay={vi.fn()} onStop={vi.fn()} isPlaying={false} />)
    expect(screen.getByRole('button', { name: '朗读' })).toBeInTheDocument()
  })

  it('shows 停止 button when playing', () => {
    render(<PoemPlayer poem={poem} onPlay={vi.fn()} onStop={vi.fn()} isPlaying={true} />)
    expect(screen.getByRole('button', { name: '停止' })).toBeInTheDocument()
  })

  it('calls onPlay with poem lines when 朗读 clicked', () => {
    const onPlay = vi.fn()
    render(<PoemPlayer poem={poem} onPlay={onPlay} onStop={vi.fn()} isPlaying={false} />)
    fireEvent.click(screen.getByRole('button', { name: '朗读' }))
    expect(onPlay).toHaveBeenCalledWith(
      poem.lines,
      expect.any(Function),
      expect.any(Function)
    )
  })

  it('calls onStop when 停止 clicked', () => {
    const onStop = vi.fn()
    render(<PoemPlayer poem={poem} onPlay={vi.fn()} onStop={onStop} isPlaying={true} />)
    fireEvent.click(screen.getByRole('button', { name: '停止' }))
    expect(onStop).toHaveBeenCalled()
  })

  it('highlights the correct line during playback', () => {
    const onPlay = vi.fn()
    render(<PoemPlayer poem={poem} onPlay={onPlay} onStop={vi.fn()} isPlaying={false} />)

    // Click play to register callbacks
    fireEvent.click(screen.getByRole('button', { name: '朗读' }))

    // Extract onLineStart callback from the onPlay call
    const [, onLineStart] = onPlay.mock.calls[0]

    // Simulate onLineStart(1) callback — triggers state update in the same component
    act(() => { onLineStart(1) })

    // Line at index 1 should have 'highlighted' class
    const lines = document.querySelectorAll('.poem-line')
    expect(lines[1].className).toContain('highlighted')
    expect(lines[0].className).not.toContain('highlighted')
  })

  it('renders author background when present', () => {
    render(<PoemPlayer poem={poem} onPlay={vi.fn()} onStop={vi.fn()} isPlaying={false} />)
    expect(screen.getByText('唐代伟大诗人')).toBeInTheDocument()
  })

  it('does not render author background section when empty', () => {
    const noBackground = { ...poem, authorBackground: '' }
    render(<PoemPlayer poem={noBackground} onPlay={vi.fn()} onStop={vi.fn()} isPlaying={false} />)
    expect(screen.queryByText('唐代伟大诗人')).not.toBeInTheDocument()
  })
})

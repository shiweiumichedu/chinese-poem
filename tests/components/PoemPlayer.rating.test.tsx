import { render, screen, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { PoemPlayer } from '../../src/components/PoemPlayer'
import type { SavedPoem } from '../../src/types'

const poem: SavedPoem = {
  id: '1',
  title: '静夜思',
  author: '李白',
  dynasty: 'tang',
  authorBackground: '',
  lines: ['床前明月光', '疑是地上霜', '举头望明月', '低头思故乡'],
  addedAt: 1000,
  rating: 3,
}

const defaultProps = {
  poem,
  onPlay: vi.fn(),
  onStop: vi.fn(),
  isPlaying: false,
  ttsRate: 1.0,
  setTtsRate: vi.fn(),
}

describe('PoemPlayer star rating', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders stars as spans when onRate is not provided', () => {
    render(<PoemPlayer {...defaultProps} />)
    const stars = document.querySelectorAll('.player-star')
    stars.forEach((star) => {
      expect(star.tagName).toBe('SPAN')
    })
  })

  it('renders stars as buttons when onRate is provided', () => {
    const onRate = vi.fn()
    render(<PoemPlayer {...defaultProps} onRate={onRate} />)
    const buttons = screen.getAllByRole('button', { name: /评分/ })
    expect(buttons).toHaveLength(5)
  })

  it('shows confirmation row when a star button is tapped', () => {
    const onRate = vi.fn()
    render(<PoemPlayer {...defaultProps} onRate={onRate} />)
    fireEvent.click(screen.getByRole('button', { name: '评分 4 星' }))
    expect(screen.getByText('设为 4★？')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '确认' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '取消' })).toBeInTheDocument()
  })

  it('calls onRate with tapped value and hides row when 确认 is clicked', () => {
    const onRate = vi.fn()
    render(<PoemPlayer {...defaultProps} onRate={onRate} />)
    fireEvent.click(screen.getByRole('button', { name: '评分 4 星' }))
    fireEvent.click(screen.getByRole('button', { name: '确认' }))
    expect(onRate).toHaveBeenCalledWith(4)
    expect(screen.queryByText('设为 4★？')).not.toBeInTheDocument()
  })

  it('does not call onRate and hides row when 取消 is clicked', () => {
    const onRate = vi.fn()
    render(<PoemPlayer {...defaultProps} onRate={onRate} />)
    fireEvent.click(screen.getByRole('button', { name: '评分 4 星' }))
    fireEvent.click(screen.getByRole('button', { name: '取消' }))
    expect(onRate).not.toHaveBeenCalled()
    expect(screen.queryByText('设为 4★？')).not.toBeInTheDocument()
  })

  it('calls onRate with same value when current star is tapped (toggle-to-clear is caller responsibility)', () => {
    const onRate = vi.fn()
    // poem.rating is 3; tap star 3
    render(<PoemPlayer {...defaultProps} onRate={onRate} />)
    fireEvent.click(screen.getByRole('button', { name: '评分 3 星' }))
    fireEvent.click(screen.getByRole('button', { name: '确认' }))
    // PoemPlayer passes the value through; handleRate in ListenTab handles the toggle
    expect(onRate).toHaveBeenCalledWith(3)
  })

  it('hides confirmation row when poem changes', () => {
    const onRate = vi.fn()
    const { rerender } = render(<PoemPlayer {...defaultProps} onRate={onRate} />)
    fireEvent.click(screen.getByRole('button', { name: '评分 4 星' }))
    expect(screen.getByText('设为 4★？')).toBeInTheDocument()

    const poem2: SavedPoem = { ...poem, id: '2', title: '春晓' }
    rerender(<PoemPlayer {...defaultProps} poem={poem2} onRate={onRate} />)
    expect(screen.queryByText('设为 4★？')).not.toBeInTheDocument()
  })
})

import { render, screen, fireEvent } from '@testing-library/react'
import { PoemPlayer } from '../../src/components/PoemPlayer'
import type { SavedPoem } from '../../src/types'

const basePoem: SavedPoem = {
  id: 'p1',
  title: '静夜思',
  author: '李白',
  dynasty: 'tang',
  authorBackground: '',
  lines: ['床前明月光，', '疑是地上霜。'],
  addedAt: 1000,
}

const poemWithEnglish: SavedPoem = {
  ...basePoem,
  englishLines: ['Before the bed, the moonlight shines,', 'Like frost upon the ground it lies.'],
}

function makeProps(overrides = {}) {
  return {
    poem: basePoem,
    onPlay: vi.fn(),
    onStop: vi.fn(),
    isPlaying: false,
    ttsRate: 1.0,
    setTtsRate: vi.fn(),
    ...overrides,
  }
}

describe('PoemPlayer — English mode', () => {
  it('does not show 中/英 button when lang/setLang not provided', () => {
    render(<PoemPlayer {...makeProps()} />)
    expect(screen.queryByRole('button', { name: /切换为/ })).not.toBeInTheDocument()
  })

  it('shows 中/英 button labeled 切换为英文 when lang is zh', () => {
    render(<PoemPlayer {...makeProps({ lang: 'zh', setLang: vi.fn() })} />)
    expect(screen.getByRole('button', { name: '切换为英文' })).toBeInTheDocument()
  })

  it('shows 中/英 button labeled 切换为中文 when lang is en', () => {
    render(<PoemPlayer {...makeProps({ lang: 'en', setLang: vi.fn(), poem: poemWithEnglish })} />)
    expect(screen.getByRole('button', { name: '切换为中文' })).toBeInTheDocument()
  })

  it('toggle button has unavailable class when poem has no englishLines', () => {
    const { container } = render(
      <PoemPlayer {...makeProps({ lang: 'zh', setLang: vi.fn() })} />
    )
    expect(container.querySelector('.btn-lang.unavailable')).toBeInTheDocument()
  })

  it('toggle calls setLang("en") when poem has englishLines and lang is zh', () => {
    const setLang = vi.fn()
    render(<PoemPlayer {...makeProps({ lang: 'zh', setLang, poem: poemWithEnglish })} />)
    fireEvent.click(screen.getByRole('button', { name: '切换为英文' }))
    expect(setLang).toHaveBeenCalledWith('en')
  })

  it('toggle calls setLang("zh") when lang is en', () => {
    const setLang = vi.fn()
    render(<PoemPlayer {...makeProps({ lang: 'en', setLang, poem: poemWithEnglish })} />)
    fireEvent.click(screen.getByRole('button', { name: '切换为中文' }))
    expect(setLang).toHaveBeenCalledWith('zh')
  })

  it('toggle does nothing when poem has no englishLines and lang is zh', () => {
    const setLang = vi.fn()
    render(<PoemPlayer {...makeProps({ lang: 'zh', setLang })} />)
    fireEvent.click(screen.getByRole('button', { name: '切换为英文' }))
    expect(setLang).not.toHaveBeenCalled()
  })

  it('shows englishLines beneath Chinese lines when lang is en', () => {
    render(<PoemPlayer {...makeProps({ lang: 'en', setLang: vi.fn(), poem: poemWithEnglish })} />)
    expect(screen.getByText('Before the bed, the moonlight shines,')).toBeInTheDocument()
    expect(screen.getByText('Like frost upon the ground it lies.')).toBeInTheDocument()
  })

  it('does not show englishLines when lang is zh', () => {
    render(<PoemPlayer {...makeProps({ lang: 'zh', setLang: vi.fn(), poem: poemWithEnglish })} />)
    expect(screen.queryByText('Before the bed, the moonlight shines,')).not.toBeInTheDocument()
  })

  it('hides 背诵 button when lang is en', () => {
    render(
      <PoemPlayer {...makeProps({ lang: 'en', setLang: vi.fn(), onReciteToggle: vi.fn() })} />
    )
    expect(screen.queryByText('背诵')).not.toBeInTheDocument()
  })

  it('shows 背诵 button when lang is zh', () => {
    render(
      <PoemPlayer {...makeProps({ lang: 'zh', setLang: vi.fn(), onReciteToggle: vi.fn() })} />
    )
    expect(screen.getByText('背诵')).toBeInTheDocument()
  })
})

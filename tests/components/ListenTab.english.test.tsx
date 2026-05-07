import { render, screen, fireEvent } from '@testing-library/react'
import { ListenTab } from '../../src/components/ListenTab'
import type { SavedPoem, VoiceState } from '../../src/types'

vi.mock('../../src/data/PoemLibrary', () => ({
  savePoem: vi.fn().mockResolvedValue(undefined),
  listPoems: vi.fn().mockResolvedValue([]),
  resetDBCache: vi.fn(),
}))

const poem: SavedPoem = {
  id: 'p1',
  title: '静夜思',
  author: '李白',
  dynasty: 'tang',
  authorBackground: '',
  lines: ['床前明月光，', '疑是地上霜。'],
  addedAt: 1000,
}

const poemWithEnglish: SavedPoem = {
  ...poem,
  englishLines: ['Before the bed, the moonlight shines,', 'Like frost upon the ground it lies.'],
}

function makeProps(overrides = {}) {
  return {
    voiceState: 'idle' as VoiceState,
    startListening: vi.fn(),
    speakLines: vi.fn(),
    stop: vi.fn(),
    isSTTSupported: false,
    libraryPoems: [],
    ttsRate: 1.0,
    setTtsRate: vi.fn(),
    onPoemUpdated: vi.fn().mockResolvedValue(undefined),
    lang: 'zh' as 'zh' | 'en',
    setLang: vi.fn(),
    ...overrides,
  }
}

describe('ListenTab — English TTS', () => {
  it('calls speakLines with englishLines and en-US when lang is en and poem has englishLines', () => {
    const speakLines = vi.fn()
    render(
      <ListenTab
        {...makeProps({ speakLines, lang: 'en', initialPoem: poemWithEnglish })}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: '朗读' }))
    expect(speakLines).toHaveBeenCalledWith(
      poemWithEnglish.englishLines,
      expect.any(Function),
      expect.any(Function),
      'en-US'
    )
  })

  it('calls speakLines with Chinese lines when lang is zh', () => {
    const speakLines = vi.fn()
    render(
      <ListenTab
        {...makeProps({ speakLines, lang: 'zh', initialPoem: poemWithEnglish })}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: '朗读' }))
    expect(speakLines).toHaveBeenCalledWith(
      poemWithEnglish.lines,
      expect.any(Function),
      expect.any(Function),
    )
  })

  it('calls speakLines with Chinese lines when lang is en but poem has no englishLines', () => {
    const speakLines = vi.fn()
    render(
      <ListenTab
        {...makeProps({ speakLines, lang: 'en', initialPoem: poem })}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: '朗读' }))
    expect(speakLines).toHaveBeenCalledWith(
      poem.lines,
      expect.any(Function),
      expect.any(Function),
    )
  })
})

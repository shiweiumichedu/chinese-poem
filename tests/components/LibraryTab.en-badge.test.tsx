import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LibraryTab } from '../../src/components/LibraryTab'
import type { CorpusPoem, SavedPoem, VoiceState } from '../../src/types'

vi.mock('../../src/data/PoemLibrary', () => ({
  savePoem: vi.fn().mockResolvedValue(undefined),
  listPoems: vi.fn().mockResolvedValue([]),
  resetDBCache: vi.fn(),
}))

const basePoem: CorpusPoem = {
  id: 'p1',
  title: '静夜思',
  author: '李白',
  dynasty: 'tang',
  authorBackground: '',
  lines: ['床前明月光'],
}

const poemWithTranslation: CorpusPoem = {
  ...basePoem,
  id: 'p1',
  englishLines: ['Before my bed, the moon is bright'],
}

const poemWithoutTranslation: CorpusPoem = {
  ...basePoem,
  id: 'p2',
  title: '春晓',
  author: '孟浩然',
}

const savedWithTranslation: SavedPoem = { ...poemWithTranslation, addedAt: 1000 }
const savedWithoutTranslation: SavedPoem = { ...poemWithoutTranslation, addedAt: 2000 }

function makeProps(overrides = {}) {
  return {
    voiceState: 'idle' as VoiceState,
    startListening: vi.fn(),
    speakLines: vi.fn(),
    stop: vi.fn(),
    isSTTSupported: false,
    corpus: [],
    corpusLoading: false,
    corpusError: null,
    savedPoems: [],
    onPoemSelect: vi.fn(),
    onPoemAdded: vi.fn(),
    ...overrides,
  }
}

describe('EN badge — 我的诗库', () => {
  it('shows EN badge on poem with englishLines', () => {
    render(<LibraryTab {...makeProps({ savedPoems: [savedWithTranslation] })} />)
    const badge = screen.getByLabelText('英文翻译可用')
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveTextContent('EN')
  })

  it('does not show EN badge on poem without englishLines', () => {
    render(<LibraryTab {...makeProps({ savedPoems: [savedWithoutTranslation] })} />)
    expect(screen.queryByLabelText('英文翻译可用')).not.toBeInTheDocument()
  })

  it('shows badge only on translated poem when both are listed', () => {
    render(<LibraryTab {...makeProps({ savedPoems: [savedWithTranslation, savedWithoutTranslation] })} />)
    expect(screen.getAllByLabelText('英文翻译可用')).toHaveLength(1)
  })
})

describe('EN badge — 浏览诗库', () => {
  async function renderBrowse(corpus: CorpusPoem[]) {
    render(<LibraryTab {...makeProps({ corpus, savedPoems: [] })} />)
    const browseTab = screen.getByRole('tab', { name: '浏览诗库' })
    await userEvent.click(browseTab)
  }

  it('shows EN badge on unsaved corpus poem with englishLines', async () => {
    await renderBrowse([poemWithTranslation, poemWithoutTranslation])
    await waitFor(() => {
      expect(screen.getByLabelText('英文翻译可用')).toBeInTheDocument()
    })
  })

  it('does not show EN badge on unsaved corpus poem without englishLines', async () => {
    await renderBrowse([poemWithoutTranslation])
    expect(screen.queryByLabelText('英文翻译可用')).not.toBeInTheDocument()
  })

  it('shows EN badge on already-saved corpus poem with englishLines', async () => {
    render(
      <LibraryTab {...makeProps({ corpus: [poemWithTranslation], savedPoems: [savedWithTranslation] })} />
    )
    const browseTab = screen.getByRole('tab', { name: '浏览诗库' })
    await userEvent.click(browseTab)
    await waitFor(() => {
      expect(screen.getByLabelText('英文翻译可用')).toBeInTheDocument()
    })
  })
})

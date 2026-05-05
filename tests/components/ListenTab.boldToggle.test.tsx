import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ListenTab } from '../../src/components/ListenTab'
import { savePoem } from '../../src/data/PoemLibrary'
import type { SavedPoem, VoiceState } from '../../src/types'

vi.mock('../../src/data/PoemLibrary', () => ({
  savePoem: vi.fn().mockResolvedValue(undefined),
  listPoems: vi.fn().mockResolvedValue([]),
}))

const poem: SavedPoem = {
  id: '1',
  title: '静夜思',
  author: '李白',
  dynasty: 'tang',
  authorBackground: '',
  lines: ['床前明月光', '疑是地上霜', '举头望明月', '低头思故乡'],
  addedAt: 1000,
}

function makeProps(overrides = {}) {
  return {
    voiceState: 'idle' as VoiceState,
    startListening: vi.fn(),
    speakLines: vi.fn(),
    stop: vi.fn(),
    isSTTSupported: false,
    libraryPoems: [poem],
    ttsRate: 1.0,
    setTtsRate: vi.fn(),
    onPoemUpdated: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

describe('ListenTab bold toggle', () => {
  it('saves boldLines toggle to library when B button pressed', async () => {
    const onPoemUpdated = vi.fn().mockResolvedValue(undefined)
    render(<ListenTab {...makeProps({ onPoemUpdated })} />)

    const input = screen.getByPlaceholderText('输入诗名或诗句...')
    fireEvent.change(input, { target: { value: '静夜思' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    fireEvent.click(screen.getByText('床').closest('p')!)
    fireEvent.mouseDown(screen.getByRole('button', { name: 'B' }))
    fireEvent.click(screen.getByRole('button', { name: 'B' }))

    await waitFor(() => {
      expect(savePoem).toHaveBeenCalledWith(expect.objectContaining({ boldLines: [0] }))
    })
    expect(onPoemUpdated).toHaveBeenCalled()
  })
})

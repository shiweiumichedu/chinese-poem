import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import App from '../../src/App'

vi.mock('../../src/hooks/useCorpus', () => ({
  useCorpus: () => ({ corpus: [], loading: false, error: null }),
}))

vi.mock('../../src/data/PoemLibrary', () => ({
  listPoems: vi.fn().mockResolvedValue([]),
  savePoem: vi.fn().mockResolvedValue(undefined),
}))

beforeEach(() => {
  // jsdom doesn't have SpeechRecognition or speechSynthesis
  Object.defineProperty(window, 'SpeechRecognition', { value: undefined, writable: true, configurable: true })
  Object.defineProperty(window, 'webkitSpeechRecognition', { value: undefined, writable: true, configurable: true })
  Object.defineProperty(window, 'speechSynthesis', { value: undefined, writable: true, configurable: true })
})

describe('App', () => {
  it('renders without crashing and shows tab bar with 朗读 and 诗库 buttons', async () => {
    render(<App />)
    expect(screen.getByRole('button', { name: /朗读/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /诗库/ })).toBeInTheDocument()
  })

  it('default tab is listen — shows listen-tab container, not library-tab', async () => {
    const { container } = render(<App />)
    // Check that the listen tab container is present (LibraryTab has 'library-tab', ListenTab has 'listen-tab')
    expect(container.querySelector('.listen-tab')).not.toBeNull()
    expect(container.querySelector('.library-tab')).toBeNull()
  })

  it('clicking 诗库 tab switches to library tab showing empty library message', async () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /诗库/ }))
    await waitFor(() => {
      expect(screen.getByText('诗库为空，请添加诗词')).toBeInTheDocument()
    })
  })
})

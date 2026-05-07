import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SettingsModal } from '../../src/components/SettingsModal'
import { savePoem } from '../../src/data/PoemLibrary'
import type { SavedPoem } from '../../src/types'

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

function makeProps(overrides = {}) {
  return {
    isOpen: true,
    onClose: vi.fn(),
    savedPoems: [poem],
    onPoemAdded: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  global.URL.createObjectURL = vi.fn().mockReturnValue('blob:test')
  global.URL.revokeObjectURL = vi.fn()
  global.alert = vi.fn()
})

describe('SettingsModal', () => {
  it('renders nothing when isOpen is false', () => {
    render(<SettingsModal {...makeProps({ isOpen: false })} />)
    expect(screen.queryByText('设置')).not.toBeInTheDocument()
  })

  it('renders settings heading when open', () => {
    render(<SettingsModal {...makeProps()} />)
    expect(screen.getByText('设置')).toBeInTheDocument()
  })

  it('close button calls onClose', () => {
    const onClose = vi.fn()
    render(<SettingsModal {...makeProps({ onClose })} />)
    fireEvent.click(screen.getByRole('button', { name: '关闭' }))
    expect(onClose).toHaveBeenCalled()
  })

  it('clicking overlay calls onClose', () => {
    const onClose = vi.fn()
    const { container } = render(<SettingsModal {...makeProps({ onClose })} />)
    fireEvent.click(container.querySelector('.settings-overlay')!)
    expect(onClose).toHaveBeenCalled()
  })

  it('export button triggers download with savedPoems JSON', () => {
    const mockClick = vi.fn()
    const originalCreateElement = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'a') {
        const el = { href: '', download: '', click: mockClick } as unknown as HTMLAnchorElement
        return el
      }
      return originalCreateElement(tag)
    })

    render(<SettingsModal {...makeProps()} />)
    fireEvent.click(screen.getByRole('button', { name: '导出诗库' }))

    expect(global.URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob))
    expect(mockClick).toHaveBeenCalled()

    vi.restoreAllMocks()
  })

  it('import updates englishLines for matching poems and calls onPoemAdded', async () => {
    const translated = [{ ...poem, englishLines: ['Before the bed', 'Like frost'] }]
    const file = new File([JSON.stringify(translated)], 'library-translated.json', {
      type: 'application/json',
    })

    const onPoemAdded = vi.fn().mockResolvedValue(undefined)
    render(<SettingsModal {...makeProps({ onPoemAdded })} />)

    const input = screen.getByLabelText('导入翻译文件')
    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() =>
      expect(savePoem).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'p1', englishLines: ['Before the bed', 'Like frost'] })
      )
    )
    expect(onPoemAdded).toHaveBeenCalled()
  })

  it('import with invalid JSON shows alert', async () => {
    const file = new File(['not json'], 'bad.json', { type: 'application/json' })
    render(<SettingsModal {...makeProps()} />)

    const input = screen.getByLabelText('导入翻译文件')
    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => expect(global.alert).toHaveBeenCalledWith(
      expect.stringContaining('格式错误')
    ))
    expect(savePoem).not.toHaveBeenCalled()
  })

  it('import with no matching poem ids shows alert and saves nothing', async () => {
    const translated = [{ ...poem, id: 'unknown-id', englishLines: ['line'] }]
    const file = new File([JSON.stringify(translated)], 'library-translated.json', {
      type: 'application/json',
    })
    render(<SettingsModal {...makeProps()} />)
    fireEvent.change(screen.getByLabelText('导入翻译文件'), { target: { files: [file] } })

    await waitFor(() => expect(global.alert).toHaveBeenCalledWith(
      expect.stringContaining('未找到')
    ))
    expect(savePoem).not.toHaveBeenCalled()
  })
})

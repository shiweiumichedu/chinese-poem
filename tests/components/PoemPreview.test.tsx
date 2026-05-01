import { render, screen, fireEvent } from '@testing-library/react'
import { PoemPreview } from '../../src/components/PoemPreview'
import type { CorpusPoem } from '../../src/types'

const poem: CorpusPoem = {
  id: '1',
  title: '静夜思',
  author: '李白',
  dynasty: 'tang',
  authorBackground: '',
  lines: ['床前明月光', '疑是地上霜', '举头望明月', '低头思故乡'],
}

const longPoem: CorpusPoem = {
  ...poem,
  id: '2',
  lines: ['第一行', '第二行', '第三行', '第四行', '第五行', '第六行'],
}

describe('PoemPreview', () => {
  it('renders title wrapped in 《》', () => {
    render(<PoemPreview poem={poem} onConfirm={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByText('《静夜思》')).toBeInTheDocument()
  })

  it('renders author and dynasty', () => {
    render(<PoemPreview poem={poem} onConfirm={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByText('唐 · 李白')).toBeInTheDocument()
  })

  it('renders up to 4 preview lines', () => {
    render(<PoemPreview poem={poem} onConfirm={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByText('床前明月光')).toBeInTheDocument()
    expect(screen.getByText('低头思故乡')).toBeInTheDocument()
    expect(screen.queryByText('……')).not.toBeInTheDocument()
  })

  it('shows …… indicator when poem has more than 4 lines', () => {
    render(<PoemPreview poem={longPoem} onConfirm={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByText('……')).toBeInTheDocument()
    expect(screen.queryByText('第五行')).not.toBeInTheDocument()
  })

  it('calls onConfirm when 确认添加 is clicked', () => {
    const onConfirm = vi.fn()
    render(<PoemPreview poem={poem} onConfirm={onConfirm} onCancel={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: '确认添加' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('calls onCancel when 取消 is clicked', () => {
    const onCancel = vi.fn()
    render(<PoemPreview poem={poem} onConfirm={vi.fn()} onCancel={onCancel} />)
    fireEvent.click(screen.getByRole('button', { name: '取消' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('handles Song dynasty correctly', () => {
    const songPoem = { ...poem, dynasty: 'song' as const }
    render(<PoemPreview poem={songPoem} onConfirm={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByText('宋 · 李白')).toBeInTheDocument()
  })
})

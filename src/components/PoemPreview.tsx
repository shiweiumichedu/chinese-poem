import type { CorpusPoem } from '../types'

const DYNASTY_LABEL: Record<'tang' | 'song', string> = { tang: '唐', song: '宋' }
const PREVIEW_LINE_COUNT = 4

interface PoemPreviewProps {
  poem: CorpusPoem
  onConfirm: () => void
  onCancel: () => void
}

export function PoemPreview({ poem, onConfirm, onCancel }: PoemPreviewProps) {
  const previewLines = poem.lines.slice(0, PREVIEW_LINE_COUNT)
  const hasMore = poem.lines.length > PREVIEW_LINE_COUNT

  return (
    <div className="poem-preview">
      <h2 className="poem-title">《{poem.title}》</h2>
      <p className="poem-author">
        {DYNASTY_LABEL[poem.dynasty] ?? poem.dynasty} · {poem.author}
      </p>
      <div className="poem-preview-lines">
        {previewLines.map((line, i) => (
          <p key={i} className="preview-line">{line}</p>
        ))}
        {hasMore && <p className="preview-more">……</p>}
      </div>
      <div className="preview-actions">
        <button onClick={onConfirm} className="btn-confirm">确认添加</button>
        <button onClick={onCancel} className="btn-cancel">取消</button>
      </div>
    </div>
  )
}

import { useRef } from 'react'
import type { SavedPoem } from '../types'
import { savePoem } from '../data/PoemLibrary'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
  savedPoems: SavedPoem[]
  onPoemAdded: () => Promise<void>
}

export function SettingsModal({ isOpen, onClose, savedPoems, onPoemAdded }: SettingsModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleExport() {
    const json = JSON.stringify(savedPoems, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'library.json'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const text = await file.text()
    let imported: SavedPoem[]
    try {
      const parsed = JSON.parse(text)
      if (!Array.isArray(parsed)) throw new Error('not an array')
      imported = parsed
    } catch {
      alert('文件格式错误，请使用导出的 library.json 文件')
      return
    }

    const savedById = new Map(savedPoems.map(p => [p.id, p]))
    let count = 0
    for (const poem of imported) {
      const existing = savedById.get(poem.id)
      if (existing && Array.isArray(poem.englishLines) && poem.englishLines.length > 0) {
        await savePoem({ ...existing, englishLines: poem.englishLines })
        count++
      }
    }

    if (count > 0) {
      await onPoemAdded()
      alert(`已导入 ${count} 首诗的英文翻译`)
    } else {
      alert('未找到可导入的翻译')
    }

    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  if (!isOpen) return null

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={e => e.stopPropagation()}>
        <h2>设置</h2>
        <div className="settings-section">
          <h3>英文翻译</h3>
          <p className="settings-description">
            导出诗库，用 <code>npm run translate:saved</code> 翻译后再导入。
          </p>
          <button className="btn-settings-action" onClick={handleExport} aria-label="导出诗库">
            导出诗库
          </button>
          <label className="btn-settings-action btn-settings-import">
            导入翻译
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleImport}
              aria-label="导入翻译文件"
            />
          </label>
        </div>
        <button className="btn-settings-close" onClick={onClose} aria-label="关闭">
          关闭
        </button>
      </div>
    </div>
  )
}

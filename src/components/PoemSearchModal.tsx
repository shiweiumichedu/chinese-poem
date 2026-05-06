import React, { useState } from 'react'
import type { SearchResult } from '../utils/findPoemOnline'

interface PoemSearchModalProps {
  isOpen: boolean
  query: string
  onClose: () => void
  onConfirm: (result: SearchResult) => void
  isLoading?: boolean
  results?: SearchResult[]
  error?: string
  isAlreadySaved?: (result: SearchResult) => boolean
}

export const PoemSearchModal: React.FC<PoemSearchModalProps> = ({
  isOpen,
  query,
  onClose,
  onConfirm,
  isLoading = false,
  results = [],
  error,
  isAlreadySaved,
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0)

  if (!isOpen) return null

  const selectedResult = results[selectedIndex]
  const alreadySaved = selectedResult ? isAlreadySaved?.(selectedResult) === true : false

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>搜索结果: "{query}"</h2>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-body">
          {isLoading && (
            <div className="modal-loading">
              <div className="spinner"></div>
              <p>正在搜索...</p>
            </div>
          )}

          {error && !isLoading && (
            <div className="modal-error">
              <p>{error}</p>
            </div>
          )}

          {!isLoading && !error && results.length === 0 && (
            <div className="modal-empty">
              <p>未找到匹配的诗词</p>
              <p className="text-small">请尝试其他搜索词</p>
            </div>
          )}

          {!isLoading && !error && results.length > 0 && selectedResult && (
            <div className="poem-preview">
              <div className="poem-header">
                <h3 className="poem-title">{selectedResult.title}</h3>
                <p className="poem-author">— {selectedResult.author}</p>
                {alreadySaved && <p className="poem-author">已在我的诗库</p>}
              </div>

              <div className="poem-lines">
                {selectedResult.lines.map((line, idx) => (
                  <p key={idx} className="poem-line">
                    {line}
                  </p>
                ))}
              </div>

              {results.length > 1 && (
                <div className="results-nav">
                  <button
                    className="btn-nav"
                    onClick={() =>
                      setSelectedIndex((prev) =>
                        prev === 0 ? results.length - 1 : prev - 1,
                      )
                    }
                  >
                    ← 上一个
                  </button>
                  <span className="result-counter">
                    {selectedIndex + 1} / {results.length}
                  </span>
                  <button
                    className="btn-nav"
                    onClick={() =>
                      setSelectedIndex((prev) =>
                        prev === results.length - 1 ? 0 : prev + 1,
                      )
                    }
                  >
                    下一个 →
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {!isLoading && results.length > 0 && selectedResult && (
          <div className="modal-footer">
            <button className="btn-secondary" onClick={onClose}>
              取消
            </button>
            <button
              className="btn-primary"
              onClick={() => {
                onConfirm(selectedResult)
                onClose()
              }}
            >
              {alreadySaved ? '查看诗词' : '添加到诗库'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

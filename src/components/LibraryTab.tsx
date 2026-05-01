import { useState, useMemo } from 'react'
import type { CorpusPoem, SavedPoem, VoiceState } from '../types'
import { DYNASTY_LABEL } from '../constants'
import { searchPoems } from '../data/PoemSearch'
import { savePoem } from '../data/PoemLibrary'
import { PoemPreview } from './PoemPreview'

interface LibraryTabProps {
  voiceState: VoiceState
  startListening: (onResult: (text: string) => void) => void
  speakLines: (lines: string[], onLineStart: (i: number) => void, onDone: () => void) => void
  stop: () => void
  isSTTSupported: boolean
  corpus: CorpusPoem[]
  corpusLoading: boolean
  savedPoems: SavedPoem[]
  onPoemSelect: (poem: SavedPoem) => void
  onPoemAdded: () => Promise<void>
}

type SubTab = 'mine' | 'browse'

export function LibraryTab({
  voiceState,
  startListening,
  speakLines,
  stop,
  isSTTSupported,
  corpus,
  corpusLoading,
  savedPoems,
  onPoemSelect,
  onPoemAdded,
}: LibraryTabProps) {
  const [preview, setPreview] = useState<CorpusPoem | null>(null)
  const [addNotFound, setAddNotFound] = useState(false)
  const [addTextQuery, setAddTextQuery] = useState('')
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('mine')
  const [browseQuery, setBrowseQuery] = useState('')

  const browseResults = useMemo(() => {
    const savedIds = new Set(savedPoems.map(p => p.id))
    const pool = browseQuery ? searchPoems(corpus, browseQuery) : corpus
    return pool.filter(p => !savedIds.has(p.id)).slice(0, 50)
  }, [corpus, browseQuery, savedPoems])

  function handleAddByVoice() {
    setAddNotFound(false)
    startListening((text) => {
      const results = searchPoems(corpus, text)
      if (results.length > 0) {
        const found = results[0]
        setPreview(found)
        speakLines(
          [`找到《${found.title}》，${found.author}的诗。确认添加吗？`],
          () => {},
          () => {}
        )
      } else {
        setAddNotFound(true)
      }
    })
  }

  function handleAddByText() {
    const results = searchPoems(corpus, addTextQuery)
    if (results.length > 0) {
      setPreview(results[0])
      setAddNotFound(false)
    } else {
      setAddNotFound(true)
    }
  }

  function handleTextKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      handleAddByText()
    }
  }

  async function handleConfirm() {
    if (!preview) return
    await savePoem({ ...preview, addedAt: Date.now() })
    setPreview(null)
    setAddTextQuery('')
    await onPoemAdded()
  }

  function handleCancel() {
    setPreview(null)
    stop()
  }

  if (preview !== null) {
    return (
      <PoemPreview poem={preview} onConfirm={handleConfirm} onCancel={handleCancel} />
    )
  }

  return (
    <div className="library-tab">
      <div className="sub-tabs">
        <button
          className={`sub-tab${activeSubTab === 'mine' ? ' active' : ''}`}
          aria-selected={activeSubTab === 'mine'}
          onClick={() => setActiveSubTab('mine')}
        >
          我的诗库
        </button>
        <button
          className={`sub-tab${activeSubTab === 'browse' ? ' active' : ''}`}
          aria-selected={activeSubTab === 'browse'}
          onClick={() => setActiveSubTab('browse')}
        >
          浏览诗库
        </button>
      </div>

      {activeSubTab === 'mine' ? (
        <div className="my-library">
          <div className="poem-list">
            {savedPoems.length === 0 ? (
              <p className="empty-library">诗库为空，请添加诗词</p>
            ) : (
              savedPoems.map((poem) => (
                <button
                  key={poem.id}
                  className="poem-list-item"
                  aria-label={`${poem.title} ${poem.author}`}
                  onClick={() => onPoemSelect(poem)}
                >
                  <span className="poem-list-title">{poem.title}</span>
                  <span className="poem-list-meta">
                    {poem.author} · {DYNASTY_LABEL[poem.dynasty] ?? poem.dynasty}
                  </span>
                </button>
              ))
            )}
          </div>

          <div className="add-section">
            {corpusLoading ? (
              <p>正在加载诗库...</p>
            ) : isSTTSupported ? (
              <button
                className="btn-add-poem"
                disabled={voiceState !== 'idle'}
                onClick={handleAddByVoice}
              >
                ＋ 添加新诗 <span aria-hidden="true">🎤</span>
              </button>
            ) : (
              <div className="add-text-section">
                <input
                  type="text"
                  placeholder="输入诗名..."
                  aria-label="诗名"
                  lang="zh-CN"
                  value={addTextQuery}
                  onChange={(e) => setAddTextQuery(e.target.value)}
                  onKeyDown={handleTextKeyDown}
                />
                <button onClick={handleAddByText}>查找</button>
              </div>
            )}
            {addNotFound && (
              <p className="add-not-found">未在诗库中找到该诗，请检查诗名</p>
            )}
          </div>
        </div>
      ) : (
        <div className="browse-section">
          <input
            type="text"
            placeholder="搜索诗库..."
            aria-label="搜索诗库"
            lang="zh-CN"
            value={browseQuery}
            onChange={(e) => setBrowseQuery(e.target.value)}
          />
          {corpusLoading ? (
            <p className="corpus-loading">正在加载诗库...</p>
          ) : (
            <div className="browse-results">
              {browseResults.map((poem) => (
                <div key={poem.id} className="browse-result-item">
                  <button
                    className="browse-result-info"
                    onClick={() => setPreview(poem)}
                  >
                    <span className="browse-result-title">{poem.title}</span>
                    <span className="browse-result-meta">
                      {poem.author} · {DYNASTY_LABEL[poem.dynasty] ?? poem.dynasty}
                    </span>
                  </button>
                  <button
                    className="browse-result-add"
                    aria-label={`添加 ${poem.title}`}
                    onClick={() => setPreview(poem)}
                  >
                    ＋
                  </button>
                </div>
              ))}
              {browseResults.length === 0 && browseQuery && (
                <p className="browse-no-results">未找到匹配的诗</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

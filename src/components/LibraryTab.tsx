import { useState, useMemo } from 'react'
import type { CorpusPoem, SavedPoem, VoiceState } from '../types'
import { DYNASTY_LABEL } from '../constants'
import { searchPoems } from '../data/PoemSearch'
import { savePoem, removePoem } from '../data/PoemLibrary'
import { PoemPreview } from './PoemPreview'
import { PoemSearchModal } from './PoemSearchModal'
import { findPoemOnline, searchResultToSavedPoem, type SearchResult } from '../utils/findPoemOnline'

interface LibraryTabProps {
  voiceState: VoiceState
  startListening: (onResult: (text: string) => void) => void
  speakLines: (lines: string[], onLineStart: (i: number) => void, onDone: () => void, lang?: string) => void
  stop: () => void
  isSTTSupported: boolean
  corpus: CorpusPoem[]
  corpusLoading: boolean
  corpusError: string | null
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
  corpusError,
  savedPoems,
  onPoemSelect,
  onPoemAdded,
}: LibraryTabProps) {
  const [preview, setPreview] = useState<CorpusPoem | null>(null)
  const [addNotFound, setAddNotFound] = useState(false)
  const [query, setQuery] = useState('')
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('mine')
  const [browseQuery, setBrowseQuery] = useState('')
  const [mineStarFilter, setMineStarFilter] = useState<number>(0)

  // Online search modal state
  const [showSearchModal, setShowSearchModal] = useState(false)
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [currentSearchQuery, setCurrentSearchQuery] = useState('')

  const filteredSavedPoems = useMemo(() => {
    const queryFiltered = query
      ? (searchPoems(savedPoems, query) as SavedPoem[])
      : savedPoems

    if (mineStarFilter === 0) return queryFiltered
    return queryFiltered.filter((p) => p.rating === mineStarFilter)
  }, [savedPoems, query, mineStarFilter])

  const savedById = useMemo(
    () => new Map(savedPoems.map(p => [p.id, p])),
    [savedPoems]
  )

  const browseResults = useMemo(() => {
    const pool = browseQuery ? searchPoems(corpus, browseQuery) : corpus
    return pool.slice(0, 50)
  }, [corpus, browseQuery])

  function handleAddByVoice() {
    if (voiceState === 'listening') {
      stop()
      return
    }
    setAddNotFound(false)
    startListening((text) => {
      setQuery(text)
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
    const results = searchPoems(corpus, query)
    if (results.length > 0) {
      setPreview(results[0])
      setAddNotFound(false)
    } else {
      setAddNotFound(true)
    }
  }

  function handleBrowseByVoice() {
    if (voiceState === 'listening') {
      stop()
      return
    }
    setActiveSubTab('browse')
    startListening((text) => {
      setBrowseQuery(text)
    })
  }

  async function handleDelete(poem: SavedPoem) {
    await removePoem(poem.id)
    await onPoemAdded()
  }

  async function handleRating(poem: SavedPoem, rating: number) {
    const updated: SavedPoem = {
      ...poem,
      rating: poem.rating === rating ? undefined : rating,
    }
    await savePoem(updated)
    await onPoemAdded()
  }

  async function handleConfirm() {
    if (!preview) return
    await savePoem({ ...preview, addedAt: Date.now() })
    setPreview(null)
    setQuery('')
    await onPoemAdded()
  }

  function handleCancel() {
    setPreview(null)
    stop()
  }

  async function handleOnlineSearch(query: string) {
    setCurrentSearchQuery(query)
    setShowSearchModal(true)
    setIsSearching(true)
    setSearchError('')
    setSearchResults([])
    
    try {
      const results = await findPoemOnline(query)
      if (results.length === 0) {
        setSearchError('未找到匹配的诗词，请尝试其他搜索词')
      } else {
        setSearchResults(results)
      }
    } catch (error) {
      setSearchError('搜索出错，请重试')
      console.error('Online search error:', error)
    } finally {
      setIsSearching(false)
    }
  }

  function findExistingSavedPoem(result: SearchResult): SavedPoem | undefined {
    return savedPoems.find(
      (p) => p.title === result.title && p.author === result.author,
    )
  }

  async function handleConfirmPoemFromSearch(result: SearchResult) {
    try {
      const existing = findExistingSavedPoem(result)
      if (existing) {
        setActiveSubTab('mine')
        setQuery(result.title)
        onPoemSelect(existing)
        return
      }

      const saved = searchResultToSavedPoem(result)
      await savePoem(saved)
      setQuery('')
      setAddNotFound(false)
      await onPoemAdded()
    } catch (error) {
      console.error('Error saving poem:', error)
      alert('保存诗词失败')
    }
  }

  if (preview !== null) {
    return (
      <PoemPreview poem={preview} onConfirm={handleConfirm} onCancel={handleCancel} />
    )
  }

  return (
    <div className="library-tab">
      <div className="sub-tabs" role="tablist">
        <button
          role="tab"
          className={`sub-tab${activeSubTab === 'mine' ? ' active' : ''}`}
          aria-selected={activeSubTab === 'mine'}
          onClick={() => setActiveSubTab('mine')}
        >
          我的诗库
        </button>
        <button
          role="tab"
          className={`sub-tab${activeSubTab === 'browse' ? ' active' : ''}`}
          aria-selected={activeSubTab === 'browse'}
          onClick={() => setActiveSubTab('browse')}
        >
          浏览诗库
        </button>
      </div>

      {activeSubTab === 'mine' ? (
        <div className="my-library">
          <div className="add-section">
            {corpusLoading ? (
              <p>正在加载诗库...</p>
            ) : (
              <div className="add-text-input">
                <input
                  type="text"
                  placeholder="搜索诗名或诗句..."
                  aria-label="诗名或诗句"
                  lang="zh-CN"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAddByText() }}
                />
                {isSTTSupported && (
                  <button
                    className={`btn-voice-search${voiceState === 'listening' ? ' active' : ''}`}
                    aria-label={voiceState === 'listening' ? '停止语音添加' : '开始语音添加'}
                    onClick={handleAddByVoice}
                  >
                    {voiceState === 'listening' ? '🎙️' : '🎤'}
                  </button>
                )}
                {savedPoems.length > 0 && (
                  <select
                    aria-label="按星级筛选我的诗库"
                    value={mineStarFilter}
                    onChange={(e) => setMineStarFilter(Number(e.target.value))}
                  >
                    <option value={0}>全部星级</option>
                    <option value={5}>5 星</option>
                    <option value={4}>4 星</option>
                    <option value={3}>3 星</option>
                    <option value={2}>2 星</option>
                    <option value={1}>1 星</option>
                  </select>
                )}
              </div>
            )}
            {addNotFound && (
              <div className="online-search-wrap">
                <p className="add-not-found">未在诗库中找到该诗，请检查诗名</p>
                <button
                  className="btn-online-search"
                  onClick={() => handleOnlineSearch(query)}
                >
                  联网找诗
                </button>
              </div>
            )}
          </div>
          <div className="poem-list">
            {savedPoems.length === 0 ? (
              <p className="empty-library">诗库为空，请添加诗词</p>
            ) : filteredSavedPoems.length === 0 ? (
              <p className="empty-library">未在我的诗库中找到匹配的诗</p>
            ) : (
              filteredSavedPoems.map((poem) => (
                <div key={poem.id} className="poem-list-item">
                  <button
                    className="poem-list-content"
                    aria-label={`${poem.title} ${poem.author}`}
                    onClick={() => onPoemSelect(poem)}
                  >
                    <span className="poem-list-title">{poem.title}</span>
                    {poem.englishLines && poem.englishLines.length > 0 && (
                      <span className="badge-en" aria-label="英文翻译可用">EN</span>
                    )}
                    <span className="poem-list-meta">
                      {poem.author} · {DYNASTY_LABEL[poem.dynasty] ?? poem.dynasty}
                    </span>
                    {poem.lines.length > 0 && (
                      <span className="poem-list-lines">{poem.lines[0]}</span>
                    )}
                  </button>
                  <div className="poem-list-actions">
                    <div className="poem-rating">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          className={`star${(poem.rating ?? 0) >= star ? ' filled' : ''}`}
                          aria-label={`评分 ${star} 星`}
                          onClick={() => handleRating(poem, star)}
                        >
                          ★
                        </button>
                      ))}
                    </div>
                    <button
                      className="poem-list-delete"
                      aria-label={`删除 ${poem.title}`}
                      onClick={() => handleDelete(poem)}
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : (
        <div className="browse-section">
          <div className="text-search">
            <input
              type="text"
              placeholder="搜索诗库（诗名或诗句）..."
              aria-label="搜索诗库（诗名或诗句）"
              lang="zh-CN"
              value={browseQuery}
              onChange={(e) => setBrowseQuery(e.target.value)}
            />
            {isSTTSupported && (
              <button
                className={`btn-voice-search${voiceState === 'listening' ? ' active' : ''}`}
                aria-label={voiceState === 'listening' ? '停止语音搜索诗库' : '开始语音搜索诗库'}
                onClick={handleBrowseByVoice}
              >
                {voiceState === 'listening' ? '🎙️' : '🎤'}
              </button>
            )}
          </div>
          {corpusLoading ? (
            <p className="corpus-loading">正在加载诗库...</p>
          ) : corpusError ? (
            <p className="corpus-error-browse">诗库加载失败</p>
          ) : (
            <div className="browse-results">
              {browseResults.map((poem) => {
                const saved = savedById.get(poem.id)
                if (!saved) {
                  return (
                    <button
                      key={poem.id}
                      className="browse-result-item"
                      onClick={() => setPreview(poem)}
                      aria-label={`添加 ${poem.title}`}
                    >
                      <span className="browse-result-title">{poem.title}</span>
                      {poem.englishLines && poem.englishLines.length > 0 && (
                        <span className="badge-en" aria-label="英文翻译可用">EN</span>
                      )}
                      <span className="browse-result-meta">
                        {poem.author} · {DYNASTY_LABEL[poem.dynasty] ?? poem.dynasty}
                      </span>
                      <span className="browse-result-add" aria-hidden="true">＋</span>
                    </button>
                  )
                }
                const rating = saved.rating
                return (
                  <div
                    key={poem.id}
                    className="browse-result-item saved"
                    aria-label={`${poem.title}（已在诗库）`}
                  >
                    <span className="browse-result-title">{poem.title}</span>
                    {poem.englishLines && poem.englishLines.length > 0 && (
                      <span className="badge-en" aria-label="英文翻译可用">EN</span>
                    )}
                    <span className="browse-result-meta">
                      {poem.author} · {DYNASTY_LABEL[poem.dynasty] ?? poem.dynasty}
                    </span>
                    {typeof rating === 'number' && rating >= 1 && rating <= 5 ? (
                      <span className="browse-result-stars" aria-hidden="true">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <span
                            key={star}
                            className={`star${rating >= star ? ' filled' : ''}`}
                          >
                            ★
                          </span>
                        ))}
                      </span>
                    ) : (
                      <span className="browse-result-saved-check" aria-hidden="true">✓</span>
                    )}
                  </div>
                )
              })}
              {browseResults.length === 0 && browseQuery && (
                <div className="online-search-wrap">
                  <p className="browse-no-results">未找到匹配的诗</p>
                  <button
                    className="btn-online-search"
                    onClick={() => handleOnlineSearch(browseQuery)}
                  >
                    联网找诗
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <PoemSearchModal
        isOpen={showSearchModal}
        query={currentSearchQuery}
        results={searchResults}
        isLoading={isSearching}
        error={searchError}
        onClose={() => setShowSearchModal(false)}
        onConfirm={handleConfirmPoemFromSearch}
        isAlreadySaved={(result) => !!findExistingSavedPoem(result)}
      />
    </div>
  )
}

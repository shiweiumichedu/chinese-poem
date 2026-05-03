import { useState, useEffect, useRef } from 'react'
import { flushSync } from 'react-dom'
import type { SavedPoem, VoiceState } from '../types'
import { searchPoems } from '../data/PoemSearch'
import { savePoem } from '../data/PoemLibrary'
import { PoemPlayer } from './PoemPlayer'
import { PoemSearchModal } from './PoemSearchModal'
import { findPoemOnline, searchResultToSavedPoem, type SearchResult } from '../utils/findPoemOnline'
import { getDisplaySentences } from '../utils/poemLineDisplay'
import { Converter } from 'opencc-js/t2cn'
import { pinyin } from 'pinyin-pro'

const t2s = Converter({ from: 'tw', to: 'cn' })

const AUTO_PLAY_KEY = 'auto-play'
const REPEAT_PLAY_KEY = 'repeat-play'
const AUTHOR_PAUSE_BASE_MS = 600

function getAuthorPauseMultiplier(rate: number): number {
  if (rate <= 0.25) return 3
  if (rate <= 0.4) return 2
  return 1
}

function toChineseNumber(n: number): string {
  const digits = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九']
  if (n < 10) return digits[n]
  if (n === 10) return '十'
  if (n < 20) return `十${digits[n % 10]}`
  if (n % 10 === 0) return `${digits[Math.floor(n / 10)]}十`
  return `${digits[Math.floor(n / 10)]}十${digits[n % 10]}`
}

function normalizeReciteText(text: string): string {
  return t2s(text).replace(/[^一-鿿]/g, '')
}

function toPinyin(text: string): string {
  return pinyin(text, { toneType: 'none', separator: '' })
}

function isReciteMatch(recited: string, expected: string): boolean {
  const normalizedRecited = normalizeReciteText(recited)
  const normalizedExpected = normalizeReciteText(expected)
  if (
    normalizedRecited === normalizedExpected ||
    normalizedRecited.includes(normalizedExpected) ||
    normalizedExpected.includes(normalizedRecited)
  ) return true

  // Phonetic fallback: homophones count as correct
  const pinyinRecited = toPinyin(normalizedRecited)
  const pinyinExpected = toPinyin(normalizedExpected)
  return (
    pinyinRecited === pinyinExpected ||
    pinyinRecited.includes(pinyinExpected) ||
    pinyinExpected.includes(pinyinRecited)
  )
}

export function isYes(text: string): boolean {
  return /[是要降对]/.test(text) && !/不/.test(text)
}

interface ListenTabProps {
  voiceState: VoiceState
  startListening: (onResult: (text: string) => void, onIdle?: () => void) => void
  speakLines: (lines: string[], onLineStart: (i: number) => void, onDone: () => void) => void
  stop: () => void
  isSTTSupported: boolean
  libraryPoems: SavedPoem[]
  initialPoem?: SavedPoem
  ttsRate: number
  setTtsRate: (rate: number) => void
  onPoemUpdated?: () => Promise<void>
}

export function ListenTab({
  voiceState,
  startListening,
  speakLines,
  stop,
  isSTTSupported,
  libraryPoems,
  initialPoem,
  ttsRate,
  setTtsRate,
  onPoemUpdated = async () => {},
}: ListenTabProps) {
  const [currentPoem, setCurrentPoem] = useState<SavedPoem | null>(null)
  const [highlightedLine, setHighlightedLine] = useState<number | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [textQuery, setTextQuery] = useState('')
  const [autoPlay, setAutoPlay] = useState(() => localStorage.getItem(AUTO_PLAY_KEY) === 'true')
  const [repeatPlay, setRepeatPlay] = useState(() => localStorage.getItem(REPEAT_PLAY_KEY) === 'true')
  const [reciting, setReciting] = useState(false)
  const [reciteSentenceIndex, setReciteSentenceIndex] = useState(0)
  const [recognizedText, setRecognizedText] = useState('')
  
  // Online search modal state
  const [showSearchModal, setShowSearchModal] = useState(false)
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState('')

  const autoPlayedRef = useRef(false)
  const autoPlayRef = useRef(autoPlay)
  const repeatPlayRef = useRef(repeatPlay)
  const libraryPoemsRef = useRef(libraryPoems)
  const currentPoemRef = useRef<SavedPoem | null>(null)
  const manuallyStoppedRef = useRef(false)
  const recitingRef = useRef(false)
  const hasWrongAnswerRef = useRef(false)

  useEffect(() => { autoPlayRef.current = autoPlay }, [autoPlay])
  useEffect(() => { repeatPlayRef.current = repeatPlay }, [repeatPlay])
  useEffect(() => { libraryPoemsRef.current = libraryPoems }, [libraryPoems])
  useEffect(() => { recitingRef.current = reciting }, [reciting])

  function setPoem(poem: SavedPoem) {
    setCurrentPoem(poem)
    currentPoemRef.current = poem
  }

  // Called whenever a poem finishes playing — advances to next if auto-play is on
  function handlePoemDone() {
    if (recitingRef.current) return
    setHighlightedLine(null)
    if (manuallyStoppedRef.current) {
      manuallyStoppedRef.current = false
      return
    }
    if (!autoPlayRef.current && !repeatPlayRef.current) return

    if (repeatPlayRef.current) {
      const current = currentPoemRef.current
      if (!current) return
      setTimeout(() => {
        if (manuallyStoppedRef.current) return
        speakLines(current.lines, (i) => setHighlightedLine(i), handlePoemDone)
      }, 800)
      return
    }

    const poems = libraryPoemsRef.current
    const current = currentPoemRef.current
    if (!poems.length || !current) return
    
    // Filter poems by rating if current poem has a rating
    const targetRating = current.rating
    let availablePoems = targetRating !== undefined 
      ? poems.filter(p => p.rating === targetRating)
      : poems
    
    if (!availablePoems.length) {
      // Fall back to all poems if no poems with same rating
      availablePoems = poems
    }
    
    const idx = availablePoems.findIndex(p => p.id === current.id)
    const next = availablePoems[(idx + 1) % availablePoems.length]
    if (!next) return
    setTimeout(() => {
      flushSync(() => { setPoem(next) })
      const announcement = `${next.title}，${next.author}`
      speakLines([announcement], () => setHighlightedLine(null), () => {
        if (!autoPlayRef.current || manuallyStoppedRef.current) return
        const pauseMs = AUTHOR_PAUSE_BASE_MS * getAuthorPauseMultiplier(ttsRate)
        setTimeout(() => {
          if (!autoPlayRef.current || manuallyStoppedRef.current) return
          speakLines(next.lines, (i) => setHighlightedLine(i), handlePoemDone)
        }, pauseMs)
      })
    }, 800)
  }

  useEffect(() => {
    if (initialPoem && !autoPlayedRef.current) {
      autoPlayedRef.current = true
      setPoem(initialPoem)
      // Don't auto-play: iOS Safari blocks speech not initiated by a user gesture
    }
  }, [initialPoem])

  useEffect(() => {
    return () => {
      stopRecitingSession()
      stop()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const statusText = reciting
    ? `背诵中：第${toChineseNumber(reciteSentenceIndex + 1)}句`
    : voiceState === 'listening'
    ? '正在听...'
    : notFound
    ? '诗库中未找到，请先在诗库中添加'
    : currentPoem
    ? currentPoem.title
    : '输入诗名或诗句...'

  function stopRecitingSession() {
    setReciting(false)
    setReciteSentenceIndex(0)
    setRecognizedText('')
    recitingRef.current = false
    hasWrongAnswerRef.current = false
  }

  function getReciteSentences(poem: SavedPoem): string[] {
    return getDisplaySentences(poem.lines)
  }

  function handleReciteComplete() {
    stopRecitingSession()
    if (!autoPlayRef.current) return
    const next = getNextPoem()
    if (!next) return
    speakLines([`${next.title}，${next.author}`], () => setHighlightedLine(null), () => {
      if (!autoPlayRef.current || manuallyStoppedRef.current) return
      const pauseMs = AUTHOR_PAUSE_BASE_MS * getAuthorPauseMultiplier(ttsRate)
      setTimeout(() => {
        if (!autoPlayRef.current || manuallyStoppedRef.current) return
        flushSync(() => { setPoem(next) })
        startReciting()
      }, pauseMs)
    })
  }

  function advanceReciteSentence(nextIndex: number) {
    setRecognizedText('')
    const poem = currentPoemRef.current
    if (!poem) return
    const sentences = getReciteSentences(poem)
    if (nextIndex >= sentences.length) {
      const proceedToComplete = () => {
        speakLines(['背诵完成'], () => setHighlightedLine(null), () => {
          handleReciteComplete()
        })
      }
      if (hasWrongAnswerRef.current && (poem.rating ?? 0) >= 2) {
        speakLines(['要不要降一颗星？'], () => setHighlightedLine(null), () => {
          startListening((spokenText) => {
            if (isYes(spokenText)) {
              const currentRating = poem.rating ?? 0
              const updated = { ...poem, rating: currentRating - 1 }
              setPoem(updated)
              void (async () => {
                try {
                  await savePoem(updated)
                  await onPoemUpdated()
                } catch (e) {
                  console.error('Failed to save rating update', e)
                }
              })()
              speakLines(['已降一颗星'], () => setHighlightedLine(null), proceedToComplete)
            } else {
              proceedToComplete()
            }
          }, proceedToComplete)
        })
      } else {
        proceedToComplete()
      }
      return
    }
    setReciteSentenceIndex(nextIndex)
    speakLines([`第${toChineseNumber(nextIndex + 1)}句`], () => setHighlightedLine(null), () => {
      beginReciteListening(nextIndex)
    })
  }

  function listenForCorrection(sentenceIndex: number) {
    if (!recitingRef.current) return
    const poem = currentPoemRef.current
    if (!poem) return
    const sentences = getReciteSentences(poem)
    const expected = sentences[sentenceIndex]
    startListening((spokenText) => {
      if (!recitingRef.current) return
      setRecognizedText(spokenText)
      if (isReciteMatch(spokenText, expected)) {
        speakLines(['正确'], () => setHighlightedLine(null), () => {
          advanceReciteSentence(sentenceIndex + 1)
        })
      } else {
        hasWrongAnswerRef.current = true
        speakLines(['还是不对，请自己纠正'], () => setHighlightedLine(null), () => {
          advanceReciteSentence(sentenceIndex + 1)
        })
      }
    }, () => {
      if (!recitingRef.current) return
      speakLines(['请背诵'], () => setHighlightedLine(null), () => {
        listenForCorrection(sentenceIndex)
      })
    })
  }

  function beginReciteListening(sentenceIndex: number) {
    if (!recitingRef.current) return
    const poem = currentPoemRef.current
    if (!poem) { stopRecitingSession(); return }
    const sentences = getReciteSentences(poem)
    const expected = sentences[sentenceIndex]
    if (!expected) { stopRecitingSession(); return }

    startListening((spokenText) => {
      if (!recitingRef.current) return
      setRecognizedText(spokenText)
      if (isReciteMatch(spokenText, expected)) {
        advanceReciteSentence(sentenceIndex + 1)
        return
      }
      speakLines(['重复'], () => setHighlightedLine(null), () => {
        speakLines([expected], () => setHighlightedLine(null), () => {
          listenForCorrection(sentenceIndex)
        })
      })
    })
  }

  function startReciting() {
    const poem = currentPoemRef.current
    if (!poem) return
    const sentences = getReciteSentences(poem)
    if (!sentences.length) return
    stop()
    hasWrongAnswerRef.current = false
    setHighlightedLine(null)
    setReciting(true)
    recitingRef.current = true
    setReciteSentenceIndex(0)
    speakLines([`第${toChineseNumber(1)}句`], () => setHighlightedLine(null), () => {
      beginReciteListening(0)
    })
  }

  function toggleReciting() {
    if (recitingRef.current) {
      stopRecitingSession()
      stop()
      return
    }
    startReciting()
  }

  function handleSearch(query: string) {
    stopRecitingSession()
    const results = searchPoems(libraryPoems, query)
    if (results.length > 0) {
      const found = results[0] as SavedPoem
      setPoem(found)
      setNotFound(false)
      speakLines(found.lines, (i) => setHighlightedLine(i), handlePoemDone)
    } else {
      setNotFound(true)
    }
  }

  async function handleLineEdit(lineIndex: number, newText: string) {
    if (!currentPoem) return
    const updated: SavedPoem = {
      ...currentPoem,
      lines: currentPoem.lines.map((l, i) => (i === lineIndex ? newText : l)),
    }
    setPoem(updated)
    if (recitingRef.current) stopRecitingSession()
    await savePoem(updated)
    await onPoemUpdated()
  }

  function handleVoiceSearch() {
    if (recitingRef.current) {
      stopRecitingSession()
    }
    if (voiceState === 'listening') {
      stop()
      return
    }
    setNotFound(false)
    startListening((text) => {
      setTextQuery(text)
      handleSearch(text)
    })
  }

  function handleTextSearch() {
    handleSearch(textQuery)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') handleTextSearch()
  }

  function findExistingSavedPoem(result: SearchResult): SavedPoem | undefined {
    return libraryPoems.find(
      (p) => p.title === result.title && p.author === result.author,
    )
  }

  function handleJumpToNext() {
    const next = getNextPoem()
    if (!next) return
    stopRecitingSession()
    stop()
    manuallyStoppedRef.current = false
    setPoem(next)
  }

  function getNextPoem(): SavedPoem | null {
    const current = currentPoemRef.current
    if (!current) return null
    const poems = libraryPoemsRef.current

    const targetRating = current.rating
    let availablePoems = targetRating !== undefined
      ? poems.filter(p => p.rating === targetRating)
      : poems

    if (!availablePoems.length) {
      availablePoems = poems
    }

    const idx = availablePoems.findIndex(p => p.id === current.id)
    return availablePoems[(idx + 1) % availablePoems.length] || null
  }

  function toggleAutoPlay() {
    setAutoPlay(prev => {
      const next = !prev
      localStorage.setItem(AUTO_PLAY_KEY, String(next))
      autoPlayRef.current = next
      return next
    })
  }

  function toggleRepeatPlay() {
    setRepeatPlay(prev => {
      const next = !prev
      localStorage.setItem(REPEAT_PLAY_KEY, String(next))
      repeatPlayRef.current = next
      return next
    })
  }

  async function handleOnlineSearch() {
    if (!textQuery.trim()) return
    
    setShowSearchModal(true)
    setIsSearching(true)
    setSearchError('')
    setSearchResults([])
    
    try {
      const results = await findPoemOnline(textQuery.trim())
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

  async function handleConfirmPoem(result: SearchResult) {
    try {
      const existing = findExistingSavedPoem(result)
      if (existing) {
        stopRecitingSession()
        setPoem(existing)
        setNotFound(false)
        setTextQuery('')
        return
      }

      const saved = searchResultToSavedPoem(result)
      await savePoem(saved)
      stopRecitingSession()
      setPoem(saved)
      setNotFound(false)
      setTextQuery('')
      await onPoemUpdated()
    } catch (error) {
      console.error('Error saving poem:', error)
      alert('保存诗词失败')
    }
  }

  return (
    <div className="listen-tab">
      <div className="listen-status">{statusText}</div>
      {reciting && recognizedText && (
        <div className="recite-recognized">{recognizedText}</div>
      )}

      <div className="text-search">
        <input
          type="text"
          placeholder="输入诗名或诗句..."
          aria-label="诗名或诗句"
          lang="zh-CN"
          value={textQuery}
          onChange={(e) => setTextQuery(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        {isSTTSupported && (
          <button
            className={`btn-voice-search${voiceState === 'listening' ? ' active' : ''}`}
            aria-label={voiceState === 'listening' ? '停止语音搜索' : '开始语音搜索'}
            onClick={handleVoiceSearch}
          >
            {voiceState === 'listening' ? '🎙️' : '🎤'}
          </button>
        )}
        <button onClick={handleTextSearch}>搜索</button>
      </div>

      {notFound && textQuery.trim() && (
        <div className="online-search-wrap">
          <button
            className="btn-online-search"
            onClick={handleOnlineSearch}
          >
            联网找诗
          </button>
        </div>
      )}

      <PoemSearchModal
        isOpen={showSearchModal}
        query={textQuery}
        results={searchResults}
        isLoading={isSearching}
        error={searchError}
        onClose={() => setShowSearchModal(false)}
        onConfirm={handleConfirmPoem}
        isAlreadySaved={(result) => !!findExistingSavedPoem(result)}
      />

      {currentPoem && (
        <PoemPlayer
          poem={currentPoem}
          onPlay={(lines, onLineStart, onDone) => {
            stopRecitingSession()
            speakLines(lines, onLineStart, () => { onDone(); handlePoemDone() })
          }}
          onStop={() => { manuallyStoppedRef.current = true; stopRecitingSession(); stop() }}
          onBack={() => { setCurrentPoem(null); stopRecitingSession(); stop() }}
          isPlaying={voiceState !== 'idle' || reciting}
          highlightedLine={highlightedLine}
          ttsRate={ttsRate}
          setTtsRate={setTtsRate}
          onLineEdit={handleLineEdit}
          autoPlay={autoPlay}
          onAutoPlayToggle={toggleAutoPlay}
          reciting={reciting}
          onReciteToggle={toggleReciting}
          repeatPlay={repeatPlay}
          onRepeatPlayToggle={toggleRepeatPlay}
          nextPoem={autoPlay && !repeatPlay ? getNextPoem() : null}
          onNextPoem={handleJumpToNext}
        />
      )}
    </div>
  )
}

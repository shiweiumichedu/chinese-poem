import { useState, useEffect, useRef } from 'react'
import { flushSync } from 'react-dom'
import type { SavedPoem, VoiceState } from '../types'
import { searchPoems } from '../data/PoemSearch'
import { savePoem } from '../data/PoemLibrary'
import { PoemPlayer } from './PoemPlayer'
import { PoemSearchModal } from './PoemSearchModal'
import { findPoemOnline, searchResultToSavedPoem, type SearchResult } from '../utils/findPoemOnline'
import { getDisplaySentences } from '../utils/poemLineDisplay'
import { buildTtsLine } from '../utils/charAnnotation'
import { useWakeLock } from '../hooks/useWakeLock'
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

// Collapse 翘舌 (retroflex zh/ch/sh→z/c/s, r→y) and 鼻音 is already
// handled by substring inclusion (ng-final always contains n-final).
function normalizeAccent(p: string): string {
  return p.replace(/zh/g, 'z').replace(/ch/g, 'c').replace(/sh/g, 's').replace(/r/g, 'y')
}

export function isReciteMatch(recited: string, expected: string): boolean {
  const normalizedRecited = normalizeReciteText(recited)
  const normalizedExpected = normalizeReciteText(expected)
  if (
    normalizedRecited === normalizedExpected ||
    normalizedRecited.includes(normalizedExpected) ||
    normalizedExpected.includes(normalizedRecited)
  ) return true

  // Phonetic fallback: homophones and accent variants count as correct
  const pinyinRecited = normalizeAccent(toPinyin(normalizedRecited))
  const pinyinExpected = normalizeAccent(toPinyin(normalizedExpected))
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
  speakLines: (lines: string[], onLineStart: (i: number) => void, onDone: () => void, lang?: string) => void
  stop: () => void
  isSTTSupported: boolean
  libraryPoems: SavedPoem[]
  initialPoem?: SavedPoem
  ttsRate: number
  setTtsRate: (rate: number) => void
  onPoemUpdated?: () => Promise<void>
  lang: 'zh' | 'en'
  setLang: (lang: 'zh' | 'en') => void
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
  lang,
  setLang,
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
  const [searchMatches, setSearchMatches] = useState<SavedPoem[] | null>(null)

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
  const hasRepeatRef = useRef(false)
  const reciteSessionRatingRef = useRef<number | undefined>(undefined)

  const langRef = useRef(lang)
  useEffect(() => { langRef.current = lang }, [lang])

  useEffect(() => { autoPlayRef.current = autoPlay }, [autoPlay])
  useEffect(() => { repeatPlayRef.current = repeatPlay }, [repeatPlay])
  useEffect(() => { libraryPoemsRef.current = libraryPoems }, [libraryPoems])
  useEffect(() => { recitingRef.current = reciting }, [reciting])

  useWakeLock(voiceState !== 'idle' || reciting)

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
        if (langRef.current === 'en' && current.englishLines) {
          speakLines(current.englishLines, (i) => setHighlightedLine(i), handlePoemDone, 'en-US')
        } else {
          speakLines(
            current.lines.map((l, i) => buildTtsLine(l, i, current.charAnnotations ?? [])),
            (i) => setHighlightedLine(i),
            handlePoemDone,
          )
        }
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
          speakLines(
            langRef.current === 'en' && next.englishLines
              ? next.englishLines
              : next.lines.map((l, i) => buildTtsLine(l, i, next.charAnnotations ?? [])),
            (i) => setHighlightedLine(i),
            handlePoemDone,
            langRef.current === 'en' && next.englishLines ? 'en-US' : undefined,
          )
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
    hasRepeatRef.current = false
  }

  function getReciteSentences(poem: SavedPoem): string[] {
    return getDisplaySentences(poem.lines)
  }

  function handleReciteComplete() {
    const sessionRating = reciteSessionRatingRef.current
    stopRecitingSession()
    if (!autoPlayRef.current) return
    const next = getNextPoem(sessionRating)
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
      } else if (!hasRepeatRef.current && (poem.rating ?? 0) < 5) {
        speakLines(['要不要加颗星？'], () => setHighlightedLine(null), () => {
          startListening((spokenText) => {
            if (isYes(spokenText)) {
              const currentRating = poem.rating ?? 0
              const updated = { ...poem, rating: currentRating + 1 }
              setPoem(updated)
              void (async () => {
                try {
                  await savePoem(updated)
                  await onPoemUpdated()
                } catch (e) {
                  console.error('Failed to save rating update', e)
                }
              })()
              speakLines(['已加一颗星'], () => setHighlightedLine(null), proceedToComplete)
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
      hasRepeatRef.current = true
      speakLines(['重复'], () => setHighlightedLine(null), () => {
        const ttsSourceLines = poem.lines.map((l, i) => buildTtsLine(l, i, poem.charAnnotations ?? []))
        const ttsExpected = getDisplaySentences(ttsSourceLines)[sentenceIndex]
        speakLines([ttsExpected ?? expected], () => setHighlightedLine(null), () => {
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
    hasRepeatRef.current = false
    reciteSessionRatingRef.current = poem.rating
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
    const results = searchPoems(libraryPoems, query) as SavedPoem[]
    if (results.length === 0) {
      setNotFound(true)
      setSearchMatches(null)
    } else if (results.length === 1) {
      setNotFound(false)
      setSearchMatches(null)
      const poem = results[0]
      setPoem(poem)
      if (lang === 'en' && poem.englishLines) {
        speakLines(poem.englishLines, (i) => setHighlightedLine(i), handlePoemDone, 'en-US')
      } else {
        speakLines(
          poem.lines.map((l, i) => buildTtsLine(l, i, poem.charAnnotations ?? [])),
          (i) => setHighlightedLine(i),
          handlePoemDone,
        )
      }
    } else {
      setNotFound(false)
      setSearchMatches(results)
    }
  }

  function handlePickMatch(match: SavedPoem) {
    setSearchMatches(null)
    setPoem(match)
    if (lang === 'en' && match.englishLines) {
      speakLines(match.englishLines, (i) => setHighlightedLine(i), handlePoemDone, 'en-US')
    } else {
      speakLines(
        match.lines.map((l, i) => buildTtsLine(l, i, match.charAnnotations ?? [])),
        (i) => setHighlightedLine(i),
        handlePoemDone,
      )
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

  async function handleLineBoldToggle(lineIndex: number) {
    if (!currentPoem) return
    const current = currentPoem.boldLines ?? []
    const isBold = current.includes(lineIndex)
    const boldLines = isBold ? current.filter((i) => i !== lineIndex) : [...current, lineIndex]
    const updated: SavedPoem = { ...currentPoem, boldLines }
    setPoem(updated)
    await savePoem(updated)
    await onPoemUpdated()
  }

  async function handleCharAnnotate(lineIndex: number, charIndex: number, pinyin: string, substitute: string) {
    if (!currentPoem) return
    const existing = currentPoem.charAnnotations ?? []
    const filtered = existing.filter((a) => !(a.lineIndex === lineIndex && a.charIndex === charIndex))
    const charAnnotations = [...filtered, { lineIndex, charIndex, pinyin, substitute }]
    const updated = { ...currentPoem, charAnnotations }
    setPoem(updated)
    await savePoem(updated)
    await onPoemUpdated()
  }

  async function handleCharAnnotateRemove(lineIndex: number, charIndex: number) {
    if (!currentPoem) return
    const charAnnotations = (currentPoem.charAnnotations ?? [])
      .filter((a) => !(a.lineIndex === lineIndex && a.charIndex === charIndex))
    const updated = { ...currentPoem, charAnnotations }
    setPoem(updated)
    await savePoem(updated)
    await onPoemUpdated()
  }

  async function handleRate(rating: number) {
    if (!currentPoem) return
    const updated: SavedPoem = {
      ...currentPoem,
      rating: currentPoem.rating === rating ? undefined : rating,
    }
    try {
      await savePoem(updated)
      setPoem(updated)
      await onPoemUpdated()
    } catch (e) {
      console.error('Failed to save rating', e)
    }
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

  function getNextPoem(ratingOverride?: number): SavedPoem | null {
    const current = currentPoemRef.current
    if (!current) return null
    const poems = libraryPoemsRef.current

    const targetRating = ratingOverride !== undefined ? ratingOverride : current.rating
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
        {currentPoem && (
          <button
            className="btn-back"
            aria-label="返回"
            onClick={() => { setCurrentPoem(null); stopRecitingSession(); stop() }}
          >
            ←
          </button>
        )}
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
      </div>

      {searchMatches && (
        <ul className="search-matches">
          {searchMatches.map((m) => (
            <li key={m.id}>
              <button onClick={() => handlePickMatch(m)}>
                {m.title} — {m.author}
              </button>
            </li>
          ))}
        </ul>
      )}

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
            if (lang === 'en' && currentPoem.englishLines) {
              speakLines(
                currentPoem.englishLines,
                (i) => { setHighlightedLine(i); onLineStart(i) },
                () => { onDone(); setHighlightedLine(null); handlePoemDone() },
                'en-US'
              )
            } else {
              // `lines` is always poem.lines verbatim from PoemPlayer.handlePlay; idx == lineIndex
              const ttsLines = lines.map((l, idx) => buildTtsLine(l, idx, currentPoem.charAnnotations ?? []))
              speakLines(
                ttsLines,
                (i) => { setHighlightedLine(i); onLineStart(i) },
                () => { onDone(); setHighlightedLine(null); handlePoemDone() },
              )
            }
          }}
          onStop={() => { manuallyStoppedRef.current = true; stopRecitingSession(); stop() }}
          isPlaying={voiceState !== 'idle' || reciting}
          highlightedLine={highlightedLine}
          ttsRate={ttsRate}
          setTtsRate={setTtsRate}
          onLineEdit={handleLineEdit}
          onLineBoldToggle={handleLineBoldToggle}
          onSpeakLine={(lineIndex) => {
            stop()
            if (lang === 'en' && currentPoem.englishLines?.[lineIndex]) {
              speakLines([currentPoem.englishLines[lineIndex]], () => {}, () => {}, 'en-US')
            } else {
              const ttsText = buildTtsLine(currentPoem.lines[lineIndex], lineIndex, currentPoem.charAnnotations ?? [])
              speakLines([ttsText], () => {}, () => {})
            }
          }}
          autoPlay={autoPlay}
          onAutoPlayToggle={toggleAutoPlay}
          reciting={reciting}
          onReciteToggle={toggleReciting}
          repeatPlay={repeatPlay}
          onRepeatPlayToggle={toggleRepeatPlay}
          nextPoem={autoPlay && !repeatPlay ? getNextPoem() : null}
          onNextPoem={handleJumpToNext}
          onCharAnnotate={handleCharAnnotate}
          onCharAnnotateRemove={handleCharAnnotateRemove}
          onRate={currentPoem ? handleRate : undefined}
          lang={lang}
          setLang={setLang}
        />
      )}
    </div>
  )
}

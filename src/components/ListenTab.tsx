import { useState, useEffect, useRef } from 'react'
import type { SavedPoem, VoiceState } from '../types'
import { searchPoems } from '../data/PoemSearch'
import { PoemPlayer } from './PoemPlayer'

interface ListenTabProps {
  voiceState: VoiceState
  startListening: (onResult: (text: string) => void) => void
  speakLines: (lines: string[], onLineStart: (i: number) => void, onDone: () => void) => void
  stop: () => void
  isSTTSupported: boolean
  libraryPoems: SavedPoem[]
  initialPoem?: SavedPoem
  ttsRate: number
  setTtsRate: (rate: number) => void
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
}: ListenTabProps) {
  const [currentPoem, setCurrentPoem] = useState<SavedPoem | null>(null)
  const [highlightedLine, setHighlightedLine] = useState<number | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [textQuery, setTextQuery] = useState('')
  const autoPlayedRef = useRef(false)

  useEffect(() => {
    if (initialPoem && !autoPlayedRef.current) {
      autoPlayedRef.current = true
      setCurrentPoem(initialPoem)
      speakLines(
        initialPoem.lines,
        (i) => setHighlightedLine(i),
        () => setHighlightedLine(null)
      )
    }
  }, [initialPoem, speakLines])

  useEffect(() => {
    return () => stop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const statusText = voiceState === 'listening'
    ? '正在听...'
    : notFound
    ? '诗库中未找到，请先在诗库中添加'
    : currentPoem
    ? currentPoem.title
    : '说出诗名...'

  function handleSearch(query: string) {
    const results = searchPoems(libraryPoems, query)
    if (results.length > 0) {
      const found = results[0] as SavedPoem
      setCurrentPoem(found)
      setNotFound(false)
      speakLines(
        found.lines,
        (i) => setHighlightedLine(i),
        () => setHighlightedLine(null)
      )
    } else {
      setNotFound(true)
    }
  }

  function handleMicClick() {
    if (voiceState === 'idle') {
      setNotFound(false)
      startListening((text) => {
        handleSearch(text)
      })
    } else {
      stop()
    }
  }

  function handleTextSearch() {
    handleSearch(textQuery)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      handleTextSearch()
    }
  }

  return (
    <div className="listen-tab">
      <div className="listen-status">{statusText}</div>

      {isSTTSupported ? (
        <button
          className={`mic-button${voiceState === 'listening' ? ' active' : ''}`}
          aria-label={
            voiceState === 'listening'
              ? '停止录音'
              : voiceState === 'speaking'
              ? '停止朗读'
              : '开始录音'
          }
          onClick={handleMicClick}
        >
          {voiceState === 'listening' ? '🎙️' : '🎤'}
        </button>
      ) : (
        <div className="text-search">
          <input
            type="text"
            placeholder="输入诗名..."
            aria-label="诗名"
            lang="zh-CN"
            value={textQuery}
            onChange={(e) => setTextQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button onClick={handleTextSearch}>搜索</button>
        </div>
      )}

      {currentPoem && (
        <PoemPlayer
          poem={currentPoem}
          onPlay={(lines, onLineStart, onDone) => speakLines(lines, onLineStart, onDone)}
          onStop={stop}
          isPlaying={voiceState === 'speaking'}
          highlightedLine={highlightedLine}
          ttsRate={ttsRate}
          setTtsRate={setTtsRate}
        />
      )}
    </div>
  )
}

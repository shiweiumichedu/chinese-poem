import { useState, useRef, useEffect } from 'react'
import type { SavedPoem } from '../types'
import { DYNASTY_LABEL } from '../constants'
import { buildDisplayLines } from '../utils/poemLineDisplay'

type Rect = { top: number; bottom: number; height: number }

export function computePageTurnScroll(
  highlightedRect: Rect,
  containerRect: Rect,
  controlsVisible: boolean,
  currentScrollTop: number,
): number | null {
  if (controlsVisible) return null
  const threshold = containerRect.height * 0.35
  if (highlightedRect.bottom > containerRect.bottom - threshold) {
    return currentScrollTop + (highlightedRect.top - containerRect.top) - 20
  }
  return null
}

const SPEED_PRESETS = [
  { label: '极慢', rate: 0.25 },
  { label: '较慢', rate: 0.4 },
  { label: '慢', rate: 0.7 },
  { label: '正常', rate: 1.0 },
  { label: '快', rate: 1.4 },
] as const

interface PoemPlayerProps {
  poem: SavedPoem
  onPlay: (
    lines: string[],
    onLineStart: (index: number) => void,
    onDone: () => void
  ) => void
  onStop: () => void
  onBack?: () => void
  isPlaying: boolean
  highlightedLine?: number | null
  ttsRate: number
  setTtsRate: (rate: number) => void
  onLineEdit?: (lineIndex: number, newText: string) => void
  onLineBoldToggle?: (lineIndex: number) => void
  onSpeakLine?: (lineIndex: number) => void
  onCharAnnotate?: (lineIndex: number, charIndex: number, pinyin: string, substitute: string) => void
  onCharAnnotateRemove?: (lineIndex: number, charIndex: number) => void
  autoPlay?: boolean
  onAutoPlayToggle?: () => void
  repeatPlay?: boolean
  onRepeatPlayToggle?: () => void
  reciting?: boolean
  onReciteToggle?: () => void
  nextPoem?: SavedPoem | null
  onNextPoem?: () => void
}

export function PoemPlayer({ poem, onPlay, onStop, isPlaying, highlightedLine, ttsRate, setTtsRate, onLineEdit, onLineBoldToggle, onSpeakLine, autoPlay, onAutoPlayToggle, repeatPlay, onRepeatPlayToggle, reciting, onReciteToggle, onBack, nextPoem, onNextPoem, onCharAnnotate, onCharAnnotateRemove }: PoemPlayerProps) {
  const [internalHighlight, setInternalHighlight] = useState<number | null>(null)
  const [editingLine, setEditingLine] = useState<number | null>(null)
  const [editValue, setEditValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const committingRef = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressFiredRef = useRef(false)
  const [annotationTarget, setAnnotationTarget] = useState<{
    lineIndex: number
    charIndex: number
    char: string
    existing?: { pinyin: string; substitute: string }
  } | null>(null)
  const [annotPinyin, setAnnotPinyin] = useState('')
  const [annotSubstitute, setAnnotSubstitute] = useState('')

  const displayHighlight = highlightedLine !== undefined ? highlightedLine : internalHighlight

  useEffect(() => {
    if (displayHighlight === null || displayHighlight === undefined) return
    const highlighted = containerRef.current?.querySelector('.poem-line.highlighted') as HTMLElement | null
    if (!highlighted) return
    const scrollEl = document.querySelector('.app-content') as HTMLElement | null
    if (!scrollEl) return
    const controls = containerRef.current?.querySelector('.poem-controls') as HTMLElement | null
    const controlsRect = controls?.getBoundingClientRect()
    const scrollElRect = scrollEl.getBoundingClientRect()
    const controlsVisible = controlsRect ? controlsRect.top < scrollElRect.bottom : false
    const newTop = computePageTurnScroll(
      highlighted.getBoundingClientRect(),
      scrollElRect,
      controlsVisible,
      scrollEl.scrollTop,
    )
    if (newTop !== null) scrollEl.scrollTop = newTop
  }, [displayHighlight])
  const displayLines = buildDisplayLines(poem.lines)

  function handlePlay() {
    setInternalHighlight(null)
    onPlay(
      poem.lines,
      (index) => setInternalHighlight(index),
      () => setInternalHighlight(null)
    )
  }

  function handleStop() {
    setInternalHighlight(null)
    onStop()
  }

  function startEdit(index: number) {
    if (isPlaying || !onLineEdit) return
    setEditingLine(index)
    setEditValue(poem.lines[index])
    setTimeout(() => inputRef.current?.select(), 0)
  }

  function commitEdit() {
    if (editingLine === null || committingRef.current) return
    committingRef.current = true
    const trimmed = editValue.trim()
    if (trimmed && trimmed !== poem.lines[editingLine]) {
      onLineEdit?.(editingLine, trimmed)
    }
    setEditingLine(null)
    setTimeout(() => { committingRef.current = false }, 0)
  }

  function handleEditKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') commitEdit()
    if (e.key === 'Escape') setEditingLine(null)
  }

  function handleCharTouchStart(
    e: React.TouchEvent,
    lineIndex: number,
    charIndex: number,
    char: string,
  ) {
    longPressFiredRef.current = false
    longPressTimerRef.current = setTimeout(() => {
      longPressFiredRef.current = true
      const existing = poem.charAnnotations?.find(
        (a) => a.lineIndex === lineIndex && a.charIndex === charIndex
      )
      setAnnotationTarget({ lineIndex, charIndex, char, existing })
      setAnnotPinyin(existing?.pinyin ?? '')
      setAnnotSubstitute(existing?.substitute ?? '')
    }, 500)
  }

  function handleCharTouchEnd(e: React.TouchEvent) {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
    if (longPressFiredRef.current) {
      e.preventDefault()
    }
  }

  return (
    <div className="poem-player" ref={containerRef}>
      {onBack && (
        <button className="btn-back" onClick={onBack} aria-label="返回">
          ←
        </button>
      )}
      <h2 className="poem-title">{poem.title}</h2>
      <p className="poem-author">{poem.author} · {DYNASTY_LABEL[poem.dynasty] ?? poem.dynasty}</p>
      {poem.rating !== undefined && (
        <div className="poem-player-rating">
          {[1, 2, 3, 4, 5].map((star) => (
            <span key={star} className={`player-star${(poem.rating ?? 0) >= star ? ' filled' : ''}`}>
              ★
            </span>
          ))}
        </div>
      )}
      <div className="poem-lines">
        {displayLines.map((line, i) => {
          const isFirstRowForSource = i === 0 || displayLines[i - 1].sourceLineIndex !== line.sourceLineIndex
          const isEditingSource = editingLine === line.sourceLineIndex

          if (isEditingSource && isFirstRowForSource) {
            const isBold = poem.boldLines?.includes(line.sourceLineIndex) ?? false
            return (
              <div key={`edit-${line.sourceLineIndex}`} className="poem-line-edit-row">
                <input
                  ref={inputRef}
                  className="poem-line-edit"
                  lang="zh-CN"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={commitEdit}
                  onKeyDown={handleEditKeyDown}
                  autoFocus
                />
                {onLineBoldToggle && (
                  <button
                    className={`btn-bold${isBold ? ' active' : ''}`}
                    aria-label="B"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      onLineBoldToggle(line.sourceLineIndex)
                      setEditingLine(null)
                    }}
                  >
                    B
                  </button>
                )}
              </div>
            )
          }

          if (isEditingSource) {
            return null
          }

          const isBoldLine = poem.boldLines?.includes(line.sourceLineIndex) ?? false
          return (
            <p
              key={`${line.sourceLineIndex}-${i}`}
              className={`poem-line${line.sourceLineIndex === displayHighlight ? ' highlighted' : ''}${isBoldLine ? ' bold' : ''}${onLineEdit && !isPlaying ? ' editable' : ''}`}
              onClick={() => {
                onSpeakLine?.(line.sourceLineIndex)
                startEdit(line.sourceLineIndex)
              }}
            >
              {Array.from(line.text).map((char, charOffset) => {
                const sourceCharIndex = line.sourceCharOffset + charOffset
                const annotation = poem.charAnnotations?.find(
                  (a) => a.lineIndex === line.sourceLineIndex && a.charIndex === sourceCharIndex
                )
                const touchHandlers = {
                  onTouchStart: (e: React.TouchEvent) =>
                    handleCharTouchStart(e, line.sourceLineIndex, sourceCharIndex, char),
                  onTouchEnd: handleCharTouchEnd,
                }
                if (annotation) {
                  return (
                    <ruby key={charOffset} {...touchHandlers}>
                      {char}<rt>{annotation.pinyin}</rt>
                    </ruby>
                  )
                }
                return <span key={charOffset} {...touchHandlers}>{char}</span>
              })}
            </p>
          )
        })}
      </div>
      <div className="speed-presets">
        {SPEED_PRESETS.map(({ label, rate }) => (
          <button
            key={rate}
            className={`btn-speed${ttsRate === rate ? ' active' : ''}`}
            aria-pressed={ttsRate === rate}
            onClick={() => setTtsRate(rate)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="poem-controls">
        {isPlaying ? (
          <button onClick={handleStop} className="btn-stop">停止</button>
        ) : (
          <button onClick={handlePlay} className="btn-play">朗读</button>
        )}
        {onReciteToggle && (
          <button
            className={`btn-recite${reciting ? ' active' : ''}`}
            aria-pressed={reciting}
            onClick={onReciteToggle}
          >
            背诵
          </button>
        )}
        {onAutoPlayToggle && (
          <button
            className={`btn-autoplay${autoPlay ? ' active' : ''}`}
            aria-pressed={autoPlay}
            onClick={onAutoPlayToggle}
          >
            连续
          </button>
        )}
        {onRepeatPlayToggle && (
          <button
            className={`btn-repeat${repeatPlay ? ' active' : ''}`}
            aria-pressed={repeatPlay}
            onClick={onRepeatPlayToggle}
          >
            重复
          </button>
        )}
      </div>
      {autoPlay && nextPoem && (
        <button className="next-poem-preview" onClick={onNextPoem}>
          <p className="next-poem-label">下一首 ›</p>
          <p className="next-poem-title">{nextPoem.title}</p>
          <p className="next-poem-author">{nextPoem.author}</p>
        </button>
      )}
      {poem.authorBackground && (
        <div className="author-background">
          <p>{poem.authorBackground}</p>
        </div>
      )}
      {annotationTarget && (
        <div className="annotation-popup" onClick={(e) => e.stopPropagation()}>
          <div className="annotation-char">{annotationTarget.char}</div>
          <div className="annotation-fields">
            <input
              placeholder="拼音 (e.g. huán)"
              value={annotPinyin}
              onChange={(e) => setAnnotPinyin(e.target.value)}
            />
            <input
              placeholder="替换字 (e.g. 环)"
              value={annotSubstitute}
              onChange={(e) => setAnnotSubstitute(e.target.value)}
            />
          </div>
          <div className="annotation-buttons">
            <button onClick={() => {
              onCharAnnotate?.(annotationTarget.lineIndex, annotationTarget.charIndex, annotPinyin.trim(), annotSubstitute.trim())
              setAnnotationTarget(null)
            }}>保存</button>
            {annotationTarget.existing && (
              <button onClick={() => {
                onCharAnnotateRemove?.(annotationTarget.lineIndex, annotationTarget.charIndex)
                setAnnotationTarget(null)
              }}>删除</button>
            )}
            <button onClick={() => setAnnotationTarget(null)}>取消</button>
          </div>
        </div>
      )}
    </div>
  )
}

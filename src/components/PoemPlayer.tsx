import { useState } from 'react'
import type { SavedPoem } from '../types'
import { DYNASTY_LABEL } from '../constants'

const SPEED_PRESETS = [
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
  isPlaying: boolean
  highlightedLine?: number | null
  ttsRate: number
  setTtsRate: (rate: number) => void
}

export function PoemPlayer({ poem, onPlay, onStop, isPlaying, highlightedLine, ttsRate, setTtsRate }: PoemPlayerProps) {
  const [internalHighlight, setInternalHighlight] = useState<number | null>(null)

  const displayHighlight = highlightedLine !== undefined ? highlightedLine : internalHighlight

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

  return (
    <div className="poem-player">
      <h2 className="poem-title">{poem.title}</h2>
      <p className="poem-author">{poem.author} · {DYNASTY_LABEL[poem.dynasty] ?? poem.dynasty}</p>
      <div className="poem-lines">
        {poem.lines.map((line, i) => (
          <p
            key={i}
            className={`poem-line${i === displayHighlight ? ' highlighted' : ''}`}
          >
            {line}
          </p>
        ))}
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
      </div>
      {poem.authorBackground && (
        <div className="author-background">
          <p>{poem.authorBackground}</p>
        </div>
      )}
    </div>
  )
}

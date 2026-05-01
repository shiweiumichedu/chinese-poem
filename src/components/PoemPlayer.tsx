import { useState } from 'react'
import type { SavedPoem } from '../types'
import { DYNASTY_LABEL } from '../constants'

interface PoemPlayerProps {
  poem: SavedPoem
  onPlay: (
    lines: string[],
    onLineStart: (index: number) => void,
    onDone: () => void
  ) => void
  onStop: () => void
  isPlaying: boolean  // controlled from parent (voiceState === 'speaking')
}

export function PoemPlayer({ poem, onPlay, onStop, isPlaying }: PoemPlayerProps) {
  const [highlightedLine, setHighlightedLine] = useState<number | null>(null)

  function handlePlay() {
    setHighlightedLine(null)
    onPlay(
      poem.lines,
      (index) => setHighlightedLine(index),
      () => setHighlightedLine(null)
    )
  }

  function handleStop() {
    setHighlightedLine(null)
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
            className={`poem-line${i === highlightedLine ? ' highlighted' : ''}`}
          >
            {line}
          </p>
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

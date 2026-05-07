export interface CorpusPoem {
  id: string
  title: string
  author: string
  dynasty: 'tang' | 'song' | 'ming'
  authorBackground: string
  lines: string[]
  englishLines?: string[]
}

export interface SavedPoem extends CorpusPoem {
  writingBackground?: string
  addedAt: number
  rating?: number // 1-5 star rating
  boldLines?: number[]
  charAnnotations?: CharAnnotation[]
}

export interface CharAnnotation {
  lineIndex: number
  charIndex: number
  pinyin: string
  substitute: string
}

export type AppTab = 'listen' | 'library'

export type VoiceState = 'idle' | 'listening' | 'speaking'

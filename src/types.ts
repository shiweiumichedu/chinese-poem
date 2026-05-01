export interface CorpusPoem {
  id: string
  title: string
  author: string
  dynasty: 'tang' | 'song'
  authorBackground: string
  lines: string[]
}

export interface SavedPoem {
  id: string
  title: string
  author: string
  dynasty: string
  authorBackground: string
  writingBackground?: string
  lines: string[]
  addedAt: number
}

export type AppTab = 'listen' | 'library'

export type VoiceState = 'idle' | 'listening' | 'speaking'

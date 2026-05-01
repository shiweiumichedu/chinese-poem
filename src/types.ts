export interface CorpusPoem {
  id: string
  title: string
  author: string
  dynasty: 'tang' | 'song'
  authorBackground: string
  lines: string[]
}

export interface SavedPoem extends CorpusPoem {
  writingBackground?: string
  addedAt: number
}

export type AppTab = 'listen' | 'library'

export type VoiceState = 'idle' | 'listening' | 'speaking'

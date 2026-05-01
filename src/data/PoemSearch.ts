import type { CorpusPoem } from '../types'

const PUNCTUATION = /[\s，。！？、；：“”‘’【】《》（）…—～\[\]{}<>]/g

function normalize(str: string): string {
  return str.replace(PUNCTUATION, '').toLowerCase()
}

export function searchPoems(corpus: CorpusPoem[], query: string): CorpusPoem[] {
  const normalizedQuery = normalize(query)
  if (!normalizedQuery) return []

  const exact: CorpusPoem[] = []
  const partial: CorpusPoem[] = []

  for (const poem of corpus) {
    const normalizedTitle = normalize(poem.title)
    if (normalizedTitle === normalizedQuery) {
      exact.push(poem)
    } else if (normalizedTitle.includes(normalizedQuery)) {
      partial.push(poem)
    }
  }

  return [...exact, ...partial]
}

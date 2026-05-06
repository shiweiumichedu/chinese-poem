import type { CorpusPoem } from '../types'
import { Converter } from 'opencc-js/t2cn'

const PUNCTUATION = /[\s，。！？、；：””’’【】《》（）…—～[\]{}<>]/g
const t2s = Converter({ from: 'tw', to: 'cn' })
const normalizeCache = new Map<string, string>()

function normalizeBasic(str: string): string {
  return str.replace(PUNCTUATION, '').toLowerCase()
}

function normalize(str: string): string {
  const cached = normalizeCache.get(str)
  if (cached) return cached

  const normalized = normalizeBasic(t2s(str))
  normalizeCache.set(str, normalized)
  return normalized
}

export function searchPoems(corpus: CorpusPoem[], query: string): CorpusPoem[] {
  const normalizedQuery = normalize(query)
  if (!normalizedQuery) return []

  const exact: CorpusPoem[] = []
  const partial: CorpusPoem[] = []
  const lineMatch: CorpusPoem[] = []

  for (const poem of corpus) {
    const normalizedTitle = normalize(poem.title)

    if (normalizedTitle === normalizedQuery) {
      exact.push(poem)
    } else if (normalizedTitle.includes(normalizedQuery)) {
      partial.push(poem)
    } else if (
      poem.lines.some((line) => {
        const normalizedLine = normalize(line)
        return normalizedLine.includes(normalizedQuery)
      })
    ) {
      lineMatch.push(poem)
    }
  }

  return [...exact, ...partial, ...lineMatch]
}

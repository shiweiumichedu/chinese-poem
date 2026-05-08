import { useState, useEffect } from 'react'
import type { CorpusPoem } from '../types'

const SUPPLEMENTAL_POEMS: Omit<CorpusPoem, 'authorBackground'>[] = [
  {
    id: 'supplemental-jia-dao-xun-yin-zhe-bu-yu',
    title: '寻隐者不遇',
    author: '贾岛',
    dynasty: 'tang',
    lines: ['松下问童子，言师采药去。', '只在此山中，云深不知处。'],
  },
]

function poemKey(poem: Pick<CorpusPoem, 'title' | 'author'>): string {
  return `${poem.title}::${poem.author}`
}

interface UseCorpusResult {
  corpus: CorpusPoem[]
  loading: boolean
  error: string | null
}

export function useCorpus(): UseCorpusResult {
  const [corpus, setCorpus] = useState<CorpusPoem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const [rawPoems, authors, translations] = await Promise.all([
          fetch('/corpus.json').then(r => {
            if (!r.ok) throw new Error(`Failed to fetch corpus: ${r.status}`)
            return r.json() as Promise<CorpusPoem[]>
          }),
          fetch('/authors.json').then(r => {
            if (!r.ok) throw new Error(`Failed to fetch authors: ${r.status}`)
            return r.json() as Promise<Record<string, string>>
          }),
          fetch('/translations.json').then(r =>
            r.ok ? r.json() as Promise<Record<string, string[]>> : {} as Record<string, string[]>
          ).catch(() => ({} as Record<string, string[]>)),
        ])

        if (cancelled) return

        const joined = rawPoems.map((poem) => ({
          ...poem,
          authorBackground: authors[poem.author] ?? '',
          ...(translations[poem.id] ? { englishLines: translations[poem.id] } : {}),
        }))

        const existing = new Set(joined.map(poemKey))
        for (const poem of SUPPLEMENTAL_POEMS) {
          if (existing.has(poemKey(poem))) continue

          joined.push({
            ...poem,
            authorBackground: authors[poem.author] ?? '',
          })
        }

        setCorpus(joined)
        setLoading(false)
      } catch (err) {
        if (cancelled) return
        const message = err instanceof Error ? err.message : 'Failed to load corpus'
        setError(message)
        setLoading(false)
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [])

  return { corpus, loading, error }
}

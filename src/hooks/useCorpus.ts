import { useState, useEffect } from 'react'
import type { CorpusPoem } from '../types'

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
        const [poemsRes, authorsRes] = await Promise.all([
          fetch('/corpus.json'),
          fetch('/authors.json'),
        ])
        const rawPoems: CorpusPoem[] = await poemsRes.json()
        const authors: Record<string, string> = await authorsRes.json()

        if (cancelled) return

        const joined = rawPoems.map((poem) => ({
          ...poem,
          authorBackground: authors[poem.author] ?? '',
        }))

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

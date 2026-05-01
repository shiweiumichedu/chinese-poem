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
        const [rawPoems, authors] = await Promise.all([
          fetch('/corpus.json').then(r => {
            if (!r.ok) throw new Error(`Failed to fetch corpus: ${r.status}`)
            return r.json() as Promise<CorpusPoem[]>
          }),
          fetch('/authors.json').then(r => {
            if (!r.ok) throw new Error(`Failed to fetch authors: ${r.status}`)
            return r.json() as Promise<Record<string, string>>
          }),
        ])

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

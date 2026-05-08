import type { SavedPoem } from '../types'
import * as opencc from 'opencc-js'

export interface SearchResult {
  title: string
  author: string
  lines: string[]
  dynasty?: 'tang' | 'song'
}

interface IndexEntry {
  t: string
  a: string
  d: 'tang' | 'song'
  f: number
  local?: boolean
}

interface BatchPoem {
  title: string
  author: string
  paragraphs: string[]
}

const RAW_BASE =
  'https://raw.githubusercontent.com/chinese-poetry/chinese-poetry/master/%E5%85%A8%E5%94%90%E8%AF%97'

const t2s = opencc.Converter({ from: 'hk', to: 'cn' })

let indexCache: IndexEntry[] | null = null

export function resetIndexCache(): void {
  indexCache = null
}

function normalize(s: string): string {
  return t2s(s)
    .replace(/[，。！？、；：""''「」【】《》〈〉\s]/g, '')
    .toLowerCase()
}

async function loadIndex(): Promise<IndexEntry[]> {
  if (indexCache) return indexCache
  const res = await fetch('/poem-search-index.json', {
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) throw new Error(`无法加载诗词索引，请检查网络连接 (${res.status})`)
  indexCache = (await res.json()) as IndexEntry[]
  return indexCache
}

async function fetchBatch(d: 'tang' | 'song', f: number): Promise<BatchPoem[]> {
  const url = `${RAW_BASE}/poet.${d}.${f}.json`
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) })
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`)
  return res.json() as Promise<BatchPoem[]>
}

export async function findPoemOnline(query: string): Promise<SearchResult[]> {
  const trimmed = query.trim()
  if (!trimmed) return []

  const index = await loadIndex()
  const q = normalize(trimmed)
  const nonLocal = index.filter((e) => !e.local)

  const exactTitle = nonLocal.filter((e) => normalize(e.t) === q)
  const partialTitle = nonLocal.filter(
    (e) => normalize(e.t).includes(q) && normalize(e.t) !== q,
  )
  const authorMatch = nonLocal.filter(
    (e) => normalize(e.a).includes(q) && !normalize(e.t).includes(q),
  )

  const candidates = [...exactTitle, ...partialTitle, ...authorMatch].slice(0, 10)

  const seen = new Set<string>()
  const results: SearchResult[] = []
  for (const entry of candidates) {
    try {
      const batch = await fetchBatch(entry.d, entry.f)
      const poem = batch.find((p) => normalize(p.title) === normalize(entry.t))
      if (!poem) continue
      const key = `${entry.t}|${entry.a}`
      if (seen.has(key)) continue
      seen.add(key)
      results.push({
        title: entry.t,
        author: entry.a,
        dynasty: entry.d,
        lines: poem.paragraphs.map((l) => l.trim()).filter(Boolean),
      })
      if (results.length >= 5) break
    } catch {
      // network or parse error for this batch — skip entry
    }
  }

  return results
}

export function searchResultToSavedPoem(result: SearchResult): SavedPoem {
  const id = `online_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
  return {
    id,
    title: result.title,
    author: result.author,
    lines: result.lines,
    authorBackground: '',
    dynasty: result.dynasty ?? 'tang',
    addedAt: Date.now(),
  }
}

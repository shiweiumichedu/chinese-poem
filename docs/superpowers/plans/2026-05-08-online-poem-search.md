# Online Poem Search Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the broken `api.gushiwen.org` call with a build-time compact index over the full Chinese poetry GitHub repo, enabling in-app search and add-to-library for poems outside the local 40k corpus.

**Architecture:** `build-corpus.mjs` generates `public/poem-search-index.json` — compact `{t, a, d, f, local?}` entries for all loaded poems (Tang all + Song up to 80k). At runtime, `findPoemOnline` fetches and caches that index, searches it (filtering local poems), then fetches the specific batch JSON from GitHub raw to get lines for each match.

**Tech Stack:** TypeScript, opencc-js (t2s conversion), Vitest, GitHub raw content URLs (`raw.githubusercontent.com`).

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/utils/poemWebSearch.ts` | Modify | Remove destructive `location.href` fallback |
| `src/utils/findPoemOnline.ts` | Rewrite | Index-based search replacing dead API call |
| `tests/utils/findPoemOnline.test.ts` | Create | Unit tests for new search logic |
| `scripts/build-corpus.mjs` | Modify | Write `public/poem-search-index.json` alongside corpus |

---

## Task 1: Fix `poemWebSearch.ts`

**Files:**
- Modify: `src/utils/poemWebSearch.ts`

- [ ] **Step 1: Remove the `location.href` fallback**

Replace the entire file with:

```typescript
export function openPoemWebSearch(rawQuery: string) {
  const query = rawQuery.trim()
  if (!query) return

  const url = `https://so.gushiwen.cn/search.aspx?value=${encodeURIComponent(query)}`
  window.open(url, '_blank', 'noopener,noreferrer')
}
```

- [ ] **Step 2: Verify lint passes**

```bash
npm run lint
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/utils/poemWebSearch.ts
git commit -m "fix: remove destructive location.href fallback in poemWebSearch"
```

---

## Task 2: Write failing tests for `findPoemOnline`

**Files:**
- Create: `tests/utils/findPoemOnline.test.ts`

- [ ] **Step 1: Create the test file**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { findPoemOnline, searchResultToSavedPoem, resetIndexCache } from '../../src/utils/findPoemOnline'

// Compact index — two non-local entries, one local (should be filtered)
const MOCK_INDEX = [
  { t: '春江花月夜', a: '张若虚', d: 'tang', f: 1000 },
  { t: '春夜喜雨',   a: '杜甫',   d: 'tang', f: 2000 },
  { t: '声声慢',     a: '李清照', d: 'song', f: 5000 },
  { t: '静夜思',     a: '李白',   d: 'tang', f: 0,    local: true },
]

const BATCH_1000 = [
  { id: 'x1', title: '春江花月夜', author: '张若虚', paragraphs: ['春江潮水连海平，', '海上明月共潮生。'] },
]
const BATCH_2000 = [
  { id: 'x2', title: '春夜喜雨',   author: '杜甫',   paragraphs: ['好雨知时节，', '当春乃发生。'] },
]
const BATCH_5000 = [
  { id: 'x3', title: '声声慢',     author: '李清照', paragraphs: ['寻寻觅觅，', '冷冷清清。'] },
]

function mockFetch(url: string): Promise<Response> {
  const body = url.includes('poem-search-index')
    ? JSON.stringify(MOCK_INDEX)
    : url.includes('poet.tang.1000')
    ? JSON.stringify(BATCH_1000)
    : url.includes('poet.tang.2000')
    ? JSON.stringify(BATCH_2000)
    : url.includes('poet.song.5000')
    ? JSON.stringify(BATCH_5000)
    : null

  if (body === null) return Promise.resolve({ ok: false, status: 404 } as Response)
  return Promise.resolve({ ok: true, json: () => Promise.resolve(JSON.parse(body)) } as Response)
}

beforeEach(() => {
  resetIndexCache()
  vi.restoreAllMocks()
  vi.spyOn(globalThis, 'fetch').mockImplementation(mockFetch as typeof fetch)
})

describe('findPoemOnline', () => {
  it('returns empty array for empty query', async () => {
    const results = await findPoemOnline('  ')
    expect(results).toEqual([])
  })

  it('exact title match returns correct SearchResult', async () => {
    const results = await findPoemOnline('春江花月夜')
    expect(results).toHaveLength(1)
    expect(results[0].title).toBe('春江花月夜')
    expect(results[0].author).toBe('张若虚')
    expect(results[0].dynasty).toBe('tang')
    expect(results[0].lines).toEqual(['春江潮水连海平，', '海上明月共潮生。'])
  })

  it('partial title match returns result', async () => {
    const results = await findPoemOnline('春夜')
    expect(results).toHaveLength(1)
    expect(results[0].title).toBe('春夜喜雨')
  })

  it('author match returns result when title does not match', async () => {
    const results = await findPoemOnline('李清照')
    expect(results).toHaveLength(1)
    expect(results[0].title).toBe('声声慢')
    expect(results[0].dynasty).toBe('song')
  })

  it('filters out local:true entries from results', async () => {
    const results = await findPoemOnline('静夜思')
    expect(results).toHaveLength(0)
  })

  it('returns empty array when no match found', async () => {
    const results = await findPoemOnline('xyznotapoem')
    expect(results).toHaveLength(0)
  })

  it('throws when index fetch fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve({ ok: false, status: 500 } as Response)
    )
    await expect(findPoemOnline('春')).rejects.toThrow('无法加载诗词索引')
  })

  it('skips result silently when batch fetch fails, returns remaining', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((url) => {
      const u = url as string
      if (u.includes('poem-search-index')) return mockFetch(u)
      if (u.includes('poet.tang.1000')) return Promise.resolve({ ok: false, status: 404 } as Response)
      return mockFetch(u)
    })
    // Query matches both 春江花月夜 (batch 1000 fails) and 春夜喜雨 (batch 2000 ok)
    const results = await findPoemOnline('春')
    expect(results).toHaveLength(1)
    expect(results[0].title).toBe('春夜喜雨')
  })

  it('caches index — fetches /poem-search-index.json only once across calls', async () => {
    await findPoemOnline('春江花月夜')
    await findPoemOnline('春夜喜雨')
    const fetchCalls = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls
    const indexFetches = fetchCalls.filter(([url]: [string]) =>
      (url as string).includes('poem-search-index')
    )
    expect(indexFetches).toHaveLength(1)
  })
})

describe('searchResultToSavedPoem', () => {
  it('uses dynasty from result instead of hardcoding tang', () => {
    const result = { title: '声声慢', author: '李清照', lines: ['寻寻觅觅，'], dynasty: 'song' as const }
    const saved = searchResultToSavedPoem(result)
    expect(saved.dynasty).toBe('song')
  })

  it('falls back to tang when dynasty is absent', () => {
    const result = { title: '春江花月夜', author: '张若虚', lines: ['春江潮水连海平，'] }
    const saved = searchResultToSavedPoem(result)
    expect(saved.dynasty).toBe('tang')
  })

  it('generates a unique id with online_ prefix', () => {
    const result = { title: '春江花月夜', author: '张若虚', lines: [] }
    const saved = searchResultToSavedPoem(result)
    expect(saved.id).toMatch(/^online_/)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail (module not yet updated)**

```bash
npx vitest run tests/utils/findPoemOnline.test.ts
```

Expected: several failures — `resetIndexCache is not exported`, tests that rely on new behavior fail.

---

## Task 3: Rewrite `findPoemOnline.ts`

**Files:**
- Modify: `src/utils/findPoemOnline.ts`

- [ ] **Step 1: Replace the entire file**

```typescript
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

  const results: SearchResult[] = []
  for (const entry of candidates) {
    try {
      const batch = await fetchBatch(entry.d, entry.f)
      const poem = batch.find((p) => normalize(p.title) === normalize(entry.t))
      if (!poem) continue
      results.push({
        title: entry.t,
        author: entry.a,
        dynasty: entry.d,
        lines: poem.paragraphs.map((l) => l.trim()).filter(Boolean),
      })
      if (results.length >= 5) break
    } catch {
      // Skip this result if the batch fetch fails
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
```

- [ ] **Step 2: Run tests**

```bash
npx vitest run tests/utils/findPoemOnline.test.ts
```

Expected: all tests pass.

- [ ] **Step 3: Run full test suite to check for regressions**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 4: Run lint**

```bash
npm run lint
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/utils/findPoemOnline.ts tests/utils/findPoemOnline.test.ts
git commit -m "feat: replace broken online search with GitHub index-based lookup"
```

---

## Task 4: Update `build-corpus.mjs` to generate `poem-search-index.json`

**Files:**
- Modify: `scripts/build-corpus.mjs`

The index covers: all Tang poems (all local) + Song poems up to 80k (first 40k local, remainder non-local). Non-local entries are what `findPoemOnline` will actually search.

- [ ] **Step 1: Add index building after the corpus is assembled**

Replace `scripts/build-corpus.mjs` with:

```javascript
// scripts/build-corpus.mjs
import { writeFileSync, mkdirSync, statSync } from 'fs'
import * as opencc from 'opencc-js'

const RAW_BASE = 'https://raw.githubusercontent.com/chinese-poetry/chinese-poetry/master'

async function fetchJson(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) })
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`)
  return res.json()
}

async function loadAuthorMap(url) {
  try {
    const authors = await fetchJson(url)
    const map = new Map()
    for (const a of authors) {
      if (a.name && a.desc) map.set(a.name, a.desc)
    }
    return map
  } catch (e) {
    console.warn(`Could not load authors from ${url}:`, e.message)
    return new Map()
  }
}

/**
 * Loads poems from numbered batch files. Returns { poems, indexEntries }.
 * poems: full CorpusPoem objects up to corpusMax (written to corpus.json)
 * indexEntries: compact {t,a,d,f,local?} for ALL loaded poems up to indexMax
 */
async function loadPoemFiles(urlPattern, dynasty, maxFileIndex, corpusMax, indexMax) {
  const poems = []
  const indexEntries = []

  for (let i = 0; i <= maxFileIndex; i += 1000) {
    const url = urlPattern.replace('${N}', i)
    try {
      const batch = await fetchJson(url)
      for (const p of batch) {
        if (!p.title || !p.paragraphs?.length) continue

        const title = t2s(p.title.trim())
        const author = t2s((p.author || '').trim())
        const isLocal = poems.length < corpusMax

        if (isLocal) {
          poems.push({
            id: p.id || `${dynasty}-${poems.length}`,
            title,
            author,
            dynasty,
            authorBackground: '',
            lines: p.paragraphs.map(l => l.trim()).filter(Boolean),
          })
        }

        const entry = { t: title, a: author, d: dynasty, f: i }
        if (isLocal) entry.local = true
        indexEntries.push(entry)

        if (indexEntries.length >= indexMax) break
      }
      process.stdout.write(
        `\r  ${dynasty}: ${poems.length} corpus / ${indexEntries.length} index (file ${i})...`
      )
      if (indexEntries.length >= indexMax) break
    } catch {
      break
    }
  }
  console.log()
  return { poems, indexEntries }
}

const t2s = opencc.Converter({ from: 'hk', to: 'cn' })

async function main() {
  const TANG_DIR = `${RAW_BASE}/%E5%85%A8%E5%94%90%E8%AF%97`

  console.log('Loading author metadata...')
  const [tangAuthors, songAuthors] = await Promise.all([
    loadAuthorMap(`${TANG_DIR}/authors.tang.json`),
    loadAuthorMap(`${TANG_DIR}/authors.song.json`),
  ])
  console.log(`Tang authors: ${tangAuthors.size}, Song authors: ${songAuthors.size}`)

  console.log('Loading Tang poems...')
  const tang = await loadPoemFiles(
    `${TANG_DIR}/poet.tang.\${N}.json`,
    'tang',
    57000,
    60000,  // corpusMax — all Tang go into corpus
    60000   // indexMax — same, all Tang are local
  )

  console.log('Loading Song poems...')
  const song = await loadPoemFiles(
    `${TANG_DIR}/poet.song.\${N}.json`,
    'song',
    254000,
    40000,  // corpusMax — first 40k Song go into corpus
    80000   // indexMax — next 40k Song go into index only (non-local)
  )

  const corpus = [...tang.poems, ...song.poems]
  console.log(`\nTotal corpus: ${corpus.length} poems`)

  const searchIndex = [...tang.indexEntries, ...song.indexEntries]
  console.log(`Total search index: ${searchIndex.length} entries`)

  // Build author bio map
  const authorsObj = {}
  for (const [name, bio] of songAuthors) authorsObj[name] = bio
  for (const [name, bio] of tangAuthors) authorsObj[name] = bio

  mkdirSync('public', { recursive: true })

  // Write authors.json
  const authorsJson = JSON.stringify(authorsObj)
  writeFileSync('public/authors.json', authorsJson)
  const authorsSizeMB = (Buffer.byteLength(authorsJson) / 1024 / 1024).toFixed(2)
  console.log(`Written public/authors.json (${authorsSizeMB} MB, ${Object.keys(authorsObj).length} authors)`)

  // Write corpus.json
  const corpusJson = JSON.stringify(corpus)
  writeFileSync('public/corpus.json', corpusJson)
  const corpusSizeBytes = statSync('public/corpus.json').size
  const corpusSizeMB = (corpusSizeBytes / 1024 / 1024).toFixed(2)
  const corpusSizeCompressedMB = (corpusSizeBytes * 0.33 / 1024 / 1024).toFixed(2)
  console.log(`Written public/corpus.json (${corpusSizeMB} MB uncompressed, ~${corpusSizeCompressedMB} MB gzipped)`)

  if (corpusSizeBytes > 25 * 1024 * 1024) {
    console.warn(`WARNING: corpus.json is ${corpusSizeMB}MB, may impact service worker caching`)
  }
  if (corpusSizeBytes > 40 * 1024 * 1024) {
    console.error(`ERROR: corpus.json exceeds 40MB limit — aborting`)
    process.exit(1)
  }

  // Write poem-search-index.json
  const indexJson = JSON.stringify(searchIndex)
  writeFileSync('public/poem-search-index.json', indexJson)
  const indexSizeBytes = Buffer.byteLength(indexJson)
  const indexSizeMB = (indexSizeBytes / 1024 / 1024).toFixed(2)
  const indexSizeCompressedMB = (indexSizeBytes * 0.25 / 1024 / 1024).toFixed(2)
  console.log(`Written public/poem-search-index.json (${indexSizeMB} MB uncompressed, ~${indexSizeCompressedMB} MB gzipped)`)

  if (indexSizeBytes > 5 * 1024 * 1024) {
    console.warn(`WARNING: poem-search-index.json is ${indexSizeMB}MB`)
  }
  if (indexSizeBytes > 10 * 1024 * 1024) {
    console.error(`ERROR: poem-search-index.json exceeds 10MB limit — aborting`)
    process.exit(1)
  }
}

main().catch(e => { console.error(e); process.exit(1) })
```

- [ ] **Step 2: Add `poem-search-index.json` to Workbox cache config in `vite.config.ts`**

Read `vite.config.ts` first to find the `maximumFileSizeToCacheInBytes` setting, then add `poem-search-index.json` to the list of cached assets if it isn't already covered by a glob pattern. It should use the same 40 MB limit. Verify the existing glob patterns — if they already cover `public/**/*.json`, no change is needed.

```bash
grep -n "maximumFileSizeToCacheInBytes\|poem-search\|corpus" vite.config.ts
```

If `poem-search-index.json` is not covered by existing patterns, add it:

```typescript
// In the workbox config, under runtimeCaching or additionalManifestEntries:
{ url: '/poem-search-index.json', revision: null }
```

- [ ] **Step 3: Verify the build script runs without errors on a dry run**

The script fetches from GitHub — skip full run in CI, but verify it at least starts and exits cleanly on a network-available machine:

```bash
node scripts/build-corpus.mjs 2>&1 | head -20
```

Expected: prints author counts and starts loading Tang poems without errors.

- [ ] **Step 4: Run full test suite to confirm nothing broken**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add scripts/build-corpus.mjs vite.config.ts
git commit -m "feat: generate poem-search-index.json in build script for online search"
```

---

## Self-Review Checklist

- [x] **Spec coverage:** poemWebSearch fix ✓ | index build ✓ | runtime search with caching ✓ | local filtering ✓ | dynasty from index ✓ | error handling (index fail throws, batch fail skips) ✓ | tests ✓
- [x] **No placeholders:** all steps have complete code
- [x] **Type consistency:** `SearchResult.dynasty?: 'tang' | 'song'` defined in Task 3 step 1, used in `searchResultToSavedPoem` in same file, tested in Task 2; `IndexEntry` and `BatchPoem` defined in Task 3; `resetIndexCache` exported in Task 3 and imported in Task 2
- [x] **`resetIndexCache`** exported from `findPoemOnline.ts` (Task 3) and imported in tests (Task 2) — consistent
- [x] **vite.config.ts step:** flagged as conditional (check first, only add if not covered) ✓

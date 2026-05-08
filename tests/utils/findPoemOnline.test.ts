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

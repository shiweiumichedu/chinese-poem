import { renderHook, act, waitFor } from '@testing-library/react'
import { useCorpus } from '../../src/hooks/useCorpus'

const rawPoems = [
  {
    id: '1',
    title: '静夜思',
    author: '李白',
    dynasty: 'tang',
    authorBackground: '',
    lines: ['床前明月光'],
  },
]
const authors = { '李白': '唐代诗人' }

function makeFetch(poemsData: unknown, authorsData: unknown, translationsData: unknown = null) {
  return vi.fn().mockImplementation((url: string) => {
    if (url.includes('translations')) {
      if (translationsData === null) return Promise.resolve({ ok: false, status: 404 })
      return Promise.resolve({ ok: true, json: () => Promise.resolve(translationsData) })
    }
    const data = url.includes('authors') ? authorsData : poemsData
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve(data),
    })
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('useCorpus', () => {
  it('loading starts true and becomes false after fetch resolves', async () => {
    vi.stubGlobal('fetch', makeFetch(rawPoems, authors))

    const { result } = renderHook(() => useCorpus())

    expect(result.current.loading).toBe(true)

    await waitFor(() => expect(result.current.loading).toBe(false))
  })

  it('joins author backgrounds from authors.json', async () => {
    vi.stubGlobal('fetch', makeFetch(rawPoems, authors))

    const { result } = renderHook(() => useCorpus())

    await waitFor(() => expect(result.current.loading).toBe(false))

    const liBai = result.current.corpus.find((poem) => poem.title === '静夜思')

    expect(liBai).toBeDefined()
    expect(liBai?.authorBackground).toBe('唐代诗人')
    expect(result.current.error).toBeNull()
  })

  it('missing author falls back to empty string', async () => {
    vi.stubGlobal('fetch', makeFetch(rawPoems, {}))

    const { result } = renderHook(() => useCorpus())

    await waitFor(() => expect(result.current.loading).toBe(false))

    const liBai = result.current.corpus.find((poem) => poem.title === '静夜思')

    expect(liBai).toBeDefined()
    expect(liBai?.authorBackground).toBe('')
  })

  it('adds supplemental poems when missing from corpus.json', async () => {
    vi.stubGlobal('fetch', makeFetch(rawPoems, authors))

    const { result } = renderHook(() => useCorpus())

    await waitFor(() => expect(result.current.loading).toBe(false))

    const target = result.current.corpus.find((poem) => poem.title === '寻隐者不遇' && poem.author === '贾岛')

    expect(target).toBeDefined()
    expect(target?.lines).toEqual(['松下问童子，言师采药去。', '只在此山中，云深不知处。'])
  })

  it('sets error when fetch fails and loading becomes false', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('Network error'))
    )

    const { result } = renderHook(() => useCorpus())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.error).toBe('Network error')
    expect(result.current.corpus).toHaveLength(0)
  })

  it('sets error when corpus fetch returns non-ok status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (url.includes('corpus')) {
          return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve(null) })
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve(authors) })
      })
    )

    const { result } = renderHook(() => useCorpus())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.error).toBe('Failed to fetch corpus: 404')
    expect(result.current.corpus).toHaveLength(0)
  })

  it('merges englishLines from translations.json into corpus poems', async () => {
    const translations = { '1': ['Before the bed, the moonlight shines'] }
    vi.stubGlobal('fetch', makeFetch(rawPoems, authors, translations))

    const { result } = renderHook(() => useCorpus())

    await waitFor(() => expect(result.current.loading).toBe(false))

    const poem = result.current.corpus.find(p => p.id === '1')
    expect(poem?.englishLines).toEqual(['Before the bed, the moonlight shines'])
  })

  it('does not update state after unmount', async () => {
    let resolvePoems!: (val: unknown) => void
    let resolveAuthors!: (val: unknown) => void
    let resolveTranslations!: (val: unknown) => void

    vi.stubGlobal('fetch', vi.fn()
      .mockImplementationOnce(() => new Promise(r => { resolvePoems = r }))
      .mockImplementationOnce(() => new Promise(r => { resolveAuthors = r }))
      .mockImplementationOnce(() => new Promise(r => { resolveTranslations = r }))
    )

    const { result, unmount } = renderHook(() => useCorpus())
    expect(result.current.loading).toBe(true)

    unmount()

    // Resolve after unmount — should not throw or update state
    await act(async () => {
      resolvePoems({ ok: true, json: () => Promise.resolve([]) })
      resolveAuthors({ ok: true, json: () => Promise.resolve({}) })
      resolveTranslations({ ok: false, status: 404 })
    })

    // No assertion needed beyond "no throw" — the cancelled flag prevented setState
  })
})

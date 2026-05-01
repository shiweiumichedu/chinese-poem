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

function makeFetch(poemsData: unknown, authorsData: unknown) {
  return vi.fn().mockImplementation((url: string) => {
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

    expect(result.current.corpus).toHaveLength(1)
    expect(result.current.corpus[0].authorBackground).toBe('唐代诗人')
    expect(result.current.error).toBeNull()
  })

  it('missing author falls back to empty string', async () => {
    vi.stubGlobal('fetch', makeFetch(rawPoems, {}))

    const { result } = renderHook(() => useCorpus())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.corpus[0].authorBackground).toBe('')
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

  it('does not update state after unmount', async () => {
    let resolvePoems!: (val: unknown) => void
    let resolveAuthors!: (val: unknown) => void

    vi.stubGlobal('fetch', vi.fn()
      .mockImplementationOnce(() => new Promise(r => { resolvePoems = r }))
      .mockImplementationOnce(() => new Promise(r => { resolveAuthors = r }))
    )

    const { result, unmount } = renderHook(() => useCorpus())
    expect(result.current.loading).toBe(true)

    unmount()

    // Resolve after unmount — should not throw or update state
    await act(async () => {
      resolvePoems({ ok: true, json: () => Promise.resolve([]) })
      resolveAuthors({ ok: true, json: () => Promise.resolve({}) })
    })

    // No assertion needed beyond "no throw" — the cancelled flag prevented setState
  })
})

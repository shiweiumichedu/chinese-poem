import { getMissingSeeds } from '../../src/data/seedPoems'
import type { SavedPoem } from '../../src/types'

const make = (title: string, author: string, addedAt = Date.now()): SavedPoem => ({
  id: `${title}-${author}`,
  title, author,
  dynasty: 'song', authorBackground: '', lines: [], addedAt,
})

const shiEr = make('示儿', '陆游')
const jingYeSi = make('静夜思', '李白')

describe('getMissingSeeds', () => {
  it('returns all seeds when library is empty', () => {
    expect(getMissingSeeds([], [shiEr])).toEqual([shiEr])
  })

  it('returns empty when seed is already in library with a real timestamp', () => {
    expect(getMissingSeeds([shiEr], [shiEr])).toEqual([])
  })

  it('returns only seeds not present in library', () => {
    expect(getMissingSeeds([jingYeSi], [shiEr, jingYeSi])).toEqual([shiEr])
  })

  it('returns empty when no seeds provided', () => {
    expect(getMissingSeeds([jingYeSi], [])).toEqual([])
  })

  it('re-seeds a poem that was saved with a stale placeholder timestamp (addedAt < 10000)', () => {
    const stale = make('示儿', '陆游', 2)
    expect(getMissingSeeds([stale], [shiEr])).toEqual([shiEr])
  })
})

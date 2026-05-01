import { IDBFactory } from 'fake-indexeddb'
import { savePoem, listPoems, findByTitle, removePoem, resetDBCache } from '../../src/data/PoemLibrary'
import type { SavedPoem } from '../../src/types'

const makePoem = (id: string, title: string, addedAt = Date.now()): SavedPoem => ({
  id,
  title,
  author: '李白',
  dynasty: 'tang',
  authorBackground: '',
  lines: ['床前明月光', '疑是地上霜'],
  addedAt,
})

describe('PoemLibrary', () => {
  beforeEach(() => {
    globalThis.indexedDB = new IDBFactory()
    resetDBCache()
  })
  it('adds and lists a poem', async () => {
    const poem = makePoem('test-1', '静夜思', 1000)
    await savePoem(poem)
    const list = await listPoems()
    expect(list.some(p => p.id === 'test-1')).toBe(true)
  })

  it('lists poems sorted by addedAt descending', async () => {
    await savePoem(makePoem('sort-1', '春晓', 1000))
    await savePoem(makePoem('sort-2', '登鹳雀楼', 2000))
    const list = await listPoems()
    expect(list.length).toBe(2)
    const ids = list.map(p => p.id)
    expect(ids[0]).toBe('sort-2')  // higher addedAt comes first
    expect(ids[1]).toBe('sort-1')
  })

  it('finds a poem by exact title', async () => {
    await savePoem(makePoem('find-1', '望庐山瀑布', 1000))
    const found = await findByTitle('望庐山瀑布')
    expect(found?.id).toBe('find-1')
  })

  it('returns undefined for unknown title', async () => {
    const found = await findByTitle('不存在')
    expect(found).toBeUndefined()
  })

  it('removes a poem by id', async () => {
    await savePoem(makePoem('remove-1', '枫桥夜泊', 1000))
    await removePoem('remove-1')
    const list = await listPoems()
    expect(list.some(p => p.id === 'remove-1')).toBe(false)
  })

  it('put overwrites poem with same id', async () => {
    const original = makePoem('upsert-1', '原标题', 1000)
    await savePoem(original)
    const updated = { ...original, title: '新标题' }
    await savePoem(updated)
    const found = await findByTitle('新标题')
    expect(found?.id).toBe('upsert-1')
    const old = await findByTitle('原标题')
    expect(old).toBeUndefined()
  })
})

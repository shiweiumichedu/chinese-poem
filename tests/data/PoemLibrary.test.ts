import { addPoem, listPoems, findByTitle, removePoem } from '../../src/data/PoemLibrary'
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
  it('adds and lists a poem', async () => {
    const poem = makePoem('test-1', '静夜思', 1000)
    await addPoem(poem)
    const list = await listPoems()
    expect(list.some(p => p.id === 'test-1')).toBe(true)
  })

  it('lists poems sorted by addedAt descending', async () => {
    await addPoem(makePoem('sort-1', '春晓', 1000))
    await addPoem(makePoem('sort-2', '登鹳雀楼', 2000))
    const list = await listPoems()
    const sortedIds = list.map(p => p.id)
    const i1 = sortedIds.indexOf('sort-1')
    const i2 = sortedIds.indexOf('sort-2')
    expect(i2).toBeLessThan(i1)
  })

  it('finds a poem by exact title', async () => {
    await addPoem(makePoem('find-1', '望庐山瀑布', 1000))
    const found = await findByTitle('望庐山瀑布')
    expect(found?.id).toBe('find-1')
  })

  it('returns undefined for unknown title', async () => {
    const found = await findByTitle('不存在')
    expect(found).toBeUndefined()
  })

  it('removes a poem by id', async () => {
    await addPoem(makePoem('remove-1', '枫桥夜泊', 1000))
    await removePoem('remove-1')
    const list = await listPoems()
    expect(list.some(p => p.id === 'remove-1')).toBe(false)
  })

  it('put overwrites poem with same id', async () => {
    const original = makePoem('upsert-1', '原标题', 1000)
    await addPoem(original)
    const updated = { ...original, title: '新标题' }
    await addPoem(updated)
    const found = await findByTitle('新标题')
    expect(found?.id).toBe('upsert-1')
    const old = await findByTitle('原标题')
    expect(old).toBeUndefined()
  })
})

import { searchPoems } from '../../src/data/PoemSearch'
import type { CorpusPoem } from '../../src/types'

const makePoem = (id: string, title: string, author = '测试'): CorpusPoem => ({
  id,
  title,
  author,
  dynasty: 'tang',
  authorBackground: '',
  lines: ['测试诗句'],
})

const corpus: CorpusPoem[] = [
  makePoem('1', '静夜思'),
  makePoem('2', '春晓'),
  makePoem('3', '登鹳雀楼'),
  makePoem('4', '望庐山瀑布'),
  makePoem('5', '静夜思二'),  // another with similar title
]

describe('searchPoems', () => {
  it('returns exact match first', () => {
    const results = searchPoems(corpus, '静夜思')
    expect(results[0].id).toBe('1')
  })

  it('returns substring matches after exact', () => {
    const results = searchPoems(corpus, '静夜思')
    expect(results.map(r => r.id)).toContain('5')
    // id '1' (exact) comes before id '5' (substring)
    expect(results.indexOf(results.find(r => r.id === '1')!))
      .toBeLessThan(results.indexOf(results.find(r => r.id === '5')!))
  })

  it('normalizes whitespace in query', () => {
    const results = searchPoems(corpus, '静 夜 思')
    expect(results[0].id).toBe('1')
  })

  it('normalizes punctuation in query', () => {
    const results = searchPoems(corpus, '《静夜思》')
    expect(results[0].id).toBe('1')
  })

  it('returns empty array for empty query', () => {
    expect(searchPoems(corpus, '')).toEqual([])
    expect(searchPoems(corpus, '  ')).toEqual([])
  })

  it('returns empty array when no match', () => {
    expect(searchPoems(corpus, '不存在的诗')).toEqual([])
  })

  it('does not duplicate exact match in results', () => {
    const results = searchPoems(corpus, '静夜思')
    const ids = results.map(r => r.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('partial title match works', () => {
    const results = searchPoems(corpus, '庐山')
    expect(results[0].id).toBe('4')
  })

  it('normalizes curly Unicode quotes in title', () => {
    const c = [makePoem('q', '靈隐寺“')]  // 靈隐寺“ uses U+201C left curly quote
    expect(searchPoems(c, '靈隐寺')[0].id).toBe('q')
  })

  it('strips bracket annotations in corpus titles', () => {
    const c = [makePoem('b', '奉和麟德殿宴百僚應[制]')]
    expect(searchPoems(c, '奉和麟德殿宴百僚應制')[0].id).toBe('b')
  })

  it('matches simplified query to traditional title', () => {
    const c = [
      {
        ...makePoem('t1', '黃鶴樓送孟浩然之廣陵'),
        lines: ['故人西辭黃鶴樓，煙花三月下揚州。'],
      },
    ]
    expect(searchPoems(c, '黄鹤楼送孟浩然之广陵')[0].id).toBe('t1')
  })

  it('matches traditional query to simplified line', () => {
    const c = [
      {
        ...makePoem('s1', '黄鹤楼送孟浩然之广陵'),
        lines: ['故人西辞黄鹤楼，烟花三月下扬州。'],
      },
    ]
    expect(searchPoems(c, '故人西辭黃鶴樓')[0].id).toBe('s1')
  })
})

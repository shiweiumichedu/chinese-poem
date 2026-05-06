import { buildTtsLine } from '../../src/utils/charAnnotation'
import type { CharAnnotation } from '../../src/types'

describe('buildTtsLine', () => {
  it('returns original line when no annotations', () => {
    expect(buildTtsLine('千里江陵一日还', 0, [])).toBe('千里江陵一日还')
  })

  it('substitutes annotated character at correct position', () => {
    const ann: CharAnnotation[] = [{ lineIndex: 0, charIndex: 6, pinyin: 'huán', substitute: '环' }]
    expect(buildTtsLine('千里江陵一日还', 0, ann)).toBe('千里江陵一日环')
  })

  it('applies multiple substitutions in same line', () => {
    const ann: CharAnnotation[] = [
      { lineIndex: 0, charIndex: 0, pinyin: 'zhǎng', substitute: '张' },
      { lineIndex: 0, charIndex: 5, pinyin: 'jiàng', substitute: '降' },
    ]
    expect(buildTtsLine('长亭外古道边', 0, ann)).toBe('张亭外古道降')
  })

  it('ignores annotations for other lines', () => {
    const ann: CharAnnotation[] = [{ lineIndex: 1, charIndex: 0, pinyin: 'x', substitute: 'X' }]
    expect(buildTtsLine('千里江陵一日还', 0, ann)).toBe('千里江陵一日还')
  })

  it('falls back to original char when substitute is empty string', () => {
    const ann: CharAnnotation[] = [{ lineIndex: 0, charIndex: 6, pinyin: 'huán', substitute: '' }]
    expect(buildTtsLine('千里江陵一日还', 0, ann)).toBe('千里江陵一日还')
  })
})

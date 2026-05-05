import { buildDisplayLines } from '../../src/utils/poemLineDisplay'

describe('buildDisplayLines', () => {
  it('sets sourceCharOffset to 0 for unsplit 5-char lines', () => {
    const lines = ['床前明月光', '疑是地上霜']
    const result = buildDisplayLines(lines)
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({ text: '床前明月光', sourceLineIndex: 0, sourceCharOffset: 0 })
    expect(result[1]).toEqual({ text: '疑是地上霜', sourceLineIndex: 1, sourceCharOffset: 0 })
  })

  it('sets correct sourceCharOffset for split clauses', () => {
    // 7-char line with punctuation splits into two clauses
    const lines = ['烽火连三月，家书抵万金']
    const result = buildDisplayLines(lines)
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({ text: '烽火连三月，', sourceLineIndex: 0, sourceCharOffset: 0 })
    expect(result[1]).toEqual({ text: '家书抵万金', sourceLineIndex: 0, sourceCharOffset: 6 })
  })

  it('sets sourceCharOffset to 0 for unsplit long prose lines', () => {
    const lines = ['余幼时即嗜学']
    const result = buildDisplayLines(lines)
    expect(result).toHaveLength(1)
    expect(result[0].sourceCharOffset).toBe(0)
  })
})

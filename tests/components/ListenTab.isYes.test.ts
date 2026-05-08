import { describe, it, expect } from 'vitest'
import { isYes } from '../../src/utils/reciteMatch'

describe('isYes', () => {
  it('returns true for 是', () => expect(isYes('是')).toBe(true))
  it('returns true for 要', () => expect(isYes('要')).toBe(true))
  it('returns true for 降', () => expect(isYes('降')).toBe(true))
  it('returns true for 对', () => expect(isYes('对')).toBe(true))
  it('returns false for 不要', () => expect(isYes('不要')).toBe(false))
  it('returns false for 不', () => expect(isYes('不')).toBe(false))
  it('returns false for empty string', () => expect(isYes('')).toBe(false))
  it('returns false for unrelated text', () => expect(isYes('下一首')).toBe(false))
  it('returns false for 好的', () => expect(isYes('好的')).toBe(false))
  it('returns true for 对对', () => expect(isYes('对对')).toBe(true))
})

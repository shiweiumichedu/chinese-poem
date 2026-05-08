import { isReciteMatch } from '../../src/utils/reciteMatch'

describe('isReciteMatch - 翘舌 normalization', () => {
  it('accepts zh→z confusion: 知 (zhi) matched as 子 (zi)', () =>
    expect(isReciteMatch('子', '知')).toBe(true))

  it('accepts ch→c confusion: 吃 (chi) matched as 此 (ci)', () =>
    expect(isReciteMatch('此', '吃')).toBe(true))

  it('accepts sh→s confusion: 是 (shi) matched as 思 (si)', () =>
    expect(isReciteMatch('思', '是')).toBe(true))

  it('accepts r→y confusion: 日 (ri) matched as 依 (yi)', () =>
    expect(isReciteMatch('依', '日')).toBe(true))
})

describe('isReciteMatch - 鼻音 normalization', () => {
  it('accepts n→ng confusion: 金 (jin) matched as 经 (jing)', () =>
    expect(isReciteMatch('经', '金')).toBe(true))

  it('accepts ng→n confusion: 经 (jing) matched as 金 (jin)', () =>
    expect(isReciteMatch('金', '经')).toBe(true))

  it('accepts an→ang confusion: 山 (shan) matched as 上 (shang)', () =>
    expect(isReciteMatch('上', '山')).toBe(true))

  it('accepts en→eng confusion: 深 (shen) matched as 生 (sheng)', () =>
    expect(isReciteMatch('生', '深')).toBe(true))
})

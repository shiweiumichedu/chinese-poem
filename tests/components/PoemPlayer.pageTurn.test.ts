import { computePageTurnScroll } from '../../src/utils/poemPlayerScroll'

type Rect = { top: number; bottom: number; height: number }
const r = (top: number, bottom: number): Rect => ({ top, bottom, height: bottom - top })

// Container: 600px tall viewport at y=0
const container: Rect = r(0, 600)

describe('computePageTurnScroll', () => {
  it('returns null when highlighted line is in the upper portion of screen', () => {
    // bottom at 135, threshold = 600*0.35 = 210, trigger zone starts at 390
    expect(computePageTurnScroll(r(100, 135), container, false, 0)).toBeNull()
  })

  it('returns new scrollTop when highlighted line enters the bottom 35% zone', () => {
    // bottom at 430 > 600-210=390 → page turn
    // newScrollTop = 0 + (400 - 0) - 20 = 380
    expect(computePageTurnScroll(r(400, 430), container, false, 0)).toBe(380)
  })

  it('accounts for current scroll position', () => {
    // currentScrollTop=200, highlighted.top=400 → 200 + (400-0) - 20 = 580
    expect(computePageTurnScroll(r(400, 430), container, false, 200)).toBe(580)
  })

  it('returns null when controls are visible (end of poem — stop turning)', () => {
    expect(computePageTurnScroll(r(400, 430), container, true, 0)).toBeNull()
  })

  it('returns null when highlighted line is exactly at the threshold boundary', () => {
    // bottom exactly at 390 (600-210) → not past threshold → no turn
    expect(computePageTurnScroll(r(355, 390), container, false, 0)).toBeNull()
  })

  it('returns new scrollTop when highlighted line is one pixel past threshold', () => {
    expect(computePageTurnScroll(r(356, 391), container, false, 0)).toBe(336)
  })
})

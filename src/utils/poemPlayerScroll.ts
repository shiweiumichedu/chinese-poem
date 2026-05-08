type Rect = { top: number; bottom: number; height: number }

export function computePageTurnScroll(
  highlightedRect: Rect,
  containerRect: Rect,
  controlsVisible: boolean,
  currentScrollTop: number,
): number | null {
  if (controlsVisible) return null
  const threshold = containerRect.height * 0.35
  if (highlightedRect.bottom > containerRect.bottom - threshold) {
    return currentScrollTop + (highlightedRect.top - containerRect.top) - 20
  }
  return null
}

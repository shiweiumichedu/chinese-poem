export function openPoemWebSearch(rawQuery: string) {
  const query = rawQuery.trim()
  if (!query) return

  const url = `https://so.gushiwen.cn/search.aspx?value=${encodeURIComponent(query)}`
  const popup = window.open(url, '_blank', 'noopener,noreferrer')

  // Fallback if popup is blocked.
  if (!popup) {
    window.location.href = url
  }
}

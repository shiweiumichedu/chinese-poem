export function openPoemWebSearch(rawQuery: string) {
  const query = rawQuery.trim()
  if (!query) return

  const url = `https://so.gushiwen.cn/search.aspx?value=${encodeURIComponent(query)}`
  window.open(url, '_blank', 'noopener,noreferrer')
}

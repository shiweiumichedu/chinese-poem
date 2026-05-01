// scripts/build-corpus.mjs
import { writeFileSync, mkdirSync } from 'fs'

const RAW_BASE = 'https://raw.githubusercontent.com/chinese-poetry/chinese-poetry/master'

async function fetchJson(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`)
  return res.json()
}

async function loadAuthorMap(url) {
  try {
    const authors = await fetchJson(url)
    const map = new Map()
    for (const a of authors) {
      if (a.name && a.desc) map.set(a.name, a.desc)
    }
    return map
  } catch (e) {
    console.warn(`Could not load authors from ${url}:`, e.message)
    return new Map()
  }
}

async function loadPoemFiles(urlPattern, dynasty, authorMap, maxFiles) {
  const poems = []
  for (let i = 0; i <= maxFiles; i += 1000) {
    const url = urlPattern.replace('${N}', i)
    try {
      const batch = await fetchJson(url)
      for (const p of batch) {
        if (!p.title || !p.paragraphs?.length) continue
        poems.push({
          id: p.id || `${dynasty}-${poems.length}`,
          title: p.title.trim(),
          author: (p.author || '').trim(),
          dynasty,
          authorBackground: authorMap.get(p.author) || '',
          lines: p.paragraphs.map(l => l.trim()).filter(Boolean),
        })
      }
      process.stdout.write(`\r  ${dynasty}: ${poems.length} poems loaded (file ${i})...`)
    } catch {
      // File doesn't exist — we've gone past the last file
      break
    }
  }
  console.log()
  return poems
}

async function main() {
  // Authors live in 全唐诗/ (URL-encoded as %E5%85%A8%E5%94%90%E8%AF%97)
  const TANG_DIR = `${RAW_BASE}/%E5%85%A8%E5%94%90%E8%AF%97`

  console.log('Loading author metadata...')
  const [tangAuthors, songAuthors] = await Promise.all([
    loadAuthorMap(`${TANG_DIR}/authors.tang.json`),
    loadAuthorMap(`${TANG_DIR}/authors.song.json`),
  ])
  console.log(`Tang authors: ${tangAuthors.size}, Song authors: ${songAuthors.size}`)

  console.log('Loading Tang poems...')
  const tangPoems = await loadPoemFiles(
    `${TANG_DIR}/poet.tang.\${N}.json`,
    'tang',
    tangAuthors,
    57000
  )

  // Song shi (诗) poems are in 全唐诗/error/ subdirectory
  console.log('Loading Song poems...')
  const songPoems = await loadPoemFiles(
    `${TANG_DIR}/error/poet.song.\${N}.json`,
    'song',
    songAuthors,
    254000
  )

  const corpus = [...tangPoems, ...songPoems]
  console.log(`\nTotal corpus: ${corpus.length} poems`)

  mkdirSync('public', { recursive: true })
  writeFileSync('public/corpus.json', JSON.stringify(corpus))
  const sizeMB = (Buffer.byteLength(JSON.stringify(corpus)) / 1024 / 1024).toFixed(1)
  console.log(`Written to public/corpus.json (${sizeMB} MB)`)
}

main().catch(e => { console.error(e); process.exit(1) })

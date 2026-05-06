// scripts/build-corpus.mjs
import { writeFileSync, mkdirSync, statSync } from 'fs'
import * as opencc from 'opencc-js'

const RAW_BASE = 'https://raw.githubusercontent.com/chinese-poetry/chinese-poetry/master'

async function fetchJson(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) })
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

async function loadPoemFiles(urlPattern, dynasty, maxFileIndex, maxPoems) {
  const poems = []
  for (let i = 0; i <= maxFileIndex; i += 1000) {
    const url = urlPattern.replace('${N}', i)
    try {
      const batch = await fetchJson(url)
      for (const p of batch) {
        if (!p.title || !p.paragraphs?.length) continue
        poems.push({
          id: p.id || `${dynasty}-${poems.length}`,
          title: t2s(p.title.trim()),
          author: t2s((p.author || '').trim()),
          dynasty,
          authorBackground: '',
          lines: p.paragraphs.map(l => l.trim()).filter(Boolean),
        })
        if (maxPoems && poems.length >= maxPoems) break
      }
      process.stdout.write(`\r  ${dynasty}: ${poems.length} poems loaded (file ${i})...`)
      if (maxPoems && poems.length >= maxPoems) break
    } catch {
      // File doesn't exist — we've gone past the last file
      break
    }
  }
  console.log()
  return poems
}

const t2s = opencc.Converter({ from: 'hk', to: 'cn' })

async function main() {
  // Both Tang and Song poems (诗) live in 全唐诗/ (URL-encoded as %E5%85%A8%E5%94%90%E8%AF%97)
  // Song shi (poet.song.*.json) are in the SAME directory as Tang poems — NOT in a subdirectory
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
    57000,
    60000
  )

  // Song shi (诗) poems are in the same 全唐诗/ directory as Tang poems
  console.log('Loading Song poems...')
  const songPoems = await loadPoemFiles(
    `${TANG_DIR}/poet.song.\${N}.json`,
    'song',
    254000,
    40000
  )

  const corpus = [...tangPoems, ...songPoems]
  console.log(`\nTotal corpus: ${corpus.length} poems`)

  // Build author bio map: merged Tang + Song (Tang takes precedence on name collision)
  const authorsObj = {}
  for (const [name, bio] of songAuthors) {
    authorsObj[name] = bio
  }
  for (const [name, bio] of tangAuthors) {
    authorsObj[name] = bio
  }

  mkdirSync('public', { recursive: true })

  // Write authors.json (bios only, keyed by author name)
  const authorsJson = JSON.stringify(authorsObj)
  writeFileSync('public/authors.json', authorsJson)
  const authorsSizeMB = (Buffer.byteLength(authorsJson) / 1024 / 1024).toFixed(2)
  console.log(`Written to public/authors.json (${authorsSizeMB} MB, ${Object.keys(authorsObj).length} authors)`)

  // Write corpus.json (poems with authorBackground: "" — bios loaded separately at runtime)
  const corpusJson = JSON.stringify(corpus)
  writeFileSync('public/corpus.json', corpusJson)

  const corpusSizeBytes = statSync('public/corpus.json').size
  const corpusSizeMB = (corpusSizeBytes / 1024 / 1024).toFixed(2)
  const corpusSizeCompressedMB = (corpusSizeBytes * 0.33 / 1024 / 1024).toFixed(2) // ~33% after gzip
  console.log(`Written to public/corpus.json (${corpusSizeMB} MB uncompressed, ~${corpusSizeCompressedMB} MB gzipped)`)

  if (corpusSizeBytes > 25 * 1024 * 1024) {
    console.warn(`WARNING: corpus.json is ${corpusSizeMB}MB, may impact service worker caching`)
  }
  if (corpusSizeBytes > 40 * 1024 * 1024) {
    console.error(`ERROR: corpus.json is ${corpusSizeMB}MB, exceeds 40MB limit — aborting`)
    process.exit(1)
  }
}

main().catch(e => { console.error(e); process.exit(1) })

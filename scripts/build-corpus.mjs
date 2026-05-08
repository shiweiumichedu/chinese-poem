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

/**
 * Loads poems from numbered batch files.
 * Returns { poems, indexEntries }:
 *   poems        — full CorpusPoem objects for the first corpusMax poems (written to corpus.json)
 *   indexEntries — compact {t,a,d,f,local?} for ALL loaded poems up to indexMax
 */
async function loadPoemFiles(urlPattern, dynasty, maxFileIndex, corpusMax, indexMax) {
  const poems = []
  const indexEntries = []

  for (let i = 0; i <= maxFileIndex; i += 1000) {
    const url = urlPattern.replace('${N}', i)
    try {
      const batch = await fetchJson(url)
      for (const p of batch) {
        if (!p.title || !p.paragraphs?.length) continue

        const title = t2s(p.title.trim())
        const author = t2s((p.author || '').trim())
        const isLocal = poems.length < corpusMax

        if (isLocal) {
          poems.push({
            id: p.id || `${dynasty}-${poems.length}`,
            title,
            author,
            dynasty,
            authorBackground: '',
            lines: p.paragraphs.map(l => l.trim()).filter(Boolean),
          })
        }

        const entry = { t: title, a: author, d: dynasty, f: i }
        if (isLocal) entry.local = true
        indexEntries.push(entry)

        if (indexEntries.length >= indexMax) break
      }
      process.stdout.write(
        `\r  ${dynasty}: ${poems.length} corpus / ${indexEntries.length} index (file ${i})...`
      )
      if (indexEntries.length >= indexMax) break
    } catch {
      break
    }
  }
  console.log()
  return { poems, indexEntries }
}

const t2s = opencc.Converter({ from: 'hk', to: 'cn' })

async function main() {
  const TANG_DIR = `${RAW_BASE}/%E5%85%A8%E5%94%90%E8%AF%97`

  console.log('Loading author metadata...')
  const [tangAuthors, songAuthors] = await Promise.all([
    loadAuthorMap(`${TANG_DIR}/authors.tang.json`),
    loadAuthorMap(`${TANG_DIR}/authors.song.json`),
  ])
  console.log(`Tang authors: ${tangAuthors.size}, Song authors: ${songAuthors.size}`)

  console.log('Loading Tang poems...')
  const tang = await loadPoemFiles(
    `${TANG_DIR}/poet.tang.\${N}.json`,
    'tang',
    57000,
    60000,  // corpusMax — all Tang go into corpus
    60000   // indexMax — all Tang are local
  )

  console.log('Loading Song poems...')
  const song = await loadPoemFiles(
    `${TANG_DIR}/poet.song.\${N}.json`,
    'song',
    254000,
    40000,  // corpusMax — first 40k Song go into corpus
    80000   // indexMax — next 40k Song go into index only (non-local)
  )

  const corpus = [...tang.poems, ...song.poems]
  console.log(`\nTotal corpus: ${corpus.length} poems`)

  const searchIndex = [...tang.indexEntries, ...song.indexEntries]
  console.log(`Total search index: ${searchIndex.length} entries`)

  const authorsObj = {}
  for (const [name, bio] of songAuthors) authorsObj[name] = bio
  for (const [name, bio] of tangAuthors) authorsObj[name] = bio

  mkdirSync('public', { recursive: true })

  const authorsJson = JSON.stringify(authorsObj)
  writeFileSync('public/authors.json', authorsJson)
  const authorsSizeMB = (Buffer.byteLength(authorsJson) / 1024 / 1024).toFixed(2)
  console.log(`Written public/authors.json (${authorsSizeMB} MB, ${Object.keys(authorsObj).length} authors)`)

  const corpusJson = JSON.stringify(corpus)
  writeFileSync('public/corpus.json', corpusJson)
  const corpusSizeBytes = statSync('public/corpus.json').size
  const corpusSizeMB = (corpusSizeBytes / 1024 / 1024).toFixed(2)
  const corpusSizeCompressedMB = (corpusSizeBytes * 0.33 / 1024 / 1024).toFixed(2)
  console.log(`Written public/corpus.json (${corpusSizeMB} MB uncompressed, ~${corpusSizeCompressedMB} MB gzipped)`)

  if (corpusSizeBytes > 25 * 1024 * 1024) {
    console.warn(`WARNING: corpus.json is ${corpusSizeMB}MB, may impact service worker caching`)
  }
  if (corpusSizeBytes > 40 * 1024 * 1024) {
    console.error(`ERROR: corpus.json exceeds 40MB limit — aborting`)
    process.exit(1)
  }

  const indexJson = JSON.stringify(searchIndex)
  writeFileSync('public/poem-search-index.json', indexJson)
  const indexSizeBytes = Buffer.byteLength(indexJson)
  const indexSizeMB = (indexSizeBytes / 1024 / 1024).toFixed(2)
  const indexSizeCompressedMB = (indexSizeBytes * 0.25 / 1024 / 1024).toFixed(2)
  console.log(`Written public/poem-search-index.json (${indexSizeMB} MB uncompressed, ~${indexSizeCompressedMB} MB gzipped)`)

  if (indexSizeBytes > 5 * 1024 * 1024) {
    console.warn(`WARNING: poem-search-index.json is ${indexSizeMB}MB`)
  }
  if (indexSizeBytes > 10 * 1024 * 1024) {
    console.error(`ERROR: poem-search-index.json exceeds 10MB limit — aborting`)
    process.exit(1)
  }
}

main().catch(e => { console.error(e); process.exit(1) })

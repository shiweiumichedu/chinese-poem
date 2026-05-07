#!/usr/bin/env node
// Usage: npm run translate:corpus [-- --limit 1000 --start 0]
// Translates poems from public/corpus.json via `claude -p`,
// writing results incrementally to public/translations.json
// as { [id]: string[] }. Re-runnable — skips already-translated ids.

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { spawnSync } from 'child_process'

const args = process.argv.slice(2)
function getArg(name, defaultVal) {
  const idx = args.indexOf(name)
  return idx !== -1 ? Number(args[idx + 1]) : defaultVal
}
const LIMIT = getArg('--limit', 1000)
const START = getArg('--start', 0)
const BATCH_SIZE = 10
const CORPUS_FILE = 'public/corpus.json'
const OUTPUT_FILE = 'public/translations.json'

if (!existsSync(CORPUS_FILE)) {
  console.error(`Corpus not found at ${CORPUS_FILE}. Run npm run build:corpus first.`)
  process.exit(1)
}

const corpus = JSON.parse(readFileSync(CORPUS_FILE, 'utf8'))
const existing = existsSync(OUTPUT_FILE)
  ? JSON.parse(readFileSync(OUTPUT_FILE, 'utf8'))
  : {}

const slice = corpus.slice(START, START + LIMIT)
const untranslated = slice.filter(p => !existing[p.id])

console.log(`Corpus: ${corpus.length} poems total`)
console.log(`Range:  ${START}–${START + LIMIT - 1} (${slice.length} poems)`)
console.log(`Already translated in range: ${slice.length - untranslated.length}`)
console.log(`To translate: ${untranslated.length}`)

if (untranslated.length === 0) {
  console.log('Nothing to do.')
  process.exit(0)
}

const SYSTEM_PROMPT = `You are a classical Chinese poetry translator. For each poem provided, produce a poetic English rendering that preserves the emotional tone, imagery, and cadence of the original. Do NOT produce a literal word-for-word translation.

Return a JSON array where each element has this exact shape:
{"id":"<poem id>","englishLines":["<line 1>","<line 2>",...]}

The englishLines array MUST have exactly the same number of entries as the poem's lines array. Return ONLY valid JSON — no markdown code fences, no commentary, no extra text.`

function stripMarkdown(text) {
  return text.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim()
}

function translateBatch(batch) {
  const poemsJson = JSON.stringify(
    batch.map(p => ({ id: p.id, title: p.title, author: p.author, lines: p.lines })),
    null, 2
  )
  const result = spawnSync('claude', ['-p', `${SYSTEM_PROMPT}\n\nPoems:\n${poemsJson}`], {
    encoding: 'utf8',
    timeout: 120000,
    maxBuffer: 10 * 1024 * 1024,
  })
  if (result.error) throw result.error
  if (result.status !== 0) {
    throw new Error(`claude exited with code ${result.status}:\n${result.stderr || '(no stderr)'}`)
  }
  return JSON.parse(stripMarkdown(result.stdout.trim()))
}

const translations = { ...existing }
let totalSuccess = 0
let totalFail = 0

function runPass() {
  const current = JSON.parse(readFileSync(OUTPUT_FILE, 'utf8'))
  const remaining = slice.filter(p => !current[p.id])
  if (remaining.length === 0) return 0

  const batches = []
  for (let i = 0; i < remaining.length; i += BATCH_SIZE) {
    batches.push(remaining.slice(i, i + BATCH_SIZE))
  }

  let passSuccess = 0
  let passFail = 0

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i]
    process.stdout.write(`Batch ${i + 1}/${batches.length} (${batch.length} poems)... `)
    try {
      const results = translateBatch(batch)
      for (const r of results) {
        const orig = batch.find(p => p.id === r.id)
        if (r.id && Array.isArray(r.englishLines) && orig) {
          if (r.englishLines.length === orig.lines.length) {
            current[r.id] = r.englishLines
            passSuccess++
          } else {
            console.warn(`  ⚠ "${orig.title}": expected ${orig.lines.length} lines, got ${r.englishLines.length} — skipped`)
            passFail++
          }
        }
      }
      console.log(`✓ ${results.length} translated`)
      writeFileSync(OUTPUT_FILE, JSON.stringify(current))
    } catch (err) {
      console.log(`✗ FAILED: ${err.message}`)
      passFail += batch.length
    }
  }

  totalSuccess += passSuccess
  totalFail = passFail
  return passFail
}

const RETRY_DELAY_MS = 60_000
const MAX_RETRIES = 200

// Write initial file if it doesn't exist yet
if (!existsSync(OUTPUT_FILE)) writeFileSync(OUTPUT_FILE, JSON.stringify(existing))

for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
  const remaining = slice.filter(p => !JSON.parse(readFileSync(OUTPUT_FILE, 'utf8'))[p.id])
  if (remaining.length === 0) break

  if (attempt > 1) {
    console.log(`\nRetry ${attempt - 1}/${MAX_RETRIES - 1} — ${remaining.length} poems remaining. Waiting 60s...`)
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, RETRY_DELAY_MS)
    console.log('Retrying...')
  }

  const failed = runPass()
  if (failed === 0) break
}

console.log(`\nDone! ${OUTPUT_FILE} now has ${Object.keys(translations).length} translations total.`)
console.log(`This run: ${successCount} succeeded, ${failCount} failed/skipped.`)
if (failCount > 0) {
  console.log('Re-run to retry failed batches.')
}

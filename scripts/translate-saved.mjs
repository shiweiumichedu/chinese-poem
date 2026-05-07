#!/usr/bin/env node
// Usage: npm run translate:saved -- library.json
// Reads library.json, translates poems missing englishLines via `claude -p`,
// writes <input>-translated.json

import { readFileSync, writeFileSync } from 'fs'
import { spawnSync } from 'child_process'
import { basename, extname, dirname, join } from 'path'

const inputFile = process.argv[2]
if (!inputFile) {
  console.error('Usage: npm run translate:saved -- <library.json>')
  process.exit(1)
}

const poems = JSON.parse(readFileSync(inputFile, 'utf8'))
if (!Array.isArray(poems)) {
  console.error('Input file must contain a JSON array of poems')
  process.exit(1)
}

const untranslated = poems.filter(p => !p.englishLines || p.englishLines.length === 0)
console.log(`Total poems: ${poems.length}, need translation: ${untranslated.length}`)

if (untranslated.length === 0) {
  console.log('All poems already have translations. Nothing to do.')
  process.exit(0)
}

const BATCH_SIZE = 10

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
  const fullPrompt = `${SYSTEM_PROMPT}\n\nPoems:\n${poemsJson}`

  const result = spawnSync('claude', ['-p', fullPrompt], {
    encoding: 'utf8',
    timeout: 120000,
    maxBuffer: 10 * 1024 * 1024,
  })

  if (result.error) throw result.error
  if (result.status !== 0) {
    throw new Error(`claude exited with code ${result.status}:\n${result.stderr || '(no stderr)'}`)
  }

  const raw = stripMarkdown(result.stdout.trim())
  return JSON.parse(raw)
}

const translationMap = new Map()
const batches = []
for (let i = 0; i < untranslated.length; i += BATCH_SIZE) {
  batches.push(untranslated.slice(i, i + BATCH_SIZE))
}

for (let i = 0; i < batches.length; i++) {
  const batch = batches[i]
  process.stdout.write(`Batch ${i + 1}/${batches.length} (${batch.length} poems)... `)
  try {
    const results = translateBatch(batch)
    for (const r of results) {
      if (r.id && Array.isArray(r.englishLines)) {
        translationMap.set(r.id, r.englishLines)
      }
    }
    console.log(`✓ ${results.length} translated`)
  } catch (err) {
    console.log(`✗ FAILED: ${err.message}`)
  }
}

const updated = poems.map(p =>
  translationMap.has(p.id) ? { ...p, englishLines: translationMap.get(p.id) } : p
)

const ext = extname(inputFile)
const base = basename(inputFile, ext)
const dir = dirname(inputFile)
const outputFile = join(dir, `${base}-translated${ext}`)
writeFileSync(outputFile, JSON.stringify(updated, null, 2))

console.log(`\nDone! Output: ${outputFile}`)
console.log(`Translated: ${translationMap.size}/${untranslated.length} poems`)
if (translationMap.size < untranslated.length) {
  console.log(`Failed: ${untranslated.length - translationMap.size} (re-run to retry)`)
}

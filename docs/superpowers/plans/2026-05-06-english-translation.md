# English Translation Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 中/英 toggle to the poem player that shows poetic English lines beneath each Chinese line and speaks them in `en-US`, with translations generated offline via the `claude` CLI and stored per-poem in IndexedDB.

**Architecture:** Translations live as `englishLines?: string[]` on each `SavedPoem` in IndexedDB. A Node.js build script (`scripts/translate-saved.mjs`) calls `claude -p` in batches of 10 to translate an exported library JSON file; the user imports the result back through a settings modal. The app reads `englishLines` from the already-loaded poem object — no extra network request at runtime.

**Tech Stack:** React 19 + TypeScript, IndexedDB (`idb`), Web Speech API (`SpeechSynthesisUtterance`), Node.js `child_process.spawnSync`, `claude` CLI

---

## File Map

| Action | File | Purpose |
|--------|------|---------|
| Modify | `src/types.ts` | Add `englishLines?: string[]` to `SavedPoem` |
| Modify | `src/voice/VoiceController.ts` | Add optional `lang?` param to `speakLines` |
| Modify | `src/hooks/useVoiceController.ts` | Thread `lang` param through the React wrapper |
| Create | `scripts/translate-saved.mjs` | Offline batch translator using `claude -p` |
| Modify | `package.json` | Add `translate:saved` script |
| Create | `src/components/SettingsModal.tsx` | Export/import UI (gear icon modal) |
| Modify | `src/App.tsx` | Add `lang` state, gear icon, `SettingsModal`, pass `lang`/`setLang` to `ListenTab` |
| Modify | `src/components/PoemPlayer.tsx` | 中/英 toggle button, bilingual display, hide 背诵 in 英 mode |
| Modify | `src/components/ListenTab.tsx` | English TTS in `onPlay`, `onSpeakLine`, auto-play, repeat |
| Modify | `src/styles.css` | Styles for `.english-line`, settings modal, gear button, `.btn-lang` |
| Modify | `tests/voice/VoiceController.test.ts` | Tests for `lang` param |
| Create | `tests/components/SettingsModal.test.tsx` | Tests for export/import |
| Create | `tests/components/PoemPlayer.english.test.tsx` | Tests for bilingual display + toggle |

---

### Task 1: Types + VoiceController `lang` parameter

**Files:**
- Modify: `src/types.ts`
- Modify: `src/voice/VoiceController.ts:163` (the `utterance.lang = 'zh-CN'` line)
- Modify: `src/hooks/useVoiceController.ts:41-52`
- Test: `tests/voice/VoiceController.test.ts`

- [ ] **Step 1: Write two failing tests for the `lang` param**

Append to `tests/voice/VoiceController.test.ts` inside the `describe('VoiceController')` block:

```typescript
  it('speakLines uses zh-CN lang by default', () => {
    vi.useFakeTimers()
    type MockUtt = { text: string; lang: string; onstart: (() => void) | null; onend: (() => void) | null; onerror: (() => void) | null }
    const utts: MockUtt[] = []
    setWindowProp('SpeechSynthesisUtterance', class {
      text: string; lang = ''; onstart: (() => void) | null = null
      onend: (() => void) | null = null; onerror: (() => void) | null = null
      constructor(t: string) { this.text = t; utts.push(this) }
    })
    const ctrl = createVoiceController()
    ctrl.speakLines(['床前明月光'], vi.fn(), vi.fn())
    vi.runOnlyPendingTimers()
    expect(utts[0].lang).toBe('zh-CN')
    vi.useRealTimers()
  })

  it('speakLines uses provided lang when specified', () => {
    vi.useFakeTimers()
    type MockUtt = { text: string; lang: string; onstart: (() => void) | null; onend: (() => void) | null; onerror: (() => void) | null }
    const utts: MockUtt[] = []
    setWindowProp('SpeechSynthesisUtterance', class {
      text: string; lang = ''; onstart: (() => void) | null = null
      onend: (() => void) | null = null; onerror: (() => void) | null = null
      constructor(t: string) { this.text = t; utts.push(this) }
    })
    const ctrl = createVoiceController()
    ctrl.speakLines(['Before the bed, the moonlight'], vi.fn(), vi.fn(), 1.0, 'en-US')
    vi.runOnlyPendingTimers()
    expect(utts[0].lang).toBe('en-US')
    vi.useRealTimers()
  })
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/voice/VoiceController.test.ts
```

Expected: 2 new tests FAIL (one expects `zh-CN`, the utterance has no lang set; second expects `en-US`, same).

- [ ] **Step 3: Add `englishLines` to `SavedPoem` in `src/types.ts`**

Replace the `SavedPoem` interface:

```typescript
export interface SavedPoem extends CorpusPoem {
  writingBackground?: string
  addedAt: number
  rating?: number // 1-5 star rating
  boldLines?: number[]
  charAnnotations?: CharAnnotation[]
  englishLines?: string[]
}
```

- [ ] **Step 4: Add `lang?` to `speakLines` in `src/voice/VoiceController.ts`**

Update the `VoiceController` interface (around line 17):

```typescript
speakLines(lines: string[], onLineStart: (index: number) => void, onDone: () => void, rate?: number, lang?: string): void
```

Update the implementation — change the single line `utterance.lang = 'zh-CN'` (around line 163) to:

```typescript
utterance.lang = lang ?? 'zh-CN'
```

The full updated `speakLines` method signature line (around line 135):

```typescript
speakLines(lines, onLineStart, onDone, rate = 1.0, lang) {
```

- [ ] **Step 5: Update `speakLines` wrapper in `src/hooks/useVoiceController.ts`**

Replace the `speakLines` callback (lines 41-52):

```typescript
  const speakLines = useCallback((
    lines: string[],
    onLineStart: (index: number) => void,
    onDone: () => void,
    lang?: string
  ) => {
    const ctrl = getController()
    ctrl.speakLines(lines, onLineStart, () => {
      setVoiceState('idle')
      onDone()
    }, ttsRateRef.current, lang)
    setVoiceState(ctrl.state)
  }, [getController])
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
npx vitest run tests/voice/VoiceController.test.ts
```

Expected: all tests PASS including the 2 new ones.

- [ ] **Step 7: Commit**

```bash
git add src/types.ts src/voice/VoiceController.ts src/hooks/useVoiceController.ts tests/voice/VoiceController.test.ts
git commit -m "feat: add englishLines to SavedPoem; add lang param to speakLines"
```

---

### Task 2: Offline build script `scripts/translate-saved.mjs`

**Files:**
- Create: `scripts/translate-saved.mjs`
- Modify: `package.json`

- [ ] **Step 1: Create `scripts/translate-saved.mjs`**

```javascript
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
```

- [ ] **Step 2: Add `translate:saved` script to `package.json`**

In the `"scripts"` object, add after `"build:corpus"`:

```json
"translate:saved": "node scripts/translate-saved.mjs"
```

- [ ] **Step 3: Smoke-test the script with a small sample**

Create a test file `test-translate.json` with 2 poems:

```json
[
  {
    "id": "test-1",
    "title": "静夜思",
    "author": "李白",
    "dynasty": "tang",
    "authorBackground": "",
    "lines": ["床前明月光，", "疑是地上霜。", "举头望明月，", "低头思故乡。"],
    "addedAt": 1000
  }
]
```

Run:
```bash
npm run translate:saved -- test-translate.json
```

Expected output:
```
Total poems: 1, need translation: 1
Batch 1/1 (1 poems)... ✓ 1 translated

Done! Output: test-translate-translated.json
Translated: 1/1 poems
```

Open `test-translate-translated.json` and verify `englishLines` is a 4-element array with poetic English. Delete both test files.

- [ ] **Step 4: Commit**

```bash
git add scripts/translate-saved.mjs package.json
git commit -m "feat: add translate:saved build script using claude CLI"
```

---

### Task 3: SettingsModal component

**Files:**
- Create: `src/components/SettingsModal.tsx`
- Modify: `src/styles.css`
- Test: `tests/components/SettingsModal.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `tests/components/SettingsModal.test.tsx`:

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SettingsModal } from '../../src/components/SettingsModal'
import { savePoem } from '../../src/data/PoemLibrary'
import type { SavedPoem } from '../../src/types'

vi.mock('../../src/data/PoemLibrary', () => ({
  savePoem: vi.fn().mockResolvedValue(undefined),
  listPoems: vi.fn().mockResolvedValue([]),
  resetDBCache: vi.fn(),
}))

const poem: SavedPoem = {
  id: 'p1',
  title: '静夜思',
  author: '李白',
  dynasty: 'tang',
  authorBackground: '',
  lines: ['床前明月光，', '疑是地上霜。'],
  addedAt: 1000,
}

function makeProps(overrides = {}) {
  return {
    isOpen: true,
    onClose: vi.fn(),
    savedPoems: [poem],
    onPoemAdded: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  global.URL.createObjectURL = vi.fn().mockReturnValue('blob:test')
  global.URL.revokeObjectURL = vi.fn()
  global.alert = vi.fn()
})

describe('SettingsModal', () => {
  it('renders nothing when isOpen is false', () => {
    render(<SettingsModal {...makeProps({ isOpen: false })} />)
    expect(screen.queryByText('设置')).not.toBeInTheDocument()
  })

  it('renders settings heading when open', () => {
    render(<SettingsModal {...makeProps()} />)
    expect(screen.getByText('设置')).toBeInTheDocument()
  })

  it('close button calls onClose', () => {
    const onClose = vi.fn()
    render(<SettingsModal {...makeProps({ onClose })} />)
    fireEvent.click(screen.getByRole('button', { name: '关闭' }))
    expect(onClose).toHaveBeenCalled()
  })

  it('clicking overlay calls onClose', () => {
    const onClose = vi.fn()
    const { container } = render(<SettingsModal {...makeProps({ onClose })} />)
    fireEvent.click(container.querySelector('.settings-overlay')!)
    expect(onClose).toHaveBeenCalled()
  })

  it('export button triggers download with savedPoems JSON', () => {
    const mockClick = vi.fn()
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'a') {
        const el = { href: '', download: '', click: mockClick } as unknown as HTMLAnchorElement
        return el
      }
      return document.createElement(tag)
    })

    render(<SettingsModal {...makeProps()} />)
    fireEvent.click(screen.getByRole('button', { name: '导出诗库' }))

    expect(global.URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob))
    expect(mockClick).toHaveBeenCalled()

    vi.restoreAllMocks()
  })

  it('import updates englishLines for matching poems and calls onPoemAdded', async () => {
    const translated = [{ ...poem, englishLines: ['Before the bed', 'Like frost'] }]
    const file = new File([JSON.stringify(translated)], 'library-translated.json', {
      type: 'application/json',
    })

    const onPoemAdded = vi.fn().mockResolvedValue(undefined)
    render(<SettingsModal {...makeProps({ onPoemAdded })} />)

    const input = screen.getByLabelText('导入翻译文件')
    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() =>
      expect(savePoem).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'p1', englishLines: ['Before the bed', 'Like frost'] })
      )
    )
    expect(onPoemAdded).toHaveBeenCalled()
  })

  it('import with invalid JSON shows alert', async () => {
    const file = new File(['not json'], 'bad.json', { type: 'application/json' })
    render(<SettingsModal {...makeProps()} />)

    const input = screen.getByLabelText('导入翻译文件')
    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => expect(global.alert).toHaveBeenCalledWith(
      expect.stringContaining('格式错误')
    ))
    expect(savePoem).not.toHaveBeenCalled()
  })

  it('import with no matching poem ids saves nothing', async () => {
    const translated = [{ ...poem, id: 'unknown-id', englishLines: ['line'] }]
    const file = new File([JSON.stringify(translated)], 'library-translated.json', {
      type: 'application/json',
    })
    render(<SettingsModal {...makeProps()} />)
    fireEvent.change(screen.getByLabelText('导入翻译文件'), { target: { files: [file] } })

    await waitFor(() => expect(global.alert).toHaveBeenCalledWith(
      expect.stringContaining('未找到')
    ))
    expect(savePoem).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/components/SettingsModal.test.tsx
```

Expected: all tests FAIL (module not found).

- [ ] **Step 3: Implement `src/components/SettingsModal.tsx`**

```typescript
import { useRef } from 'react'
import type { SavedPoem } from '../types'
import { savePoem } from '../data/PoemLibrary'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
  savedPoems: SavedPoem[]
  onPoemAdded: () => Promise<void>
}

export function SettingsModal({ isOpen, onClose, savedPoems, onPoemAdded }: SettingsModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleExport() {
    const json = JSON.stringify(savedPoems, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'library.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const text = await file.text()
    let imported: SavedPoem[]
    try {
      const parsed = JSON.parse(text)
      if (!Array.isArray(parsed)) throw new Error('not an array')
      imported = parsed
    } catch {
      alert('文件格式错误，请使用导出的 library.json 文件')
      return
    }

    const savedById = new Map(savedPoems.map(p => [p.id, p]))
    let count = 0
    for (const poem of imported) {
      const existing = savedById.get(poem.id)
      if (existing && Array.isArray(poem.englishLines) && poem.englishLines.length > 0) {
        await savePoem({ ...existing, englishLines: poem.englishLines })
        count++
      }
    }

    if (count > 0) {
      await onPoemAdded()
      alert(`已导入 ${count} 首诗的英文翻译`)
    } else {
      alert('未找到可导入的翻译')
    }

    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  if (!isOpen) return null

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={e => e.stopPropagation()}>
        <h2>设置</h2>
        <div className="settings-section">
          <h3>英文翻译</h3>
          <p className="settings-description">
            导出诗库，用 <code>npm run translate:saved</code> 翻译后再导入。
          </p>
          <button className="btn-settings-action" onClick={handleExport} aria-label="导出诗库">
            导出诗库
          </button>
          <label className="btn-settings-action btn-settings-import">
            导入翻译
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleImport}
              aria-label="导入翻译文件"
            />
          </label>
        </div>
        <button className="btn-settings-close" onClick={onClose} aria-label="关闭">
          关闭
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Add styles to `src/styles.css`**

Append to the end of `src/styles.css`:

```css
/* ── Settings Modal ─────────────────────────────────── */

.settings-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.settings-modal {
  background: #1a1a3e;
  border-radius: 12px;
  padding: 24px;
  width: 320px;
  max-width: calc(100vw - 48px);
}

.settings-modal h2 {
  margin: 0 0 16px;
  font-size: 20px;
  color: #e0e0ff;
}

.settings-section {
  margin-bottom: 24px;
}

.settings-section h3 {
  margin: 0 0 8px;
  font-size: 15px;
  color: #b0b0d0;
}

.settings-description {
  font-size: 13px;
  color: #8080a0;
  margin: 0 0 12px;
}

.settings-description code {
  background: #2a2a5a;
  padding: 1px 4px;
  border-radius: 3px;
  font-family: monospace;
  font-size: 12px;
}

.btn-settings-action {
  display: block;
  width: 100%;
  padding: 10px;
  margin-bottom: 8px;
  background: #2a2a5a;
  border: 1px solid #4a4a8a;
  border-radius: 8px;
  color: #e0e0ff;
  font-size: 15px;
  cursor: pointer;
  text-align: center;
  box-sizing: border-box;
}

.btn-settings-action:hover { background: #3a3a7a; }

.btn-settings-import { cursor: pointer; }

.btn-settings-import input[type="file"] { display: none; }

.btn-settings-close {
  width: 100%;
  padding: 10px;
  background: transparent;
  border: 1px solid #4a4a6a;
  border-radius: 8px;
  color: #8080a0;
  font-size: 15px;
  cursor: pointer;
}

.btn-settings-close:hover { background: #2a2a4a; }
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx vitest run tests/components/SettingsModal.test.tsx
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/SettingsModal.tsx src/styles.css tests/components/SettingsModal.test.tsx
git commit -m "feat: add SettingsModal with library export and translation import"
```

---

### Task 4: App.tsx — `lang` state, gear icon, SettingsModal wiring

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/styles.css`

No new tests for this task — the wiring is covered by integration behaviour tested in Tasks 5 and 6.

- [ ] **Step 1: Update `src/App.tsx`**

Replace the entire file:

```typescript
import { useState, useEffect } from 'react'
import { useVoiceController } from './hooks/useVoiceController'
import { useCorpus } from './hooks/useCorpus'
import { listPoems, savePoem } from './data/PoemLibrary'
import { getMissingSeeds, SEED_POEMS } from './data/seedPoems'
import { ListenTab } from './components/ListenTab'
import { LibraryTab } from './components/LibraryTab'
import { SettingsModal } from './components/SettingsModal'
import type { AppTab, SavedPoem } from './types'

const LANG_KEY = 'poem-lang'

function App() {
  const [activeTab, setActiveTab] = useState<AppTab>('listen')
  const [libraryPoems, setLibraryPoems] = useState<SavedPoem[]>([])
  const [selectedPoem, setSelectedPoem] = useState<SavedPoem | undefined>(undefined)
  const [lang, setLangState] = useState<'zh' | 'en'>(
    () => (localStorage.getItem(LANG_KEY) as 'zh' | 'en' | null) ?? 'zh'
  )
  const [showSettings, setShowSettings] = useState(false)

  const { corpus, loading: corpusLoading, error: corpusError } = useCorpus()
  const { voiceState, startListening, speakLines, stop, isSTTSupported, ttsRate, setTtsRate } = useVoiceController()
  const sttSupported = isSTTSupported()

  useEffect(() => {
    listPoems().then(async (poems) => {
      const missing = getMissingSeeds(poems, SEED_POEMS)
      if (missing.length > 0) {
        const now = Date.now()
        await Promise.all(missing.map((p, i) => savePoem({ ...p, addedAt: now + i })))
        setLibraryPoems(await listPoems())
      } else {
        setLibraryPoems(poems)
      }
    })
  }, [])

  function handleSetLang(l: 'zh' | 'en') {
    localStorage.setItem(LANG_KEY, l)
    setLangState(l)
  }

  function handlePoemSelect(poem: SavedPoem) {
    setSelectedPoem(poem)
    setActiveTab('listen')
  }

  async function handlePoemAdded() {
    const updated = await listPoems()
    setLibraryPoems(updated)
  }

  const voiceProps = {
    voiceState,
    startListening,
    speakLines,
    stop,
    isSTTSupported: sttSupported,
  }

  return (
    <div className="app">
      <main className="app-content">
        {corpusError && (
          <div className="corpus-error">
            诗库加载失败，仅可朗读已收藏的诗词
          </div>
        )}
        {activeTab === 'listen' ? (
          <ListenTab
            {...voiceProps}
            libraryPoems={libraryPoems}
            initialPoem={selectedPoem}
            ttsRate={ttsRate}
            setTtsRate={setTtsRate}
            onPoemUpdated={handlePoemAdded}
            lang={lang}
            setLang={handleSetLang}
          />
        ) : (
          <LibraryTab
            {...voiceProps}
            corpus={corpus}
            corpusLoading={corpusLoading}
            corpusError={corpusError}
            savedPoems={libraryPoems}
            onPoemSelect={handlePoemSelect}
            onPoemAdded={handlePoemAdded}
          />
        )}
      </main>
      <nav className="tab-bar">
        <button
          className={`tab-button${activeTab === 'listen' ? ' active' : ''}`}
          onClick={() => { setSelectedPoem(undefined); setActiveTab('listen') }}
        >
          🎤 朗读
        </button>
        <button
          className={`tab-button${activeTab === 'library' ? ' active' : ''}`}
          onClick={() => { stop(); setActiveTab('library') }}
        >
          📚 诗库
        </button>
        <button
          className="tab-button btn-settings-gear"
          aria-label="设置"
          onClick={() => setShowSettings(true)}
        >
          ⚙
        </button>
      </nav>
      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        savedPoems={libraryPoems}
        onPoemAdded={handlePoemAdded}
      />
    </div>
  )
}

export default App
```

- [ ] **Step 2: Add gear button style to `src/styles.css`**

Append to the end of the file:

```css
/* ── Language toggle + gear ─────────────────────────── */

.btn-settings-gear {
  font-size: 20px;
  color: #8080a0;
  min-width: 44px;
}

.btn-lang {
  padding: 8px 14px;
  background: #2a2a5a;
  border: 1px solid #4a4a8a;
  border-radius: 8px;
  color: #b0b0d0;
  font-size: 15px;
  cursor: pointer;
}

.btn-lang.active {
  background: #3a5a8a;
  border-color: #6a9aca;
  color: #e0f0ff;
}

.btn-lang.unavailable {
  opacity: 0.35;
}
```

- [ ] **Step 3: Run all tests to confirm nothing broke**

```bash
npm test
```

Expected: all existing tests PASS (TypeScript may warn about `lang`/`setLang` missing from `ListenTabProps` — that's fixed in Task 6).

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx src/styles.css
git commit -m "feat: add lang state, gear icon, and SettingsModal to App"
```

---

### Task 5: PoemPlayer — bilingual display + 中/英 toggle

**Files:**
- Modify: `src/components/PoemPlayer.tsx`
- Modify: `src/styles.css`
- Test: `tests/components/PoemPlayer.english.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `tests/components/PoemPlayer.english.test.tsx`:

```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import { PoemPlayer } from '../../src/components/PoemPlayer'
import type { SavedPoem } from '../../src/types'

const basePoem: SavedPoem = {
  id: 'p1',
  title: '静夜思',
  author: '李白',
  dynasty: 'tang',
  authorBackground: '',
  lines: ['床前明月光，', '疑是地上霜。'],
  addedAt: 1000,
}

const poemWithEnglish: SavedPoem = {
  ...basePoem,
  englishLines: ['Before the bed, the moonlight shines,', 'Like frost upon the ground it lies.'],
}

function makeProps(overrides = {}) {
  return {
    poem: basePoem,
    onPlay: vi.fn(),
    onStop: vi.fn(),
    isPlaying: false,
    ttsRate: 1.0,
    setTtsRate: vi.fn(),
    ...overrides,
  }
}

describe('PoemPlayer — English mode', () => {
  it('does not show 中/英 button when lang/setLang not provided', () => {
    render(<PoemPlayer {...makeProps()} />)
    expect(screen.queryByRole('button', { name: /切换为/ })).not.toBeInTheDocument()
  })

  it('shows 中/英 button labeled 切换为英文 when lang is zh', () => {
    render(<PoemPlayer {...makeProps({ lang: 'zh', setLang: vi.fn() })} />)
    expect(screen.getByRole('button', { name: '切换为英文' })).toBeInTheDocument()
  })

  it('shows 中/英 button labeled 切换为中文 when lang is en', () => {
    render(<PoemPlayer {...makeProps({ lang: 'en', setLang: vi.fn(), poem: poemWithEnglish })} />)
    expect(screen.getByRole('button', { name: '切换为中文' })).toBeInTheDocument()
  })

  it('toggle button has unavailable class when poem has no englishLines', () => {
    const { container } = render(
      <PoemPlayer {...makeProps({ lang: 'zh', setLang: vi.fn() })} />
    )
    expect(container.querySelector('.btn-lang.unavailable')).toBeInTheDocument()
  })

  it('toggle calls setLang("en") when poem has englishLines and lang is zh', () => {
    const setLang = vi.fn()
    render(<PoemPlayer {...makeProps({ lang: 'zh', setLang, poem: poemWithEnglish })} />)
    fireEvent.click(screen.getByRole('button', { name: '切换为英文' }))
    expect(setLang).toHaveBeenCalledWith('en')
  })

  it('toggle calls setLang("zh") when lang is en', () => {
    const setLang = vi.fn()
    render(<PoemPlayer {...makeProps({ lang: 'en', setLang, poem: poemWithEnglish })} />)
    fireEvent.click(screen.getByRole('button', { name: '切换为中文' }))
    expect(setLang).toHaveBeenCalledWith('zh')
  })

  it('toggle does nothing when poem has no englishLines and lang is zh', () => {
    const setLang = vi.fn()
    render(<PoemPlayer {...makeProps({ lang: 'zh', setLang })} />)
    fireEvent.click(screen.getByRole('button', { name: '切换为英文' }))
    expect(setLang).not.toHaveBeenCalled()
  })

  it('shows englishLines beneath Chinese lines when lang is en', () => {
    render(<PoemPlayer {...makeProps({ lang: 'en', setLang: vi.fn(), poem: poemWithEnglish })} />)
    expect(screen.getByText('Before the bed, the moonlight shines,')).toBeInTheDocument()
    expect(screen.getByText('Like frost upon the ground it lies.')).toBeInTheDocument()
  })

  it('does not show englishLines when lang is zh', () => {
    render(<PoemPlayer {...makeProps({ lang: 'zh', setLang: vi.fn(), poem: poemWithEnglish })} />)
    expect(screen.queryByText('Before the bed, the moonlight shines,')).not.toBeInTheDocument()
  })

  it('hides 背诵 button when lang is en', () => {
    render(
      <PoemPlayer {...makeProps({ lang: 'en', setLang: vi.fn(), onReciteToggle: vi.fn() })} />
    )
    expect(screen.queryByText('背诵')).not.toBeInTheDocument()
  })

  it('shows 背诵 button when lang is zh', () => {
    render(
      <PoemPlayer {...makeProps({ lang: 'zh', setLang: vi.fn(), onReciteToggle: vi.fn() })} />
    )
    expect(screen.getByText('背诵')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/components/PoemPlayer.english.test.tsx
```

Expected: all tests FAIL.

- [ ] **Step 3: Add `lang`/`setLang` props and `Fragment` import to `src/components/PoemPlayer.tsx`**

Change the import line at the top:

```typescript
import { useState, useRef, useEffect, Fragment } from 'react'
```

Add to `PoemPlayerProps` interface (after `onRate?`):

```typescript
  lang?: 'zh' | 'en'
  setLang?: (lang: 'zh' | 'en') => void
```

Add `lang` and `setLang` to the destructured props in the function signature (after `onRate`):

```typescript
export function PoemPlayer({ poem, onPlay, onStop, isPlaying, highlightedLine, ttsRate, setTtsRate, onLineEdit, onLineBoldToggle, onSpeakLine, autoPlay, onAutoPlayToggle, reciting, onReciteToggle, onBack, nextPoem, onNextPoem, onCharAnnotate, onCharAnnotateRemove, onRate, lang, setLang }: PoemPlayerProps) {
```

- [ ] **Step 4: Add 中/英 toggle button in `.poem-controls`**

In the `.poem-controls` `<div>`, add the toggle button **before** the play/stop button:

```tsx
      <div className="poem-controls">
        {setLang && (
          <button
            className={`btn-lang${lang === 'en' ? ' active' : ''}${!poem.englishLines ? ' unavailable' : ''}`}
            aria-pressed={lang === 'en'}
            aria-label={lang === 'en' ? '切换为中文' : '切换为英文'}
            onClick={() => {
              if (!poem.englishLines && lang !== 'en') return
              setLang(lang === 'en' ? 'zh' : 'en')
            }}
          >
            {lang === 'en' ? '英' : '中'}
          </button>
        )}
        {isPlaying ? (
          <button onClick={handleStop} className="btn-stop">停止</button>
        ) : (
          <button onClick={handlePlay} className="btn-play">朗读</button>
        )}
```

- [ ] **Step 5: Show English lines beneath Chinese lines in `displayLines.map`**

In the non-editing branch of `displayLines.map`, the current code returns a `<p>` element. Wrap it in a `<Fragment>` and append the English line. Replace the final `return (` block (the one that returns the `<p className="poem-line...">`) with:

```tsx
          return (
            <Fragment key={`${line.sourceLineIndex}-${i}`}>
              <p
                className={`poem-line${line.sourceLineIndex === displayHighlight ? ' highlighted' : ''}${isBoldLine ? ' bold' : ''}${onLineEdit && !isPlaying ? ' editable' : ''}`}
                onClick={handleLineAction}
              >
                {Array.from(line.text).map((char, charOffset) => {
                  const sourceCharIndex = line.sourceCharOffset + charOffset
                  const annotation = poem.charAnnotations?.find(
                    (a) => a.lineIndex === line.sourceLineIndex && a.charIndex === sourceCharIndex
                  )
                  const touchHandlers = {
                    onTouchStart: () =>
                      handleCharTouchStart(line.sourceLineIndex, sourceCharIndex, char),
                    onTouchEnd: handleCharTouchEnd,
                  }
                  if (annotation) {
                    return (
                      <ruby key={charOffset} {...touchHandlers} onClick={handleCharClick}>
                        {char}<rt>{annotation.pinyin}</rt>
                      </ruby>
                    )
                  }
                  return <span key={charOffset} {...touchHandlers} onClick={handleCharClick}>{char}</span>
                })}
              </p>
              {lang === 'en' && poem.englishLines && isFirstRowForSource && (
                <p className="english-line">
                  {poem.englishLines[line.sourceLineIndex] ?? ''}
                </p>
              )}
            </Fragment>
          )
```

Note: remove the old `key` from the `<p>` — it's now on `<Fragment>`.

- [ ] **Step 6: Hide 背诵 button when `lang === 'en'`**

Find the `{onReciteToggle && (` block and add the `lang !== 'en'` guard:

```tsx
        {onReciteToggle && lang !== 'en' && (
          <button
            className={`btn-recite${reciting ? ' active' : ''}`}
            aria-pressed={reciting}
            onClick={onReciteToggle}
          >
            背诵
          </button>
        )}
```

- [ ] **Step 7: Add `.english-line` style to `src/styles.css`**

Append:

```css
.english-line {
  color: #a0a0c0;
  font-size: 14px;
  font-style: italic;
  margin: -6px 0 14px;
  text-align: center;
}
```

- [ ] **Step 8: Run tests to verify they pass**

```bash
npx vitest run tests/components/PoemPlayer.english.test.tsx
```

Expected: all tests PASS.

- [ ] **Step 9: Commit**

```bash
git add src/components/PoemPlayer.tsx src/styles.css tests/components/PoemPlayer.english.test.tsx
git commit -m "feat: bilingual display and 中/英 toggle in PoemPlayer"
```

---

### Task 6: ListenTab — English TTS integration

**Files:**
- Modify: `src/components/ListenTab.tsx`

- [ ] **Step 1: Write failing tests**

Create `tests/components/ListenTab.english.test.tsx`:

```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import { ListenTab } from '../../src/components/ListenTab'
import type { SavedPoem, VoiceState } from '../../src/types'

vi.mock('../../src/data/PoemLibrary', () => ({
  savePoem: vi.fn().mockResolvedValue(undefined),
  listPoems: vi.fn().mockResolvedValue([]),
  resetDBCache: vi.fn(),
}))

const poem: SavedPoem = {
  id: 'p1',
  title: '静夜思',
  author: '李白',
  dynasty: 'tang',
  authorBackground: '',
  lines: ['床前明月光，', '疑是地上霜。'],
  addedAt: 1000,
}

const poemWithEnglish: SavedPoem = {
  ...poem,
  englishLines: ['Before the bed, the moonlight shines,', 'Like frost upon the ground it lies.'],
}

function makeProps(overrides = {}) {
  return {
    voiceState: 'idle' as VoiceState,
    startListening: vi.fn(),
    speakLines: vi.fn(),
    stop: vi.fn(),
    isSTTSupported: false,
    libraryPoems: [],
    ttsRate: 1.0,
    setTtsRate: vi.fn(),
    onPoemUpdated: vi.fn().mockResolvedValue(undefined),
    lang: 'zh' as 'zh' | 'en',
    setLang: vi.fn(),
    ...overrides,
  }
}

describe('ListenTab — English TTS', () => {
  it('calls speakLines with englishLines and en-US when lang is en and poem has englishLines', () => {
    const speakLines = vi.fn()
    render(
      <ListenTab
        {...makeProps({ speakLines, lang: 'en', initialPoem: poemWithEnglish })}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: '朗读' }))
    expect(speakLines).toHaveBeenCalledWith(
      poemWithEnglish.englishLines,
      expect.any(Function),
      expect.any(Function),
      'en-US'
    )
  })

  it('calls speakLines with Chinese lines when lang is zh', () => {
    const speakLines = vi.fn()
    render(
      <ListenTab
        {...makeProps({ speakLines, lang: 'zh', initialPoem: poemWithEnglish })}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: '朗读' }))
    expect(speakLines).toHaveBeenCalledWith(
      poemWithEnglish.lines,
      expect.any(Function),
      expect.any(Function),
    )
  })

  it('calls speakLines with Chinese lines when lang is en but poem has no englishLines', () => {
    const speakLines = vi.fn()
    render(
      <ListenTab
        {...makeProps({ speakLines, lang: 'en', initialPoem: poem })}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: '朗读' }))
    expect(speakLines).toHaveBeenCalledWith(
      poem.lines,
      expect.any(Function),
      expect.any(Function),
    )
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/components/ListenTab.english.test.tsx
```

Expected: all tests FAIL (TypeScript error: `lang`/`setLang` not in `ListenTabProps`).

- [ ] **Step 3: Add `lang`, `setLang` props and `langRef` to `src/components/ListenTab.tsx`**

Add to `ListenTabProps` interface (after `onPoemUpdated`):

```typescript
  lang: 'zh' | 'en'
  setLang: (lang: 'zh' | 'en') => void
```

Update the `speakLines` type in `ListenTabProps` to accept `lang?`:

```typescript
  speakLines: (lines: string[], onLineStart: (i: number) => void, onDone: () => void, lang?: string) => void
```

Update `LibraryTabProps` in `src/components/LibraryTab.tsx` to match (same `speakLines` type — LibraryTab gets the same function from App and TypeScript will complain otherwise):

```typescript
  speakLines: (lines: string[], onLineStart: (i: number) => void, onDone: () => void, lang?: string) => void
```

Add `lang` and `setLang` to the destructured function parameters in `ListenTab`:

```typescript
export function ListenTab({
  voiceState,
  startListening,
  speakLines,
  stop,
  isSTTSupported,
  libraryPoems,
  initialPoem,
  ttsRate,
  setTtsRate,
  onPoemUpdated = async () => {},
  lang,
  setLang,
}: ListenTabProps) {
```

Add a `langRef` alongside the other refs at the top of the function body (after `reciteSessionRatingRef`):

```typescript
  const langRef = useRef(lang)
  useEffect(() => { langRef.current = lang }, [lang])
```

- [ ] **Step 4: Update `onPlay` handler to use English TTS when appropriate**

In the JSX where `<PoemPlayer>` is rendered, find the `onPlay` prop and replace it:

```typescript
          onPlay={(lines, onLineStart, onDone) => {
            stopRecitingSession()
            if (lang === 'en' && currentPoem.englishLines) {
              speakLines(
                currentPoem.englishLines,
                (i) => { setHighlightedLine(i); onLineStart(i) },
                () => { onDone(); setHighlightedLine(null); handlePoemDone() },
                'en-US'
              )
            } else {
              const ttsLines = lines.map((l, idx) => buildTtsLine(l, idx, currentPoem.charAnnotations ?? []))
              speakLines(
                ttsLines,
                (i) => { setHighlightedLine(i); onLineStart(i) },
                () => { onDone(); setHighlightedLine(null); handlePoemDone() },
              )
            }
          }}
```

- [ ] **Step 5: Update `onSpeakLine` to use English TTS**

Replace the `onSpeakLine` prop:

```typescript
          onSpeakLine={(lineIndex) => {
            stop()
            if (lang === 'en' && currentPoem.englishLines?.[lineIndex]) {
              speakLines([currentPoem.englishLines[lineIndex]], () => {}, () => {}, 'en-US')
            } else {
              const ttsText = buildTtsLine(currentPoem.lines[lineIndex], lineIndex, currentPoem.charAnnotations ?? [])
              speakLines([ttsText], () => {}, () => {})
            }
          }}
```

- [ ] **Step 6: Update `handlePoemDone` to use English TTS for repeat and auto-play**

In `handlePoemDone`, update the repeat-play block:

```typescript
  if (repeatPlayRef.current) {
    const current = currentPoemRef.current
    if (!current) return
    setTimeout(() => {
      if (manuallyStoppedRef.current) return
      if (langRef.current === 'en' && current.englishLines) {
        speakLines(current.englishLines, (i) => setHighlightedLine(i), handlePoemDone, 'en-US')
      } else {
        speakLines(
          current.lines.map((l, i) => buildTtsLine(l, i, current.charAnnotations ?? [])),
          (i) => setHighlightedLine(i),
          handlePoemDone,
        )
      }
    }, 800)
    return
  }
```

In the auto-play advance section (the inner `setTimeout` that speaks the next poem's lines), replace the `speakLines(next.lines...)` call:

```typescript
        setTimeout(() => {
          if (!autoPlayRef.current || manuallyStoppedRef.current) return
          speakLines(
            langRef.current === 'en' && next.englishLines
              ? next.englishLines
              : next.lines.map((l, i) => buildTtsLine(l, i, next.charAnnotations ?? [])),
            (i) => setHighlightedLine(i),
            handlePoemDone,
            langRef.current === 'en' && next.englishLines ? 'en-US' : undefined,
          )
        }, pauseMs)
```

- [ ] **Step 7: Pass `lang` and `setLang` to `PoemPlayer` in the JSX**

Add these two props to `<PoemPlayer>` (after `onRate`):

```typescript
          lang={lang}
          setLang={setLang}
```

- [ ] **Step 8: Run all tests**

```bash
npm test
```

Expected: all tests PASS.

- [ ] **Step 9: Run TypeScript build check**

```bash
npm run build
```

Expected: build succeeds with no type errors.

- [ ] **Step 10: Commit**

```bash
git add src/components/ListenTab.tsx src/components/LibraryTab.tsx tests/components/ListenTab.english.test.tsx
git commit -m "feat: English TTS integration in ListenTab; wire lang through to PoemPlayer"
```

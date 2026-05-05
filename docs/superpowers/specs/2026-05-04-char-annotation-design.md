# Character Pronunciation Annotation

## Problem

The browser TTS engine mispronounces polyphone characters (多音字) — characters whose reading depends on context. Example: 还 in 千里江陵一日还 should be read as "huán" but TTS reads it as "hái". Users need a way to mark the correct pronunciation and have the app speak it correctly thereafter.

## Design

### Data Model (`src/types.ts`)

New interface added alongside existing types:

```typescript
interface CharAnnotation {
  lineIndex: number    // index into poem.lines (source line)
  charIndex: number    // character position within poem.lines[lineIndex]
  pinyin: string       // display annotation shown above the character, e.g. "huán"
  substitute: string   // character the TTS reads instead, e.g. "环"
}
```

`SavedPoem` gains one optional field:

```typescript
charAnnotations?: CharAnnotation[]
```

No migration needed — `undefined` means no annotations (backward compatible).

### DisplayLine offset (`src/utils/poemLineDisplay.ts`)

`DisplayLine` gains a new field:

```typescript
export type DisplayLine = {
  text: string
  sourceLineIndex: number
  sourceCharOffset: number  // character offset of this segment within poem.lines[sourceLineIndex]; 0 for unsplit lines
}
```

`buildDisplayLines` computes `sourceCharOffset` by finding each clause's position within the source line string. For unsplit lines the offset is always 0.

### Pure TTS helper (`src/utils/charAnnotation.ts`)

```typescript
export function buildTtsLine(
  line: string,
  lineIndex: number,
  annotations: CharAnnotation[],
): string
```

Replaces annotated characters at their `charIndex` positions with their `substitute` values. Returns the original line unchanged when no annotations apply. Stateless and pure — easy to test and reuse.

### Rendering (`src/components/PoemPlayer.tsx`)

Each `<p className="poem-line">` renders its text as individual `<span>` elements per character (instead of a plain text node). Annotated characters render as `<ruby>char<rt>pinyin</rt></ruby>`. Non-annotated characters are plain `<span>` elements.

Long-press detection sits on each character `<span>` via `onTouchStart`/`onTouchEnd`. A 500 ms timer starts on touch start. If touch ends before 500 ms, the event propagates normally to the enclosing `<p>` (speak + edit). If the timer fires, propagation is stopped and the annotation popup opens.

New prop on `PoemPlayer`:

```typescript
onCharAnnotate?: (lineIndex: number, charIndex: number, pinyin: string, substitute: string) => void
onCharAnnotateRemove?: (lineIndex: number, charIndex: number) => void
```

### Annotation popup

A centered overlay rendered inside `PoemPlayer` when a long-press fires. Contains:

- The tapped character displayed in large text
- Pinyin input (pre-filled if annotation exists)
- Substitute character input (pre-filled if annotation exists)
- **Save** button — calls `onCharAnnotate`, closes popup
- **Remove** button (shown only if annotation already exists) — calls `onCharAnnotateRemove`, closes popup
- **Cancel** button — closes popup, no change

### TTS integration (`src/components/ListenTab.tsx`)

Three call sites pass text to TTS — full poem playback (`speakLines`), single-line tap (`onSpeakLine`), and recitation. All three wrap line text in `buildTtsLine(line, lineIndex, poem.charAnnotations ?? [])` before sending to TTS. The display always shows original characters with pinyin annotations; only the audio is substituted.

`ListenTab` adds two handlers:

```typescript
async function handleCharAnnotate(lineIndex, charIndex, pinyin, substitute) {
  const existing = currentPoem.charAnnotations ?? []
  const filtered = existing.filter(a => !(a.lineIndex === lineIndex && a.charIndex === charIndex))
  const updated = { ...currentPoem, charAnnotations: [...filtered, { lineIndex, charIndex, pinyin, substitute }] }
  setPoem(updated)
  await savePoem(updated)
  await onPoemUpdated()
}

async function handleCharAnnotateRemove(lineIndex, charIndex) {
  const charAnnotations = (currentPoem.charAnnotations ?? [])
    .filter(a => !(a.lineIndex === lineIndex && a.charIndex === charIndex))
  const updated = { ...currentPoem, charAnnotations }
  setPoem(updated)
  await savePoem(updated)
  await onPoemUpdated()
}
```

### Styling (`src/styles.css`)

```css
ruby { display: inline; }
rt { font-size: 0.5em; color: #aaa; }
.annotation-popup { /* centered overlay */ }
```

## Files Changed

| File | Change |
|------|--------|
| `src/types.ts` | `CharAnnotation` interface, `charAnnotations?` on `SavedPoem` |
| `src/utils/poemLineDisplay.ts` | `sourceCharOffset` on `DisplayLine`, computed in `buildDisplayLines` |
| `src/utils/charAnnotation.ts` | New — pure `buildTtsLine()` |
| `src/components/PoemPlayer.tsx` | Char spans, long-press, popup, two new props |
| `src/components/ListenTab.tsx` | Two handlers, `buildTtsLine` at all three TTS call sites |
| `src/styles.css` | `ruby`/`rt` styles, annotation popup |

## Testing

- `tests/utils/charAnnotation.test.ts` — `buildTtsLine`: no annotations returns original; single substitution; multiple substitutions; ignores other lines
- `tests/utils/poemLineDisplay.test.ts` — `sourceCharOffset` is 0 for unsplit lines; correct offsets for split clauses
- `tests/components/PoemPlayer.test.tsx` — annotated characters render with `<ruby>`; long-press opens popup; popup pre-fills existing annotation; Save calls `onCharAnnotate`; Remove calls `onCharAnnotateRemove`; Cancel closes popup
- `tests/components/ListenTab.charAnnotation.test.tsx` — Save persists annotation to IndexedDB; Remove persists removal; TTS uses substitute text

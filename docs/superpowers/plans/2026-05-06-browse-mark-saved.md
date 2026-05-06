# Mark saved poems in 浏览诗库 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop hiding already-saved poems from 浏览诗库 results; instead show each saved poem inline with its star rating (or a checkmark when unrated) and make those rows non-interactive.

**Architecture:** Single-component change in `LibraryTab.tsx`. The `browseResults` memo stops filtering by saved-id and additionally exposes a lookup map. The browse result renderer becomes a 3-branch conditional: `<button>+` for unsaved, `<div>` with stars for saved-with-rating, `<div>` with checkmark for saved-without-rating. CSS adds a non-interactive variant and suppresses hover on display-only stars.

**Tech Stack:** React 19, TypeScript, Vite, Vitest + Testing Library, plain CSS.

**Spec:** `docs/superpowers/specs/2026-05-06-browse-mark-saved-design.md`

---

## File Structure

- **Modify:** `src/components/LibraryTab.tsx` — `browseResults` memo (lines 63–67) and browse result render (lines 361–388)
- **Modify:** `src/styles.css` — add three rules near `.browse-result-item` block (lines 300–308)
- **Modify:** `tests/components/LibraryTab.test.tsx` — replace two contradicting tests, add three new tests

No new files. The change is small and cohesive — keeping it in `LibraryTab.tsx` matches the existing pattern (the file already owns both sub-tabs).

---

### Task 1: Update outdated tests and add failing tests for new behavior

**Files:**
- Modify: `tests/components/LibraryTab.test.tsx:214-243`

Two existing tests assert behavior that the new design contradicts and must be replaced. Three new tests describe the new behavior.

- [ ] **Step 1: Replace the "excludes already-saved" test with an "includes saved with rating" test**

In `tests/components/LibraryTab.test.tsx`, find the test at line 214:

```tsx
  it('browse excludes already-saved poems from results', () => {
    render(<LibraryTab {...makeProps({ savedPoems: [savedPoem] })} />)
    fireEvent.click(screen.getByRole('tab', { name: '浏览诗库' }))
    // savedPoem has id 'c1' (静夜思) — should not appear in browse results
    const browseSection = screen.getByPlaceholderText('搜索诗库（诗名或诗句）...').closest('.browse-section')!
    expect(browseSection).not.toHaveTextContent('静夜思')
    expect(browseSection).toHaveTextContent('春晓')
  })
```

Replace it with:

```tsx
  it('browse includes saved poems and shows their rating as stars', () => {
    const ratedSaved: SavedPoem = { ...corpusPoem, addedAt: 1000, rating: 3 }
    render(<LibraryTab {...makeProps({ savedPoems: [ratedSaved] })} />)
    fireEvent.click(screen.getByRole('tab', { name: '浏览诗库' }))

    const browseSection = screen.getByPlaceholderText('搜索诗库（诗名或诗句）...').closest('.browse-section')!
    expect(browseSection).toHaveTextContent('静夜思')

    const row = within(browseSection as HTMLElement).getByText('静夜思').closest('.browse-result-item')!
    const stars = row.querySelectorAll('.star')
    expect(stars).toHaveLength(5)
    expect(row.querySelectorAll('.star.filled')).toHaveLength(3)
    expect(row.querySelector('.browse-result-add')).toBeNull()
  })
```

Also add `within` to the existing import line at the top:

```tsx
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
```

- [ ] **Step 2: Replace the "all-added message" test with a "saved without rating shows checkmark" test**

Find the test at line 237:

```tsx
  it('shows all-added message in browse when all corpus poems are saved', () => {
    const CORPUS_POEMS = [corpusPoem, corpusPoem2]
    const allSaved = CORPUS_POEMS.map(p => ({ ...p, addedAt: 0 }))
    render(<LibraryTab {...makeProps({ savedPoems: allSaved })} />)
    fireEvent.click(screen.getByRole('tab', { name: '浏览诗库' }))
    expect(screen.getByText('所有诗词已添加到诗库')).toBeInTheDocument()
  })
```

Replace it with:

```tsx
  it('browse shows checkmark for saved poems with no rating', () => {
    const unratedSaved: SavedPoem = { ...corpusPoem, addedAt: 1000 }
    render(<LibraryTab {...makeProps({ savedPoems: [unratedSaved] })} />)
    fireEvent.click(screen.getByRole('tab', { name: '浏览诗库' }))

    const browseSection = screen.getByPlaceholderText('搜索诗库（诗名或诗句）...').closest('.browse-section')!
    const row = within(browseSection as HTMLElement).getByText('静夜思').closest('.browse-result-item')!
    expect(row.querySelector('.browse-result-saved-check')).not.toBeNull()
    expect(row.querySelectorAll('.star.filled')).toHaveLength(0)
    expect(row.querySelector('.browse-result-add')).toBeNull()
  })
```

- [ ] **Step 3: Add test that tapping a saved poem in browse does NOT open preview**

Add a new test after the "checkmark" test:

```tsx
  it('tapping a saved poem in browse does NOT open the preview', () => {
    const unratedSaved: SavedPoem = { ...corpusPoem, addedAt: 1000 }
    render(<LibraryTab {...makeProps({ savedPoems: [unratedSaved] })} />)
    fireEvent.click(screen.getByRole('tab', { name: '浏览诗库' }))

    const browseSection = screen.getByPlaceholderText('搜索诗库（诗名或诗句）...').closest('.browse-section')!
    const row = within(browseSection as HTMLElement).getByText('静夜思').closest('.browse-result-item')!
    fireEvent.click(row)
    expect(screen.queryByRole('button', { name: '确认添加' })).not.toBeInTheDocument()
  })
```

- [ ] **Step 4: Run tests to verify the three new tests fail and the rest still pass**

Run: `npx vitest run tests/components/LibraryTab.test.tsx`

Expected:
- The three new tests FAIL because the implementation still hides saved poems and uses `+` for everything.
- All other tests in the file PASS (no other tests depend on the deleted behavior).

If any other test fails, stop and investigate — the test file may have additional dependencies that need updating.

- [ ] **Step 5: Commit the test updates**

```bash
git add tests/components/LibraryTab.test.tsx
git commit -m "test(LibraryTab): replace browse-exclude tests with mark-saved tests"
```

---

### Task 2: Implement `browseResults` memo and render branches in `LibraryTab.tsx`

**Files:**
- Modify: `src/components/LibraryTab.tsx:63-67` (memo)
- Modify: `src/components/LibraryTab.tsx:361-388` (render)

- [ ] **Step 1: Update `browseResults` memo to include saved poems and expose a lookup map**

In `src/components/LibraryTab.tsx`, replace the existing memo at lines 63–67:

```tsx
  const browseResults = useMemo(() => {
    const savedIds = new Set(savedPoems.map(p => p.id))
    const pool = browseQuery ? searchPoems(corpus, browseQuery) : corpus
    return pool.filter(p => !savedIds.has(p.id)).slice(0, 50)
  }, [corpus, browseQuery, savedPoems])
```

with:

```tsx
  const savedById = useMemo(
    () => new Map(savedPoems.map(p => [p.id, p])),
    [savedPoems]
  )

  const browseResults = useMemo(() => {
    const pool = browseQuery ? searchPoems(corpus, browseQuery) : corpus
    return pool.slice(0, 50)
  }, [corpus, browseQuery])
```

- [ ] **Step 2: Update the browse result render to branch on saved state**

In `src/components/LibraryTab.tsx`, replace the existing block at lines 361–388 (inside the `browse-results` div):

```tsx
              {browseResults.map((poem) => (
                <button
                  key={poem.id}
                  className="browse-result-item"
                  onClick={() => setPreview(poem)}
                  aria-label={`添加 ${poem.title}`}
                >
                  <span className="browse-result-title">{poem.title}</span>
                  <span className="browse-result-meta">
                    {poem.author} · {DYNASTY_LABEL[poem.dynasty] ?? poem.dynasty}
                  </span>
                  <span className="browse-result-add" aria-hidden="true">＋</span>
                </button>
              ))}
              {browseResults.length === 0 && (
                <div className="online-search-wrap">
                  <p className="browse-no-results">
                    {browseQuery ? '未找到匹配的诗' : '所有诗词已添加到诗库'}
                  </p>
                  {browseQuery && (
                    <button
                      className="btn-online-search"
                      onClick={() => handleOnlineSearch(browseQuery)}
                    >
                      联网找诗
                    </button>
                  )}
                </div>
              )}
```

with:

```tsx
              {browseResults.map((poem) => {
                const saved = savedById.get(poem.id)
                if (!saved) {
                  return (
                    <button
                      key={poem.id}
                      className="browse-result-item"
                      onClick={() => setPreview(poem)}
                      aria-label={`添加 ${poem.title}`}
                    >
                      <span className="browse-result-title">{poem.title}</span>
                      <span className="browse-result-meta">
                        {poem.author} · {DYNASTY_LABEL[poem.dynasty] ?? poem.dynasty}
                      </span>
                      <span className="browse-result-add" aria-hidden="true">＋</span>
                    </button>
                  )
                }
                const rating = saved.rating
                return (
                  <div
                    key={poem.id}
                    className="browse-result-item saved"
                    aria-label={`${poem.title}（已在诗库）`}
                  >
                    <span className="browse-result-title">{poem.title}</span>
                    <span className="browse-result-meta">
                      {poem.author} · {DYNASTY_LABEL[poem.dynasty] ?? poem.dynasty}
                    </span>
                    {typeof rating === 'number' && rating >= 1 && rating <= 5 ? (
                      <span className="browse-result-stars" aria-hidden="true">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <span
                            key={star}
                            className={`star${rating >= star ? ' filled' : ''}`}
                          >
                            ★
                          </span>
                        ))}
                      </span>
                    ) : (
                      <span className="browse-result-saved-check" aria-hidden="true">✓</span>
                    )}
                  </div>
                )
              })}
              {browseResults.length === 0 && browseQuery && (
                <div className="online-search-wrap">
                  <p className="browse-no-results">未找到匹配的诗</p>
                  <button
                    className="btn-online-search"
                    onClick={() => handleOnlineSearch(browseQuery)}
                  >
                    联网找诗
                  </button>
                </div>
              )}
```

- [ ] **Step 3: Run the LibraryTab tests and verify they all pass**

Run: `npx vitest run tests/components/LibraryTab.test.tsx`

Expected: ALL tests PASS, including the three new ones added in Task 1.

If any test fails, fix the implementation before continuing. Do not edit tests to make them pass — the tests describe the desired behavior.

- [ ] **Step 4: Commit the implementation**

```bash
git add src/components/LibraryTab.tsx
git commit -m "feat(LibraryTab): show saved poems in browse with rating/check indicator"
```

---

### Task 3: Add CSS for the saved variant and display-only stars

**Files:**
- Modify: `src/styles.css` (add rules near line 308, after `.browse-result-add`)

- [ ] **Step 1: Append the new CSS rules**

In `src/styles.css`, immediately after the existing `.browse-result-add { ... }` line (currently line 308), insert:

```css
.browse-result-item.saved {
  cursor: default;
}
.browse-result-item.saved:hover {
  background: #1e1e3a;
}
.browse-result-saved-check {
  color: #6a8a6a;
  font-size: 18px;
  flex-shrink: 0;
}
.browse-result-stars {
  display: flex;
  gap: 2px;
  flex-shrink: 0;
}
.browse-result-item .star {
  cursor: default;
}
.browse-result-item .star:hover {
  color: inherit;
}
.browse-result-item .star.filled:hover {
  color: #ffd700;
}
```

The `.browse-result-item.saved:hover` rule explicitly resets to the base background — if the existing `.browse-result-item` has any hover state (visual or implicit from being a button), this nullifies it for the saved variant.

- [ ] **Step 2: Run the production build to ensure no CSS or TS errors**

Run: `npm run build`

Expected: build completes with no errors. Warnings about chunk sizes are fine.

If `tsc` complains about any code from Task 2, fix it before continuing.

- [ ] **Step 3: Run the full test suite as a regression check**

Run: `npm run test`

Expected: all tests PASS (no regressions in other components or hooks).

- [ ] **Step 4: Commit the styles**

```bash
git add src/styles.css
git commit -m "style(LibraryTab): non-interactive saved variant for browse rows"
```

---

### Task 4: Lint and final verification

**Files:** none

- [ ] **Step 1: Run ESLint**

Run: `npm run lint`

Expected: no errors. Fix any lint errors introduced (unused vars, missing deps in `useMemo`, etc.) before continuing.

- [ ] **Step 2: Optional manual smoke test in dev server**

Run: `npm run dev`

In a browser, switch to the 诗库 tab → 浏览诗库 sub-tab. Verify:
- Unsaved poems show the green `+` and clicking opens the preview/confirm dialog.
- A saved poem with a rating shows that many filled stars (and the rest empty) on the right, no `+`.
- A saved poem without a rating shows a green-ish checkmark `✓` on the right, no `+`.
- Clicking a saved poem's row does nothing (no preview opens, no navigation).

Stop the dev server when done.

- [ ] **Step 3: Commit any fixes from lint (if any)**

If lint required code changes, commit them:

```bash
git add -u
git commit -m "chore: lint fixes for browse mark-saved"
```

If no fixes were needed, skip this step.

---

## Self-Review Notes

- **Spec coverage:** All four behaviors in the spec's behavior table are covered (Task 2 step 2). The four test cases in the spec map to the three new tests in Task 1 plus the still-passing existing tests for `+` behavior. The empty-state simplification is in Task 2 step 2. The CSS changes (`.browse-result-item.saved`, `.browse-result-saved-check`, hover suppression) are in Task 3.
- **Type consistency:** `savedById` typed as `Map<string, SavedPoem>` via inference from `savedPoems: SavedPoem[]`. `rating` access uses `saved.rating` which exists on `SavedPoem` per `src/types.ts:13`. Render uses `typeof rating === 'number' && rating >= 1 && rating <= 5` to be defensive against bad data.
- **No placeholders:** every code block is concrete and complete.

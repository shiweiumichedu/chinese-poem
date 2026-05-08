# English Translation Badge — Design Spec

**Date:** 2026-05-08  
**Status:** Approved

## Problem

Users cannot tell from the poem list which poems have English translations available. They must open a poem in the player to find out.

## Goal

Show a small `EN` pill badge on each poem row in the "我的诗库" and "浏览诗库" sub-tabs wherever `poem.englishLines?.length > 0`. Purely informational — no interaction.

## Approach

### Condition

```ts
poem.englishLines && poem.englishLines.length > 0
```

Both `CorpusPoem` (used in browse) and `SavedPoem` (used in mine) already carry `englishLines?: string[]`. The corpus hook merges translations from `public/translations.json` at runtime. No data layer changes needed.

### Markup

A single `<span>` inserted inline after the title span in both list contexts:

```tsx
{poem.englishLines && poem.englishLines.length > 0 && (
  <span className="badge-en" aria-label="英文翻译可用">EN</span>
)}
```

The `aria-label` makes it accessible to screen readers without cluttering the visual.

### Placement

- **我的诗库** (`filteredSavedPoems` list): inside the `.poem-list-content` button, after `<span className="poem-list-title">`
- **浏览诗库** (`browseResults` list): in both the unsaved (`button.browse-result-item`) and saved (`div.browse-result-item.saved`) variants, after `<span className="browse-result-title">`

### Styling

One new rule added to `src/index.css`:

```css
.badge-en {
  display: inline-block;
  font-size: 0.65rem;
  font-weight: 600;
  line-height: 1;
  padding: 2px 5px;
  border-radius: 3px;
  background: #3b82f6;
  color: #fff;
  vertical-align: middle;
  margin-left: 6px;
  letter-spacing: 0.03em;
}
```

## Files Changed

| File | Change |
|------|--------|
| `src/components/LibraryTab.tsx` | Add `badge-en` span in mine list and both browse variants |
| `src/index.css` | Add `.badge-en` rule |
| `tests/components/LibraryTab.en-badge.test.tsx` | New test: badge renders iff `englishLines` present |

No changes to types, hooks, data layer, or build scripts.

## Testing

New test file `tests/components/LibraryTab.en-badge.test.tsx`:

- Renders mine list with one poem that has `englishLines` and one without → badge appears on first, not second
- Renders browse list with one poem that has `englishLines` and one without → badge appears on first, not second
- Badge has `aria-label="英文翻译可用"`

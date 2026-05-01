import type { CorpusPoem, SavedPoem, AppTab, VoiceState } from '../src/types'

it('CorpusPoem has required fields', () => {
  const p: CorpusPoem = {
    id: '1',
    title: '静夜思',
    author: '李白',
    dynasty: 'tang',
    authorBackground: '唐代诗人',
    lines: ['床前明月光', '疑是地上霜'],
  }
  expect(p.dynasty).toBe('tang')
})

it('SavedPoem extends CorpusPoem with optional writingBackground and addedAt', () => {
  const p: SavedPoem = {
    id: '1',
    title: '静夜思',
    author: '李白',
    dynasty: 'tang',
    authorBackground: '唐代诗人',
    lines: ['床前明月光'],
    addedAt: Date.now(),
  }
  expect(p.writingBackground).toBeUndefined()
  expect(p.addedAt).toBeGreaterThan(0)
})

it('SavedPoem is assignable to CorpusPoem (structural subtype)', () => {
  const saved: SavedPoem = {
    id: '1',
    title: '静夜思',
    author: '李白',
    dynasty: 'tang',
    authorBackground: '唐代诗人',
    lines: ['床前明月光'],
    addedAt: Date.now(),
  }
  const corpus: CorpusPoem = saved  // must compile — SavedPoem extends CorpusPoem
  expect(corpus.title).toBe('静夜思')
})

it('AppTab union', () => {
  const t: AppTab = 'listen'
  expect(t).toBe('listen')
})

it('VoiceState union', () => {
  const s: VoiceState = 'idle'
  expect(s).toBe('idle')
})

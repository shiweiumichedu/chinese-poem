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

it('SavedPoem has optional writingBackground', () => {
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
})

it('AppTab union', () => {
  const t: AppTab = 'listen'
  expect(t).toBe('listen')
})

it('VoiceState union', () => {
  const s: VoiceState = 'idle'
  expect(s).toBe('idle')
})

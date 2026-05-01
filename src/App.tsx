import { useState, useEffect } from 'react'
import { useVoiceController } from './hooks/useVoiceController'
import { useCorpus } from './hooks/useCorpus'
import { listPoems } from './data/PoemLibrary'
import { ListenTab } from './components/ListenTab'
import { LibraryTab } from './components/LibraryTab'
import type { AppTab, SavedPoem } from './types'

function App() {
  const [activeTab, setActiveTab] = useState<AppTab>('listen')
  const [libraryPoems, setLibraryPoems] = useState<SavedPoem[]>([])
  const [selectedPoem, setSelectedPoem] = useState<SavedPoem | undefined>(undefined)

  const { corpus, loading: corpusLoading, error: corpusError } = useCorpus()
  const { voiceState, startListening, speakLines, stop, isSTTSupported, ttsRate, setTtsRate } = useVoiceController()
  const sttSupported = isSTTSupported()

  useEffect(() => {
    listPoems().then(setLibraryPoems)
  }, [])

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
          />
        ) : (
          <LibraryTab
            {...voiceProps}
            corpus={corpus}
            corpusLoading={corpusLoading}
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
      </nav>
    </div>
  )
}

export default App

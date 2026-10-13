import { useEffect, useState } from 'react'
import type { Feedback } from './engine/advisor'
import { createGame, ranking, type GameState } from './engine/game'
import { configureSound } from './sound'
import type { Rules } from './engine/rules'
import { GameScreen } from './screens/GameScreen'
import { HelpScreen } from './screens/HelpScreen'
import { SettingsScreen } from './screens/SettingsScreen'
import { TitleScreen } from './screens/TitleScreen'
import {
  EMPTY_STATS,
  loadRules,
  loadSavedGame,
  loadSettings,
  loadStats,
  saveGame,
  saveRules,
  saveSettings,
  saveStats,
  type AppSettings,
  type PlayStats,
} from './settings'

type Screen = 'title' | 'game' | 'settings' | 'help'

function isValidSave(g: GameState | null): g is GameState {
  return !!g && g.version === 1 && Array.isArray(g.players) && g.players.length === 4 && g.phase?.type !== 'gameEnd'
}

export function App() {
  const [screen, setScreen] = useState<Screen>('title')
  const [back, setBack] = useState<Screen>('title')
  const [settings, setSettings] = useState<AppSettings>(loadSettings)
  const [rules, setRules] = useState<Rules>(loadRules)
  const [stats, setStats] = useState<PlayStats>(loadStats)
  const [game, setGame] = useState<GameState | null>(null)
  const [gameKey, setGameKey] = useState(0)
  const [saved, setSaved] = useState<GameState | null>(() => {
    const g = loadSavedGame<GameState>()
    return isValidSave(g) ? g : null
  })

  useEffect(() => saveSettings(settings), [settings])
  useEffect(() => configureSound(settings.se, settings.seVolume / 100), [settings.se, settings.seVolume])
  useEffect(() => saveRules(rules), [rules])
  useEffect(() => saveStats(stats), [stats])

  const startNew = () => {
    const g = createGame(rules)
    saveGame(g)
    setGame(g)
    setGameKey((k) => k + 1)
    setScreen('game')
  }

  const resume = () => {
    if (!saved) return
    setGame(saved)
    setGameKey((k) => k + 1)
    setScreen('game')
  }

  const openHelp = (from: Screen) => {
    setBack(from)
    setScreen('help')
  }

  const onRoundFinished = (s: GameState, fb: Feedback[]) => {
    setStats((st) => {
      const n = structuredClone(st)
      n.rounds++
      const res = s.roundResult
      if (res) {
        if (res.wins.some((w) => w.winner === 0)) n.wins++
        if (res.wins.some((w) => w.from === 0)) n.dealIns++
      }
      if (s.players[0].riichi) n.riichi++
      for (const f of fb) n.verdicts[f.verdict]++
      return n
    })
  }

  const onGameFinished = (s: GameState) => {
    setStats((st) => {
      const n = structuredClone(st)
      n.games++
      const order = s.final?.order ?? ranking(s)
      n.ranks[order.indexOf(0)]++
      return n
    })
    setSaved(null)
  }

  if (screen === 'game' && game) {
    return (
      <div className={`app ${settings.showNames ? 'show-names' : ''}`}>
        <GameScreen
          key={gameKey}
          initial={game}
          settings={settings}
          onSettingsChange={setSettings}
          onExit={() => {
            const g = loadSavedGame<GameState>()
            setSaved(isValidSave(g) ? g : null)
            setScreen('title')
          }}
          onNewGame={startNew}
          onGameFinished={onGameFinished}
          onRoundFinished={onRoundFinished}
          onOpenHelp={() => openHelp('game')}
        />
      </div>
    )
  }
  if (screen === 'help') {
    return (
      <div className="app">
        <HelpScreen
          onBack={() => setScreen(back === 'game' && game ? 'game' : 'title')}
        />
      </div>
    )
  }
  if (screen === 'settings') {
    return (
      <div className="app">
        <SettingsScreen rules={rules} settings={settings} onRules={setRules} onSettings={setSettings} onBack={() => setScreen('title')} />
      </div>
    )
  }
  return (
    <div className="app">
      <TitleScreen
        canResume={!!saved}
        stats={stats}
        rules={rules}
        settings={settings}
        onStart={startNew}
        onResume={resume}
        onSettings={() => setScreen('settings')}
        onHelp={() => openHelp('title')}
        onResetStats={() => setStats(structuredClone(EMPTY_STATS))}
      />
    </div>
  )
}

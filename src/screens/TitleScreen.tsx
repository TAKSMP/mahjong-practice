// タイトル画面

import { useState } from 'react'
import type { Rules } from '../engine/rules'
import type { AppSettings, PlayStats } from '../settings'
import { TileView } from '../components/Tile'

interface Props {
  canResume: boolean
  stats: PlayStats
  rules: Rules
  settings: AppSettings
  onStart: () => void
  onResume: () => void
  onSettings: () => void
  onHelp: () => void
  onResetStats: () => void
}

const HINT_JP = { before: '打つ前のヒント', after: '打った直後の指摘', off: 'なし' }
const LEVEL_JP = { weak: 'よわい', normal: 'ふつう', strong: 'つよい' }

export function TitleScreen({ canResume, stats, rules, settings, onStart, onResume, onSettings, onHelp, onResetStats }: Props) {
  const [confirmReset, setConfirmReset] = useState(false)
  const v = stats.verdicts
  const totalV = v.best + v.good + v.soso + v.bad
  const avgRank = stats.games > 0 ? stats.ranks.reduce((a, n, i) => a + n * (i + 1), 0) / stats.games : 0
  return (
    <div className="title-page">
      <div className="title-logo">
        <div className="title-tiles">
          {[33, 32, 31].map((k) => (
            <TileView key={k} kind={k} />
          ))}
        </div>
        <h1>麻雀れんしゅう</h1>
        <div className="title-sub">打ち筋サポートつき 4人打ち麻雀</div>
      </div>
      <div className="title-buttons">
        {canResume ? (
          <button className="btn btn-main big" onClick={onResume}>
            ▶ 続きから
          </button>
        ) : null}
        <button className={`btn ${canResume ? 'btn-sub' : 'btn-main'} big`} onClick={onStart}>
          {canResume ? '新しく対局する' : '▶ 対局をはじめる'}
        </button>
        <button className="btn btn-sub" onClick={onSettings}>
          ⚙ ルール・サポート設定
        </button>
        <button className="btn btn-sub" onClick={onHelp}>
          📖 遊び方・役・用語の解説
        </button>
      </div>
      <div className="title-info">
        <div>
          ルール：{rules.length === 'tonpuu' ? '東風戦' : '半荘戦'}・赤{rules.aka}枚・喰いタン{rules.kuitan ? 'あり' : 'なし'}
        </div>
        <div>
          サポート：{HINT_JP[settings.hintMode]} ／ CPU：{LEVEL_JP[settings.cpuLevel]}
        </div>
      </div>
      {stats.rounds > 0 || stats.games > 0 ? (
        <div className="stats-card">
          <div className="stats-title">あなたの成績</div>
          <div className="stats-grid">
            <div>
              <b>{stats.games}</b>
              <span>対局</span>
            </div>
            <div>
              <b>{stats.games ? avgRank.toFixed(2) : '-'}</b>
              <span>平均順位</span>
            </div>
            <div>
              <b>{stats.rounds ? Math.round((stats.wins / stats.rounds) * 100) : 0}%</b>
              <span>和了率</span>
            </div>
            <div>
              <b>{stats.rounds ? Math.round((stats.dealIns / stats.rounds) * 100) : 0}%</b>
              <span>放銃率</span>
            </div>
          </div>
          {totalV > 0 ? (
            <div className="stats-verdict">
              打牌の評価：最善 {Math.round((v.best / totalV) * 100)}%・良い {Math.round((v.good / totalV) * 100)}%・もう一歩{' '}
              {Math.round((v.soso / totalV) * 100)}%・要注意 {Math.round((v.bad / totalV) * 100)}%
            </div>
          ) : null}
          {confirmReset ? (
            <div className="reset-confirm">
              成績を消しますか？
              <button className="link-btn" onClick={() => { onResetStats(); setConfirmReset(false) }}>
                消す
              </button>
              <button className="link-btn" onClick={() => setConfirmReset(false)}>
                やめる
              </button>
            </div>
          ) : (
            <button className="link-btn" onClick={() => setConfirmReset(true)}>
              成績をリセット
            </button>
          )}
        </div>
      ) : null}
    </div>
  )
}

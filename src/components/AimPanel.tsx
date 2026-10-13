// 今狙える役の一覧（見込み%つき）。卓の代わりに表示する。

import { useEffect, useState } from 'react'
import { createAimJob, type AimRow, type AimSnapshot } from '../engine/aim'
import { doraIndicators, liveRemaining, type GameState } from '../engine/game'
import { doraFromIndicator, kindOf, parseKinds, type Kind } from '../engine/tiles'
import { YAKU_BY_ID } from '../engine/yakuData'
import { isRedTile } from './Table'
import { TileView } from './Tile'

/** 手牌・副露・残りの山が変わったら、計算し直す */
function signature(s: GameState): string {
  const p = s.players[0]
  return [
    s.roundNo,
    p.hand.join(','),
    p.drawn ?? '',
    p.melds.map((m) => `${m.type}${m.tiles.join('.')}`).join('|'),
    Math.ceil(liveRemaining(s) / 4),
    s.phase.type === 'roundEnd' ? 'end' : '',
  ].join('/')
}

function useAimSnapshot(s: GameState): { snap: AimSnapshot | null; busy: boolean } {
  const sig = signature(s)
  const [snap, setSnap] = useState<AimSnapshot | null>(null)
  const [busy, setBusy] = useState(true)
  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null
    setBusy(true)
    // 重い計算で画面が固まらないよう、少しずつ進める
    const job = createAimJob(s, 0)
    setSnap(job.snapshot())
    const tick = () => {
      if (cancelled) return
      const done = job.step(10)
      setSnap(job.snapshot())
      if (done) setBusy(false)
      else timer = setTimeout(tick, 0)
    }
    timer = setTimeout(tick, 20)
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig])
  return { snap, busy }
}

function Tiles({ kinds, dim }: { kinds: Kind[]; dim?: boolean }) {
  return (
    <span className="aim-tiles">
      {kinds.map((k) => (
        <TileView key={k} kind={k} dim={dim} className="tile-xs" />
      ))}
    </span>
  )
}

function hanChip(r: AimRow, open: boolean): string {
  if (r.yakuman) return '役満'
  if (open) return `${r.openHan}翻`
  if (r.closedOnly) return `${r.han}翻・門前のみ`
  return r.han === r.openHan ? `${r.han}翻` : `${r.han}翻（鳴くと${r.openHan}翻）`
}

const pctText = (p: number | null) => (p === null ? '…' : p < 0.005 ? '<1%' : `${Math.round(p * 100)}%`)

function probClass(p: number | null): string {
  if (p === null) return 'p-wait'
  if (p >= 0.5) return 'p-high'
  if (p >= 0.25) return 'p-mid'
  return 'p-low'
}

function Row({ r, open, expanded, onToggle }: { r: AimRow; open: boolean; expanded: boolean; onToggle: () => void }) {
  const info = YAKU_BY_ID[r.id]
  const pct = r.prob === null ? 0 : Math.max(r.prob > 0 ? 2 : 0, Math.round(r.prob * 100))
  return (
    <div className={`aim-row ${expanded ? 'open' : ''}`}>
      <button className="aim-row-main" onClick={onToggle} aria-expanded={expanded}>
        <span className="aim-name">{r.label}</span>
        <span className="aim-han">{hanChip(r, open)}</span>
        <span className={`aim-pct ${probClass(r.prob)}`}>{pctText(r.prob)}</span>
        <span className="aim-bar">
          <span className={probClass(r.prob)} style={{ width: `${pct}%` }} />
        </span>
        <span className="aim-sub">{r.dist < 0 ? '完成しています！' : r.lines[0]}</span>
        <span className="aim-caret">{expanded ? '▲' : '▼'}</span>
      </button>
      {expanded ? (
        <div className="aim-detail">
          {info ? (
            <p className="aim-desc">
              <b>{info.name}</b>（{info.reading}）：{info.desc}
            </p>
          ) : null}
          {info?.example ? (
            <div className="aim-example">
              <span className="aim-k">例</span>
              <Tiles kinds={parseKinds(info.example.replace(/[^0-9mpsz]/g, ''))} />
            </div>
          ) : null}
          {r.lines.slice(1).map((l, i) => (
            <p key={i} className="aim-line">
              {l}
            </p>
          ))}
          {r.needed.length > 0 && r.dist >= 0 ? (
            <div className="aim-kv">
              <span className="aim-k">引くと進む牌</span>
              <span className="aim-need-list">
                {r.needed.slice(0, 8).map((n) => (
                  <span key={n.kind} className="aim-need">
                    <TileView kind={n.kind} className="tile-xs" />
                    <small>残{n.remaining}</small>
                  </span>
                ))}
                {r.needed.length > 8 ? <small className="aim-more">ほか{r.needed.length - 8}種</small> : null}
              </span>
            </div>
          ) : null}
          {r.keep.length > 0 && r.dist >= 0 ? (
            <div className="aim-kv">
              <span className="aim-k">残したい牌</span>
              <Tiles kinds={r.keep} />
            </div>
          ) : null}
          {r.junk.length > 0 && r.dist >= 0 ? (
            <div className="aim-kv">
              <span className="aim-k">この役には不要な牌</span>
              <Tiles kinds={r.junk} dim />
            </div>
          ) : null}
          <p className="aim-tip">💡 {r.tip}</p>
          {r.closedOnly ? <p className="aim-line warn">鳴くとこの役は成立しません。</p> : null}
        </div>
      ) : null}
    </div>
  )
}

export function AimPanel({ s, onClose }: { s: GameState; onClose: () => void }) {
  const { snap, busy } = useAimSnapshot(s)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [showLow, setShowLow] = useState(false)
  const p = s.players[0]
  const open = p.melds.some((m) => m.type !== 'ankan')

  // ドラの枚数（手牌と副露）
  const doras = doraIndicators(s).map((t) => doraFromIndicator(kindOf(t)))
  const mine = [...p.hand, ...p.melds.flatMap((m) => m.tiles)]
  const doraCount = mine.filter((t) => doras.includes(kindOf(t))).length
  const redCount = mine.filter((t) => isRedTile(t)).length

  const rows = (snap?.rows ?? []).slice().sort((a, b) => {
    if (a.prob === null || b.prob === null) return a.dist - b.dist
    return b.prob - a.prob || a.dist - b.dist
  })
  const main = rows.filter((r) => r.prob === null || r.prob >= 0.03 || r.dist <= 1)
  const low = rows.filter((r) => !main.includes(r))

  return (
    <div className="table aim-view">
      <div className="aim-head">
        <div className="aim-title">🎯 いま狙える役</div>
        <button className="aim-close" onClick={onClose}>
          卓にもどる
        </button>
      </div>
      <div className="aim-meta">
        <span>
          ドラ <b>{doraCount}</b>枚{redCount > 0 ? `（赤${redCount}）` : ''}
        </span>
        <span className="aim-busy">{busy ? '計算中…' : '計算ずみ'}</span>
      </div>
      <p className="aim-note">
        {snap?.summary ?? '計算中…'}他家の和了で局が終わることも考えた目安です。役名をタップすると詳細が見られます。
      </p>
      <div className="aim-list">
        {main.map((r) => (
          <Row key={r.key} r={r} open={open} expanded={expanded === r.key} onToggle={() => setExpanded(expanded === r.key ? null : r.key)} />
        ))}
        {rows.length === 0 && !busy ? <p className="aim-empty">今の手から狙える役は、まだ見つかりません。手が進むと表示されます。</p> : null}
        {low.length > 0 ? (
          <div className="aim-low">
            {main.length === 0 && !busy ? (
              <p className="aim-empty">今の手では、見込みの高い役はありません。見込みが低い順に並べています。</p>
            ) : (
              <button className="link-btn" onClick={() => setShowLow(!showLow)}>
                {showLow ? '▼' : '▶'} 見込みが低い役（{low.length}）
              </button>
            )}
            {showLow || (main.length === 0 && !busy)
              ? low.map((r) => (
                  <Row key={r.key} r={r} open={open} expanded={expanded === r.key} onToggle={() => setExpanded(expanded === r.key ? null : r.key)} />
                ))
              : null}
          </div>
        ) : null}
        {rows.length > 0 && !p.melds.length ? (
          <p className="aim-foot">
            鳴くと、リーチ・平和・一盃口・七対子は狙えなくなります。表示されていない役は、今の手からは遠いので省いています。
          </p>
        ) : null}
      </div>
    </div>
  )
}


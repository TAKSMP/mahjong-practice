// 卓（4人の河・副露・点数）

import type { GameEvent, GameState, Meld } from '../engine/game'
import { liveRemaining, roundLabel, seatWindIndex, WIND_JP } from '../engine/game'
import { kindOf } from '../engine/tiles'
import { TileView } from './Tile'

/** 席 seat を、画面上の位置（0=下 1=右 2=上 3=左）に */
const relPos = (seat: number) => seat % 4

export function MeldView({ meld, seat, small }: { meld: Meld; seat: number; small?: boolean }) {
  const s = meld
  const rel = s.from !== undefined ? (s.from - seat + 4) % 4 : -1
  // 上家から → 左端、対面から → 真ん中、下家から → 右端 を横向きに
  const tiles = s.tiles.slice()
  let sideIndex = -1
  if (s.called !== undefined) {
    const others = tiles.filter((t) => t !== s.called)
    const idx = rel === 3 ? 0 : rel === 2 ? 1 : others.length
    tiles.splice(0, tiles.length, ...others)
    tiles.splice(idx, 0, s.called)
    sideIndex = idx
  }
  return (
    <div className={`meld ${small ? 'meld-small' : ''}`}>
      {tiles.map((t, i) => {
        const back = s.type === 'ankan' && (i === 0 || i === 3)
        const side = i === sideIndex || (s.type === 'kakan' && i === tiles.length - 1)
        return <TileView key={t} kind={kindOf(t)} red={meld.tiles.includes(t) && redSet.has(t)} back={back} sideways={side} />
      })}
    </div>
  )
}

// 赤ドラの集合（描画用・各画面で設定）
let redSet = new Set<number>()
export function setRedTiles(ids: number[]) {
  redSet = new Set(ids)
}
export const isRedTile = (t: number) => redSet.has(t)

export function Table({ s, bubble, lastDiscard }: { s: GameState; bubble: GameEvent | null; lastDiscard: { seat: number; index: number } | null }) {
  setRedTiles(s.redTiles)
  const ph = s.phase
  const remaining = liveRemaining(s)
  return (
    <div className="table">
      <div className="center-box">
        {[2, 3, 0, 1].map((seat) => {
          const p = s.players[seat]
          const wind = seatWindIndex(s, seat)
          const isTurn = (ph.type === 'action' || ph.type === 'draw') && s.turn === seat
          return (
            <div key={seat} className={`seat-info seat-pos${seat} ${isTurn ? 'seat-turn' : ''} ${wind === 0 ? 'seat-dealer' : ''}`}>
              <span className="seat-wind">{WIND_JP[wind]}</span>
              <span className="seat-score">{p.score}</span>
              {p.riichi ? <span className="riichi-stick" /> : null}
            </div>
          )
        })}
        {bubble ? (
          <div key={bubble.seq} className={`bubble bubble-${bubble.kind}`}>
            {s.players[bubble.seat].name} {bubble.text}
          </div>
        ) : null}
        <div className="center-mid">
          <div className="center-round">{roundLabel(s)}</div>
          <div className="center-sub">
            {s.honba}本場{s.riichiSticks > 0 ? `・供託${s.riichiSticks}` : ''}
          </div>
          <div className="center-remaining">残り {remaining}</div>
        </div>
      </div>
      {s.players.map((p, seat) => {
        const r = relPos(seat)
        const rows: (typeof p.discards)[] = []
        p.discards.forEach((d, i) => {
          const row = Math.min(Math.floor(i / 6), 3)
          ;(rows[row] ??= []).push(d)
        })
        return (
          <div key={seat} className={`zone zone-r${r}`}>
            <div className="river">
              {rows.map((row, ri) => (
                <div className="river-row" key={ri}>
                  {row.map((d) => {
                    const idx = p.discards.indexOf(d)
                    const isLast = lastDiscard && lastDiscard.seat === seat && lastDiscard.index === idx
                    return (
                      <TileView
                        key={d.tile}
                        kind={kindOf(d.tile)}
                        red={redSet.has(d.tile)}
                        sideways={d.riichi || idx === p.riichiIndex}
                        dim={d.calledBy !== null}
                        className={`${isLast ? 'tile-last' : ''} ${d.tsumogiri ? 'tile-tsumogiri' : ''}`}
                      />
                    )
                  })}
                </div>
              ))}
            </div>
            {seat !== 0 && p.melds.length > 0 ? (
              <div className="opp-melds">
                {p.melds.map((m, i) => (
                  <MeldView key={i} meld={m} seat={seat} small />
                ))}
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

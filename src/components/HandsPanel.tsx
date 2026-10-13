// 相手（または全員）の手牌を、表向きで見せる帯。
// 「相手の手牌を見るモード」の対局中と、局の終わり・終局のあとに使う。
// テンパイ・待ち・フリテンも添えるので、「相手が何を狙っていたか」の勉強になる。

import { WIND_JP, seatWindIndex, type GameState } from '../engine/game'
import { handStatus } from '../engine/handInfo'
import { kindOf, sortTiles } from '../engine/tiles'
import { MeldView, isRedTile, setRedTiles } from './Table'
import { TileView } from './Tile'

function HandRow({ s, seat }: { s: GameState; seat: number }) {
  const p = s.players[seat]
  const drawn = p.drawn !== null && p.hand.includes(p.drawn) ? p.drawn : null
  const base = sortTiles(
    p.hand.filter((t) => t !== drawn),
    new Set(s.redTiles),
  )
  const st = handStatus(s, seat)
  const wind = seatWindIndex(s, seat)
  return (
    <div className={`hands-row ${seat === 0 ? 'hands-me' : ''}`}>
      <div className="hands-head">
        <span className="hands-name">
          {p.name}
          <b className={wind === 0 ? 'dealer' : ''}>{WIND_JP[wind]}</b>
        </span>
        <span className="hands-score">{p.score}</span>
        {st.riichi ? <span className="hands-chip chip-riichi">リーチ</span> : null}
        <span className={`hands-status ${st.tenpai ? 'tenpai' : ''}`}>{st.text}</span>
        {st.furiten ? <span className="hands-chip chip-furiten">フリテン</span> : null}
      </div>
      <div className="hands-body">
        <div className="hands-tiles">
          {base.map((t) => (
            <TileView key={t} kind={kindOf(t)} red={isRedTile(t)} />
          ))}
          {drawn !== null ? (
            <>
              <span className="hands-gap" />
              <TileView kind={kindOf(drawn)} red={isRedTile(drawn)} />
            </>
          ) : null}
        </div>
        {p.melds.length > 0 ? (
          <div className="hands-melds">
            {p.melds.map((m, i) => (
              <MeldView key={i} meld={m} seat={seat} small />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}

/**
 * seats の手牌を表向きで見せる。
 * variant: 'live' = 対局中の帯（卓の下） / 'result' = 結果画面の中
 */
export function HandsPanel({ s, seats, variant }: { s: GameState; seats: number[]; variant: 'live' | 'result' }) {
  setRedTiles(s.redTiles)
  return (
    <div className={`hands-panel hands-${variant}`}>
      {seats.map((seat) => (
        <HandRow key={seat} s={s} seat={seat} />
      ))}
    </div>
  )
}

// 局の結果・終局の結果

import { useState } from 'react'
import type { Feedback } from '../engine/advisor'
import { type GameState, type WinRecord, seatWindIndex, WIND_JP } from '../engine/game'
import { doraFromIndicator, kindLabel, kindOf, sortTiles } from '../engine/tiles'
import { YAKU_BY_ID } from '../engine/yakuData'
import { paymentLabel } from '../engine/yaku'
import { MeldView, isRedTile } from './Table'
import { TileView } from './Tile'

const WAIT_JP: Record<string, string> = {
  ryanmen: '両面待ち',
  kanchan: '嵌張（カンチャン）待ち',
  penchan: '辺張（ペンチャン）待ち',
  tanki: '単騎待ち',
  shanpon: 'シャンポン待ち',
  chiitoi: '七対子の単騎待ち',
  kokushi: '国士無双',
}

function HandLine({ hand, melds, seat, winTile }: { hand: number[]; melds: WinRecord['melds']; seat: number; winTile?: number }) {
  const closed = sortTiles(
    winTile !== undefined ? hand.filter((t) => t !== winTile) : hand,
    new Set(hand.filter(isRedTile)),
  )
  return (
    <div className="result-hand">
      <div className="result-closed">
        {closed.map((t) => (
          <TileView key={t} kind={kindOf(t)} red={isRedTile(t)} />
        ))}
        {winTile !== undefined ? (
          <>
            <span className="gap" />
            <TileView kind={kindOf(winTile)} red={isRedTile(winTile)} className="tile-win" />
          </>
        ) : null}
      </div>
      {melds.length > 0 ? (
        <div className="result-melds">
          {melds.map((m, i) => (
            <MeldView key={i} meld={m} seat={seat} small />
          ))}
        </div>
      ) : null}
    </div>
  )
}

function WinBlock({ s, w }: { s: GameState; w: WinRecord }) {
  const [openYaku, setOpenYaku] = useState<string | null>(null)
  const [showFu, setShowFu] = useState(false)
  const r = w.result
  const isDealer = seatWindIndex(s, w.winner) === 0
  const total = w.from === null ? paymentLabel(r.base, isDealer, true) : paymentLabel(r.base, isDealer, false)
  return (
    <div className="win-block">
      <div className="win-who">
        {s.players[w.winner].name}（{WIND_JP[seatWindIndex(s, w.winner)]}家{isDealer ? '・親' : ''}）
        {w.from === null ? ' ツモ' : ` ← ${s.players[w.from].name}`}
      </div>
      <HandLine hand={w.hand} melds={w.melds} seat={w.winner} winTile={w.tile} />
      <div className="yaku-list">
        {r.yaku.map((y, i) => {
          const info = YAKU_BY_ID[y.id]
          const key = `${y.name}-${i}`
          return (
            <div key={key} className="yaku-row" onClick={() => setOpenYaku(openYaku === key ? null : key)}>
              <div className="yaku-main">
                <span className="yaku-name">{y.name}</span>
                <span className="yaku-han">{y.yakuman ? (y.yakuman > 1 ? 'ダブル役満' : '役満') : `${y.han}翻`}</span>
              </div>
              {openYaku === key && info ? <div className="yaku-desc">{info.reading}：{info.desc}</div> : null}
            </div>
          )
        })}
        {!r.yakuman && r.dora > 0 ? (
          <div className="yaku-row">
            <div className="yaku-main">
              <span className="yaku-name">ドラ</span>
              <span className="yaku-han">{r.dora}翻</span>
            </div>
          </div>
        ) : null}
        {!r.yakuman && r.aka > 0 ? (
          <div className="yaku-row">
            <div className="yaku-main">
              <span className="yaku-name">赤ドラ</span>
              <span className="yaku-han">{r.aka}翻</span>
            </div>
          </div>
        ) : null}
        {!r.yakuman && r.ura > 0 ? (
          <div className="yaku-row">
            <div className="yaku-main">
              <span className="yaku-name">裏ドラ</span>
              <span className="yaku-han">{r.ura}翻</span>
            </div>
          </div>
        ) : null}
      </div>
      <div className="win-total">
        {r.yakuman ? r.limit : `${r.han}翻 ${r.fu}符${r.limit ? ` ${r.limit}` : ''}`}
        <span className="win-points">{total}</span>
      </div>
      <div className="win-hint">役名をタップすると説明が出ます。 待ちの形: {WAIT_JP[r.wait] ?? r.wait}</div>
      {!r.yakuman && r.fuDetail.length > 0 ? (
        <div className="fu-box">
          <button className="link-btn" onClick={() => setShowFu(!showFu)}>
            {showFu ? '▼' : '▶'} 符の内訳（点数の細かい計算）
          </button>
          {showFu ? (
            <div className="fu-detail">
              {r.fuDetail.map((f, i) => (
                <div key={i} className="fu-row">
                  <span>{f.label}</span>
                  <span>{f.fu}符</span>
                </div>
              ))}
              <div className="fu-note">合計を10符単位に切り上げて {r.fu}符。翻と符から点数が決まります（5翻以上は満貫などの固定点）。</div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

const VERDICT_JP = { best: '最善', good: '良い', soso: 'もう一歩', bad: '要注意' } as const

/** 結果を隠して、卓（最後の河）を見るためのボタン */
function HideButton({ onHide }: { onHide: () => void }) {
  return (
    <button className="hide-btn" onClick={onHide}>
      👁 卓を見る
    </button>
  )
}

export function RoundResultOverlay({
  s,
  feedback,
  onNext,
  onUndo,
  onHide,
}: {
  s: GameState
  feedback: Feedback[]
  onNext: () => void
  onUndo?: () => void
  onHide: () => void
}) {
  const res = s.roundResult!
  const counts = { best: 0, good: 0, soso: 0, bad: 0 }
  for (const f of feedback) counts[f.verdict]++
  const badOnes = feedback.filter((f) => f.verdict === 'bad' || f.verdict === 'soso')
  return (
    <div className="overlay">
      <div className="overlay-card">
        <div className="result-top">
          <div className={`result-title result-${res.type}`}>{res.title}</div>
          <HideButton onHide={onHide} />
        </div>
        <div className="dora-line">
          <span>ドラ表示牌</span>
          {res.doraIndicators.map((t) => (
            <TileView key={t} kind={kindOf(t)} className="tile-xs" />
          ))}
          <span className="dora-arrow">→ ドラ {res.doraIndicators.map((t) => kindLabel(doraFromIndicator(kindOf(t)))).join('・')}</span>
        </div>
        {res.uraIndicators.length > 0 && res.wins.some((w) => s.players[w.winner].riichi) ? (
          <div className="dora-line">
            <span>裏ドラ表示牌</span>
            {res.uraIndicators.map((t) => (
              <TileView key={t} kind={kindOf(t)} className="tile-xs" />
            ))}
          </div>
        ) : null}
        {res.wins.map((w, i) => (
          <WinBlock key={i} s={s} w={w} />
        ))}
        {res.type === 'draw' ? (
          <div className="draw-block">
            {res.nagashi.length > 0 ? <div className="draw-note">流し満貫：捨て牌がすべて1・9・字牌で、鳴かれなかった！</div> : null}
            {s.players.map((p, i) => (
              <div key={i} className="draw-row">
                <div className="draw-name">
                  {p.name} <span className={res.tenpai[i] ? 'tenpai' : 'noten'}>{res.tenpai[i] ? 'テンパイ' : 'ノーテン'}</span>
                </div>
                {res.tenpai[i] ? <HandLine hand={res.hands[i]} melds={p.melds} seat={i} /> : null}
              </div>
            ))}
            <div className="draw-note">流局時はノーテンの人がテンパイの人に合計3000点を払います（ノーテン罰符）。</div>
          </div>
        ) : null}
        {res.type === 'abort' ? <div className="draw-note">途中流局は点数の移動なしで、同じ親でやり直しになります（本場が1つ増えます）。</div> : null}
        <div className="score-table">
          {s.players.map((p, i) => {
            const d = res.scoreDelta[i]
            return (
              <div key={i} className="score-row">
                <span className="score-name">
                  {WIND_JP[seatWindIndex(s, i)]} {p.name}
                </span>
                <span className="score-val">{res.scoresAfter[i]}</span>
                <span className={`score-delta ${d > 0 ? 'plus' : d < 0 ? 'minus' : ''}`}>{d > 0 ? `+${d}` : d < 0 ? `${d}` : '±0'}</span>
              </div>
            )
          })}
        </div>
        {feedback.length > 0 ? (
          <div className="review-box">
            <div className="review-title">この局のあなたの打牌</div>
            <div className="review-counts">
              {(Object.keys(counts) as (keyof typeof counts)[]).map((k) => (
                <span key={k} className={`vbadge v-${k}`}>
                  {VERDICT_JP[k]} {counts[k]}
                </span>
              ))}
            </div>
            {badOnes.slice(-3).map((f, i) => (
              <div key={i} className="review-item">
                <b>
                  {kindLabel(f.chosenKind)}切り（{VERDICT_JP[f.verdict]}）
                </b>
                ：{f.lines[0]}
              </div>
            ))}
          </div>
        ) : null}
        <div className="overlay-buttons">
          {onUndo ? (
            <button className="btn btn-sub" onClick={onUndo}>
              ↩ 待った（最後の打牌からやり直す）
            </button>
          ) : null}
          <button className="btn btn-main" onClick={onNext}>
            {s.next?.over ? '最終結果へ' : '次の局へ'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function GameEndOverlay({ s, onAgain, onTitle, onHide }: { s: GameState; onAgain: () => void; onTitle: () => void; onHide: () => void }) {
  const f = s.final!
  return (
    <div className="overlay">
      <div className="overlay-card">
        <div className="result-top">
          <div className="result-title result-win">終局</div>
          <HideButton onHide={onHide} />
        </div>
        <div className="final-table">
          {f.order.map((seat, rank) => (
            <div key={seat} className={`final-row ${seat === 0 ? 'final-me' : ''}`}>
              <span className="final-rank">{rank + 1}位</span>
              <span className="final-name">{s.players[seat].name}</span>
              <span className="final-score">{f.scores[seat]}</span>
              <span className={`final-pt ${f.points[seat] >= 0 ? 'plus' : 'minus'}`}>
                {f.points[seat] >= 0 ? '+' : ''}
                {f.points[seat].toFixed(1)}
              </span>
            </div>
          ))}
        </div>
        <div className="draw-note">右の数字は、ウマ・オカ込みの成績（1000点＝1.0）です。</div>
        <div className="overlay-buttons">
          <button className="btn btn-sub" onClick={onTitle}>
            タイトルへ
          </button>
          <button className="btn btn-main" onClick={onAgain}>
            もう一度遊ぶ
          </button>
        </div>
      </div>
    </div>
  )
}

// 答えたあとの「エンジンによる計算」の表示（受け入れ・待ち・安全度・点数）

import { useMemo } from 'react'
import { TileView } from '../../components/Tile'
import { kindLabel, parseKinds, type Kind } from '../../engine/tiles'
import {
  analyzeDiscards,
  analyzeSafety,
  analyzeScore,
  analyzeWait,
  bestEfficiency,
  shantenOfHand,
  type SafeRow,
} from '../../quiz/analyze'
import type { ChoiceQ, DiscardQ, SafeQ, ScoreQ, WaitQ } from '../../quiz/types'
import { rd } from '../../reading'
import { shantenText } from '../../quiz/util'
import { TileRow } from './TileRow'

/** 牌＋枚数のチップ */
function Chip({ kind, n, red }: { kind: Kind; n?: number; red?: boolean }) {
  return (
    <span className="q-chip">
      <span className="q-t-xs">
        <TileView kind={kind} red={red} />
      </span>
      {n !== undefined ? <i>×{n}</i> : null}
    </span>
  )
}

// ------------------------------------------------------------------ 何切る

export function DiscardExplain({ q, pickKind }: { q: DiscardQ; pickKind: Kind | null }) {
  const rows = useMemo(() => analyzeDiscards(q), [q])
  const best = useMemo(() => new Set(bestEfficiency(rows)), [rows])
  const ans = new Set(parseKinds(q.answers))
  const acc = new Set(parseKinds(q.accept ?? ''))
  // 上位の行 ＋ 正解 ＋ あなたの選んだ牌
  const shown = rows.filter((r, i) => i < 5 || ans.has(r.kind) || acc.has(r.kind) || r.kind === pickKind)
  const hidden = rows.length - shown.length
  return (
    <div className="q-explain">
      <div className="q-explain-title">🔎 切ったあとの形（エンジンで計算）</div>
      <div className="q-explain-sub">牌ごとに、切ったあとのシャンテン数と、引くと進む牌（有効牌）の残り枚数です。</div>
      {shown.map((r) => {
        const isAns = ans.has(r.kind)
        const isAcc = acc.has(r.kind)
        const isPick = r.kind === pickKind
        return (
          <div key={r.kind} className={`q-erow ${isAns ? 'is-ans' : ''} ${isPick ? 'is-pick' : ''}`}>
            <div className="q-erow-tile q-t-s">
              <TileView kind={r.kind} />
            </div>
            <div className="q-erow-main">
              <div className="q-erow-head">
                <b>{kindLabel(r.kind)}</b>を切る → <b>{shantenText(r.shanten)}</b>
                {r.shanten >= 0 ? <span>　{r.shanten === 0 ? '待ち' : '有効牌'} <b>{r.total}</b>枚</span> : null}
                {isAns ? <em className="q-badge ans">正解</em> : null}
                {!isAns && isAcc ? <em className="q-badge acc">別解</em> : null}
                {!isAns && !isAcc && best.has(r.kind) ? <em className="q-badge tie">効率は同じ</em> : null}
                {isPick ? <em className="q-badge pick">あなた</em> : null}
              </div>
              {r.tiles.length > 0 ? (
                <div className="q-chips">
                  {r.tiles.map((t) => (
                    <Chip key={t.kind} kind={t.kind} n={t.remaining} />
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        )
      })}
      {hidden > 0 ? <div className="q-explain-sub">ほか {hidden} 種類の牌は、これより受け入れが少なくなります。</div> : null}
    </div>
  )
}

// ------------------------------------------------------------------ 待ち

export function WaitExplain({ q, picked }: { q: WaitQ; picked: Kind[] }) {
  const info = useMemo(() => analyzeWait(q), [q])
  const total = info.waits.reduce((a, w) => a + w.remaining, 0)
  const pickedSet = new Set(picked)
  const waitSet = new Set(info.waits.map((w) => w.kind))
  const wrongPicks = picked.filter((k) => !waitSet.has(k))
  const missed = info.waits.filter((w) => !pickedSet.has(w.kind))
  return (
    <div className="q-explain">
      <div className="q-explain-title">🔎 待ちの牌（エンジンで計算）</div>
      <div className="q-chips big">
        {info.waits.map((w) => (
          <Chip key={w.kind} kind={w.kind} n={w.remaining} />
        ))}
      </div>
      <div className="q-explain-sub">
        待ちは {info.waits.length} 種類、残りは合計 <b>{total}</b> 枚（自分の手牌と見えている牌を除いた枚数）。
      </div>
      {wrongPicks.length > 0 ? (
        <div className="q-explain-sub bad">
          待ちではない牌を選んでいます：{wrongPicks.map((k) => kindLabel(k)).join('・')}
        </div>
      ) : null}
      {missed.length > 0 && picked.length > 0 ? (
        <div className="q-explain-sub bad">選び忘れ：{missed.map((w) => kindLabel(w.kind)).join('・')}</div>
      ) : null}
    </div>
  )
}

// ------------------------------------------------------------------ 安全度

const RISK_CLASS = (r: number) => (r <= 0 ? 'r0' : r <= 5 ? 'r1' : r <= 14 ? 'r2' : r <= 23 ? 'r3' : 'r4')

function SafeTable({ rows, ans, pick, only }: { rows: SafeRow[]; ans: Set<Kind>; pick: Kind | null; only?: Set<Kind> }) {
  const list = only ? rows.filter((r) => only.has(r.kind)) : rows
  return (
    <>
      {list.map((r) => {
        const isAns = ans.has(r.kind)
        const isPick = r.kind === pick
        return (
          <div key={r.kind} className={`q-srow ${isAns ? 'is-ans' : ''} ${isPick ? 'is-pick' : ''}`}>
            <div className="q-t-s">
              <TileView kind={r.kind} />
            </div>
            <span className={`q-risk ${RISK_CLASS(r.risk)}`}>{r.label}</span>
            <span className="q-srow-detail">{isAns || isPick || only ? r.detail : ''}</span>
            {isAns ? <em className="q-badge ans">正解</em> : null}
            {isPick ? <em className="q-badge pick">あなた</em> : null}
          </div>
        )
      })}
    </>
  )
}

export function SafeExplain({ q, pickKind }: { q: SafeQ; pickKind: Kind | null }) {
  const rows = useMemo(() => analyzeSafety(q), [q])
  const ans = new Set(parseKinds(q.answers))
  return (
    <div className="q-explain">
      <div className="q-explain-title">🔎 手牌の安全度（目安）</div>
      <div className="q-explain-sub">リーチした人の河と見えている牌から、放銃しにくい順に並べています。</div>
      <SafeTable rows={rows} ans={ans} pick={pickKind} />
      <div className="q-explain-sub">※ 安全度は「現物・スジ・カベ・字牌の見え方」から出した目安です。</div>
    </div>
  )
}

/** 「いちばん危険な牌は？」の答え合わせ */
export function DangerExplain({ q, pickIndex }: { q: ChoiceQ; pickIndex: number | null }) {
  const v = q.verify
  const rows = useMemo(() => (v?.kind === 'danger' ? analyzeSafety({ river: v.river, hand: v.hand, seen: v.seen }) : []), [v])
  if (v?.kind !== 'danger') return null
  const cand = parseKinds(v.candidates)
  const only = new Set(cand)
  const highest = new Set(parseKinds(v.highest))
  const pick = pickIndex === null ? null : cand[pickIndex]
  // 危険な順に並べる
  const ordered = rows.slice().reverse()
  return (
    <div className="q-explain">
      <div className="q-explain-title">🔎 4つの牌の危険度（目安）</div>
      <SafeTable rows={ordered} ans={highest} pick={pick} only={only} />
    </div>
  )
}

// ------------------------------------------------------------------ 残り枚数・フリテン

export function RemainingExplain({ q }: { q: ChoiceQ }) {
  const v = q.verify
  const info = useMemo(
    () => (v?.kind === 'remaining' ? analyzeWait({ hand: v.hand, show: [{ label: '', tiles: v.visible }] }) : null),
    [v],
  )
  if (!info) return null
  const total = info.waits.reduce((a, w) => a + w.remaining, 0)
  return (
    <div className="q-explain">
      <div className="q-explain-title">🔎 待ちの残り枚数（エンジンで計算）</div>
      <div className="q-chips big">
        {info.waits.map((w) => (
          <Chip key={w.kind} kind={w.kind} n={w.remaining} />
        ))}
      </div>
      <div className="q-explain-sub">
        合計 <b>{total}</b> 枚
      </div>
    </div>
  )
}

export function FuritenExplain({ q }: { q: ChoiceQ }) {
  const v = q.verify
  const info = useMemo(() => (v?.kind === 'furiten' ? analyzeWait({ hand: v.hand, river: v.river }) : null), [v])
  if (v?.kind !== 'furiten' || !info) return null
  const river = new Set(parseKinds(v.river))
  return (
    <div className="q-explain">
      <div className="q-explain-title">🔎 待ちと、自分の河（エンジンで確認）</div>
      <div className="q-chips big">
        {info.waits.map((w) => (
          <span key={w.kind} className={`q-chip ${river.has(w.kind) ? 'in-river' : ''}`}>
            <span className="q-t-xs">
              <TileView kind={w.kind} />
            </span>
            <i>{river.has(w.kind) ? '河にある' : '河になし'}</i>
          </span>
        ))}
      </div>
      <div className="q-explain-sub">{info.furiten ? '待ちの牌が自分の河にあるので、フリテンです。' : 'フリテンではありません。'}</div>
    </div>
  )
}

// ------------------------------------------------------------------ 点数

export function ScoreExplain({ q }: { q: ScoreQ }) {
  const info = useMemo(() => analyzeScore(q), [q])
  if (!info) return null
  const r = info.res
  return (
    <div className="q-explain">
      <div className="q-explain-title">🔎 この手の点数（エンジンで計算）</div>
      <table className="q-score">
        <tbody>
          {r.yaku.map((y, i) => (
            <tr key={i}>
              <td>{y.name}</td>
              <td>{y.yakuman ? '役満' : `${y.han}翻`}</td>
            </tr>
          ))}
          {r.dora > 0 ? (
            <tr>
              <td>ドラ</td>
              <td>{r.dora}翻</td>
            </tr>
          ) : null}
          {r.aka > 0 ? (
            <tr>
              <td>赤ドラ</td>
              <td>{r.aka}翻</td>
            </tr>
          ) : null}
          <tr className="sum">
            <td>合計</td>
            <td>
              {r.han}翻 {r.fu}符{r.limit ? `（${r.limit}）` : ''}
            </td>
          </tr>
          <tr className="sum">
            <td>点数</td>
            <td>{info.pointLabel}</td>
          </tr>
        </tbody>
      </table>
      {r.fuDetail.length > 0 ? (
        <div className="q-explain-sub">
          符の内訳：{r.fuDetail.map((f) => `${f.label} ${f.fu}符`).join('、')}
        </div>
      ) : null}
    </div>
  )
}

// ------------------------------------------------------------------ シャンテン数の比較

export function FactsExplain({ q }: { q: ChoiceQ }) {
  const facts = q.facts
  const rows = useMemo(() => (facts ?? []).map((f) => ({ f, s: shantenOfHand(f.hand, f.melds ?? 0) })), [facts])
  if (rows.length === 0) return null
  return (
    <div className="q-explain">
      <div className="q-explain-title">🔎 シャンテン数の変化（エンジンで計算）</div>
      {rows.map(({ f, s }, i) => (
        <div key={i} className="q-frow">
          <div className="q-frow-label">{rd(f.label)}</div>
          <TileRow tiles={f.hand} size="s" named />
          <div className="q-frow-val">
            {f.melds ? `（副露${f.melds}つ）` : ''} → <b>{shantenText(s)}</b>
          </div>
        </div>
      ))}
    </div>
  )
}


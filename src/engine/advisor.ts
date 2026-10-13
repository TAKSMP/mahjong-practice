// 打ち筋サポート（初心者向けの解説文を作る）
//  - 打つ前のヒント: 各牌を切るとどうなるか / おすすめの牌
//  - 打った直後の指摘: 選んだ牌と最善手の比較
//  - 鳴き・リーチ・和了の判断の助言

import { cpuCallAction } from './ai'
import { evaluateDiscards, recommend, waitDetails, type DiscardEval, type Policy, type Recommendation } from './analysis'
import {
  buildWinInput,
  getTurnOptions,
  isOpen,
  visibleCounts,
  type CallAction,
  type CallOptions,
  type GameState,
  type TurnOptions,
} from './game'
import { threats } from './safety'
import { shanten, ukeire } from './shanten'
import { kindLabel, kindOf, toCounts, type Kind, type Tile } from './tiles'
import { calcPayment, evaluateWin, paymentLabel, type WinResult } from './yaku'

export function shantenText(n: number): string {
  if (n < 0) return '和了'
  if (n === 0) return 'テンパイ'
  return `${n}シャンテン`
}

export function shantenHelp(n: number): string {
  if (n < 0) return '和了の形です'
  if (n === 0) return 'あと1枚で和了'
  return `あと${n}枚でテンパイ`
}

export function kindsText(kinds: Kind[], max = 8): string {
  const names = kinds.slice(0, max).map(kindLabel)
  return names.join('・') + (kinds.length > max ? ` ほか${kinds.length - max}種` : '')
}

export type HintTag = 'best' | 'good' | 'ok' | 'bad' | 'forbidden'

export interface TileHint {
  /** 理由に出てくる守りの用語（解説ボタン用） */
  terms: ('現物' | 'スジ' | 'カベ')[]
  eval: DiscardEval
  tag: HintTag
  /** 1 = おすすめ */
  rank: number
  /** 「これを切ると…」の短い要約 */
  summary: string
  /** 注意点 */
  notes: string[]
  /** 手牌の上に出す小さな表示（攻めなら有効牌の枚数、守りなら危険度の一文字） */
  badge: string
}

const DANGER_SHORT: Record<string, string> = { 現物: '現', ほぼ安全: '安', 比較的安全: '中', やや危険: '注', 危険: '危' }

export interface BeforeHints {
  currentShanten: number
  rec: Recommendation
  /** key = `${kind}:${red}` */
  tiles: Map<string, TileHint>
  headline: string
  detail: string[]
  turn: TurnOptions
  /** ツモ和了・リーチなどの声かけ */
  actionAdvice: string[]
}

export const evalKey = (s: GameState, t: Tile) => `${kindOf(t)}:${s.redTiles.includes(t)}`

function waitNotes(s: GameState, seat: number, e: DiscardEval): string[] {
  const notes: string[] = []
  if (e.shanten !== 0) return notes
  const p = s.players[seat]
  const open = isOpen(p)
  const discarded = new Set([...p.discards.map((d) => kindOf(d.tile)), e.kind])
  const furiten = e.waits.some((w) => discarded.has(w.kind))
  if (furiten) notes.push('⚠ フリテンになります（待ちの牌を自分で捨てている）。ロンできず、ツモでしか和了れません。')
  if (e.waits.length > 0 && e.ukeireTotal === 0) notes.push('⚠ 待ちの牌がもう残っていません（純カラ）。')
  if (open) {
    const noYaku = e.waits.filter((w) => !w.dama)
    if (noYaku.length === e.waits.length) notes.push('⚠ 役がないので、このテンパイでは和了れません。')
    else if (noYaku.length > 0) notes.push(`⚠ ${kindsText(noYaku.map((w) => w.kind))}では役がなく和了れません（片和了り）。`)
  } else if (!p.riichi) {
    const noYaku = e.waits.filter((w) => !w.dama)
    if (noYaku.length === e.waits.length) notes.push('役がないので、ロンするにはリーチが必要です（ツモなら門前ツモで和了れます）。')
  }
  return notes
}

function waitsSummary(s: GameState, seat: number, e: DiscardEval): string {
  const p = s.players[seat]
  const open = isOpen(p)
  const parts = e.waits.map((w) => {
    const pts = open || p.riichi ? w.damaPoints : w.riichiPoints
    const ptsText = pts > 0 ? ` ${pts}点${!open && !p.riichi ? '(リーチ時)' : ''}` : ' 役なし'
    return `${kindLabel(w.kind)}(残${w.remaining})${ptsText}`
  })
  return `待ち: ${parts.join(' / ')}`
}

function summarize(s: GameState, seat: number, e: DiscardEval): string {
  if (e.shanten === 0) return `テンパイ。${waitsSummary(s, seat, e)}`
  const kinds = e.ukeire.map((u) => u.kind)
  return `${shantenText(e.shanten)}（${shantenHelp(e.shanten)}）。受け入れ ${e.ukeire.length}種${e.ukeireTotal}枚: ${kindsText(kinds)}`
}

export function beforeHints(s: GameState, seat = 0, policy: Policy = 'auto'): BeforeHints {
  const p = s.players[seat]
  const evals = evaluateDiscards(s, seat, true, policy)
  const rec = recommend(s, seat, evals, policy)
  const defend = policy === 'defend'
  const turn = getTurnOptions(s, seat)
  const currentShanten = shanten(toCounts(p.hand), p.melds.length)
  const best = rec.best
  const legal = evals.filter((e) => !e.forbidden)
  const minSh = Math.min(...legal.map((e) => e.shanten))
  const bestEff = Math.max(...legal.filter((e) => e.shanten === minSh).map((e) => (isOpen(p) ? e.yakuWaitTotal : e.ukeireTotal)))
  const ranked = legal.slice().sort((a, b) => (rec.mode === 'attack' ? b.value - a.value : a.danger.score - b.danger.score || b.value - a.value))
  const tiles = new Map<string, TileHint>()
  for (const e of evals) {
    const notes = waitNotes(s, seat, e)
    let tag: HintTag
    if (e.forbidden) tag = 'forbidden'
    else if (e === best) tag = 'best'
    else if (defend) {
      // 守りの方針：安全さだけで評価（手が進むかは気にしない）
      const diff = e.danger.score - best.danger.score
      tag = diff <= 8 ? 'good' : diff <= 22 ? 'ok' : 'bad'
    } else if (e.shanten > minSh) tag = 'bad'
    else {
      const eff = isOpen(p) ? e.yakuWaitTotal : e.ukeireTotal
      tag = eff >= bestEff * 0.85 ? 'good' : 'ok'
    }
    if (!defend && e.shanten > minSh && !e.forbidden) {
      notes.unshift(minSh === 0 && e.shanten === 1 ? '⚠ テンパイが崩れます。' : `⚠ シャンテン数が戻ります（${shantenText(minSh)}→${shantenText(e.shanten)}）。`)
    }
    if (e.forbidden) notes.unshift(p.riichi ? 'リーチ中はツモった牌しか切れません。' : '喰い替えになるので、この牌は今は切れません。')
    if (e.isDora && !e.forbidden) notes.push('ドラです。持っていれば1枚につき1翻アップ。')
    if (e.isRed && !e.forbidden) notes.push('赤ドラです。持っていれば1翻アップ。')
    if (rec.threats.length > 0 && !e.forbidden) {
      const target = e.danger.target !== null ? s.players[e.danger.target].name : ''
      notes.push(`危険度：${e.danger.label}${target ? `（対${target}）` : ''}`)
      for (const r of e.danger.reasons) notes.push(`・${r}`)
    }
    const count = e.shanten === 0 ? e.yakuWaitTotal : e.ukeireTotal
    tiles.set(evalKey(s, e.tile), {
      terms: rec.threats.length > 0 && !e.forbidden ? e.danger.terms : [],
      eval: e,
      tag,
      rank: ranked.indexOf(e) + 1 || 99,
      summary: summarize(s, seat, e),
      notes,
      badge: defend ? (DANGER_SHORT[e.danger.label] ?? '') : tag === 'bad' ? '' : String(count),
    })
  }

  const actionAdvice: string[] = []
  if (turn.tsumo) {
    const r = p.drawn !== null ? evaluateWin(buildWinInput(s, seat, p.drawn, true, { noUra: true })) ?? turn.tsumo : turn.tsumo
    actionAdvice.push(`ツモ和了できます！ ${winText(r)}（${paymentLabel(r.base, seat === s.dealer, true)}${p.riichi ? '＋裏ドラ' : ''}）`)
  }
  if (currentShanten === -1 && !turn.tsumo) {
    actionAdvice.push('和了の形ですが、役がない（または鳴いた直後）ので和了れません。')
  }
  if (turn.riichiTiles.length > 0 && !turn.tsumo) {
    const kinds = [...new Set(turn.riichiTiles.map(kindOf))]
    if (defend) actionAdvice.push('テンパイですが、守りの方針なのでリーチはおすすめしません（リーチ後は牌を選べず、放銃しやすくなります）。')
    else actionAdvice.push(`テンパイ！ ${kindsText(kinds)}を切ってリーチできます。リーチすると役がなくても和了れて、裏ドラのチャンスもあります。`)
  }
  if (turn.kyuushu) actionAdvice.push('么九牌（1・9・字牌）が9種類以上あるので「九種九牌」で流局にできます。')
  if (turn.ankan.length > 0 && !p.riichi) {
    actionAdvice.push(
      defend
        ? `${kindsText(turn.ankan)}を暗槓できますが、守りの方針ではおすすめしません（ドラが増えて、相手の和了が高くなります）。`
        : `${kindsText(turn.ankan)}を暗槓できます（ドラが1枚増えます）。`,
    )
  }

  const detail: string[] = []
  let headline: string
  if (turn.tsumo) {
    headline = 'おすすめ: ツモ和了！（下のツモボタン）'
  } else if (p.riichi) {
    headline = 'リーチ中：ツモ切りで和了りを待ちます'
  } else if (rec.mode === 'attack') {
    headline = `おすすめ: ${kindLabel(best.kind)}${best.isRed ? '(赤)' : ''} を切る`
    detail.push(summarize(s, seat, best))
  } else {
    headline = `おすすめ: ${kindLabel(best.kind)} を切って${rec.mode === 'defend' ? '守る' : '回す'}`
    detail.push(rec.reason)
    detail.push(`${kindLabel(best.kind)}の危険度：${best.danger.label}`)
    for (const r of best.danger.reasons) detail.push(`・${r}`)
    if (rec.attackBest !== best) {
      detail.push(
        defend
          ? `参考：手を進めるなら ${kindLabel(rec.attackBest.kind)}（${summarize(s, seat, rec.attackBest)}）ですが、危険度は「${rec.attackBest.danger.label}」。守りの方針なので上の牌を優先します。`
          : `手を進めるだけなら ${kindLabel(rec.attackBest.kind)}（${summarize(s, seat, rec.attackBest)}）。ただし危険度は${rec.attackBest.danger.label}。`,
      )
    }
  }
  if (policy === 'attack' && rec.threats.some((t) => t.reason === 'riichi') && !turn.tsumo && !p.riichi) {
    detail.push(`（参考）${kindLabel(best.kind)}の危険度：${best.danger.label}。攻めの方針なので、危険でも和了を優先した牌です。`)
  }
  return { currentShanten, rec, tiles, headline, detail, turn, actionAdvice }
}

export function winText(r: WinResult): string {
  const yaku = r.yaku.map((y) => (y.yakuman ? y.name : `${y.name}${y.han}`)).join('・')
  if (r.yakuman) return `${yaku}（${r.limit}）`
  const dora = r.dora + r.ura + r.aka
  return `${yaku}${dora ? `・ドラ${dora}` : ''} → ${r.han}翻${r.fu}符${r.limit ? `（${r.limit}）` : ''}`
}

// ---------- 打った直後の指摘 ----------
export type Verdict = 'best' | 'good' | 'soso' | 'bad'

export interface Feedback {
  verdict: Verdict
  title: string
  lines: string[]
  chosenKind: Kind
  bestKind: Kind
  /** 解説に出てくる守りの用語（解説ボタン用） */
  terms?: ('現物' | 'スジ' | 'カベ')[]
}

/** 打牌を実行する「前」の状態で呼ぶ */
export function discardFeedback(s: GameState, seat: number, tile: Tile, riichi: boolean, policy: Policy = 'auto'): Feedback {
  const hints = beforeHints(s, seat, policy)
  const chosen = hints.tiles.get(evalKey(s, tile))!
  const best = hints.rec.best
  const ce = chosen.eval
  const p = s.players[seat]
  const lines: string[] = []
  let verdict: Verdict
  const sameKind = ce.kind === best.kind
  const mode = hints.rec.mode
  if (p.riichi) {
    return { verdict: 'best', title: 'リーチ中', lines: ['ツモ切りしました。'], chosenKind: ce.kind, bestKind: best.kind }
  }
  // 守りの方針：安全さだけで評価する（手が進むかどうかは問わない）
  if (policy === 'defend') {
    const diff = ce.danger.score - best.danger.score
    let v: Verdict
    if (sameKind || diff <= 0) v = 'best'
    else if (diff <= 8) v = 'good'
    else if (diff >= 30 || (ce.danger.score >= 36 && best.danger.score <= 15)) v = 'bad'
    else v = 'soso'
    const target = ce.danger.target !== null ? s.players[ce.danger.target].name : '相手'
    const dl: string[] = []
    if (v === 'best') {
      dl.push(`${kindLabel(ce.kind)}は「${ce.danger.label}」。守りの方針にぴったりの一打です。`)
      for (const r of ce.danger.reasons) dl.push(`・${r}`)
    } else if (v === 'good') {
      dl.push(`${kindLabel(ce.kind)}は「${ce.danger.label}」。いちばん安全な ${kindLabel(best.kind)}（${best.danger.label}）とほぼ同じくらい安全です。`)
      for (const r of ce.danger.reasons) dl.push(`・${r}`)
    } else {
      dl.push(`${kindLabel(ce.kind)}は${target}に対して「${ce.danger.label}」な牌です。`)
      for (const r of ce.danger.reasons) dl.push(`・${r}`)
      dl.push(`${kindLabel(best.kind)}なら「${best.danger.label}」でした。`)
      for (const r of best.danger.reasons) dl.push(`・${r}`)
    }
    dl.push(`（参考）切った後：${shantenText(ce.shanten)}`)
    if (riichi) dl.push('守りの方針ですが、リーチしました。放銃したときの失点は大きくなります。')
    const dTitle = { best: 'ナイス！安全な一打', good: '安全寄りの一打', soso: 'ちょっと危険', bad: '危険な一打' }[v]
    const dTerms = [...new Set([...ce.danger.terms, ...(v === 'bad' || v === 'soso' ? best.danger.terms : [])])]
    return { verdict: v, title: dTitle, lines: dl, chosenKind: ce.kind, bestKind: best.kind, terms: dTerms }
  }
  if (sameKind || chosen.tag === 'best') {
    verdict = 'best'
    if (mode === 'attack') lines.push(`${summarize(s, seat, ce)}`)
    else {
      lines.push(`${kindLabel(ce.kind)}は「${ce.danger.label}」。${hints.rec.reason}`)
      for (const r of ce.danger.reasons) lines.push(`・${r}`)
    }
  } else if (mode !== 'attack' && ce.danger.score >= 36 && best.danger.score <= 15) {
    verdict = 'bad'
    const target = ce.danger.target !== null ? s.players[ce.danger.target].name : 'リーチ者'
    lines.push(`${kindLabel(ce.kind)}は${target}に対して「${ce.danger.label}」な牌です。`)
    for (const r of ce.danger.reasons) lines.push(`・${r}`)
    lines.push(`${kindLabel(best.kind)}なら「${best.danger.label}」でした。`)
    for (const r of best.danger.reasons) lines.push(`・${r}`)
    lines.push(hints.rec.reason)
  } else if (ce.shanten > best.shanten && ce.shanten > hints.rec.attackBest.shanten) {
    verdict = 'bad'
    lines.push(
      best.shanten === 0 && ce.shanten === 1
        ? 'テンパイを崩してしまいました。'
        : `シャンテン数が戻ってしまいました（${shantenText(hints.rec.attackBest.shanten)}→${shantenText(ce.shanten)}）。`,
    )
    lines.push(`${kindLabel(best.kind)}を切れば ${summarize(s, seat, best)}`)
  } else {
    const ceEff = isOpen(p) ? ce.yakuWaitTotal : ce.ukeireTotal
    const bestEff = isOpen(p) ? best.yakuWaitTotal : best.ukeireTotal
    if (ceEff >= bestEff * 0.85) {
      verdict = 'good'
      lines.push(`ほぼ同じくらい良い選択です。${summarize(s, seat, ce)}`)
      lines.push(`最善は ${kindLabel(best.kind)}（${best.shanten === 0 ? `残り${bestEff}枚` : `受け入れ${bestEff}枚`}）。`)
    } else {
      verdict = 'soso'
      if (ce.shanten === 0) {
        lines.push(`待ちの残り枚数が ${bestEff}枚 → ${ceEff}枚 に減りました。`)
      } else {
        lines.push(`受け入れが ${bestEff}枚 → ${ceEff}枚 に減りました。`)
      }
      const lost = best.ukeire.filter((u) => !ce.ukeire.some((c) => c.kind === u.kind)).map((u) => u.kind)
      if (lost.length > 0 && ce.shanten > 0) lines.push(`${kindsText(lost)}を引いても手が進まなくなりました。`)
      lines.push(`${kindLabel(best.kind)}を切れば ${summarize(s, seat, best)}`)
    }
  }
  for (const n of chosen.notes) if (n.startsWith('⚠') && !lines.includes(n)) lines.push(n)
  if (policy === 'attack' && hints.rec.threats.some((t) => t.reason === 'riichi') && ce.danger.score >= 36) {
    lines.push(`（参考）${kindLabel(ce.kind)}は「${ce.danger.label}」。攻めの方針なので押しましたが、放銃には注意しましょう。`)
  }
  if (ce.isDora && verdict !== 'best') lines.push('ドラを手放しました。打点が下がります。')
  // リーチ判断
  const canRiichi = hints.turn.riichiTiles.some((t) => kindOf(t) === ce.kind)
  if (canRiichi && !riichi) {
    const noYaku = ce.waits.every((w) => !w.dama)
    lines.push(noYaku ? '💡 この手は役がないので、リーチしないとロンできません。' : '💡 リーチもできました（ダマで役があるので、ダマも作戦の一つ）。')
  }
  if (riichi) {
    lines.push(`リーチ！ ${waitsSummary(s, seat, ce)}`)
  }
  const title = { best: 'ナイス！最善の一打', good: 'いい感じ', soso: 'もう一歩', bad: '要注意の一打' }[verdict]
  const terms = [...new Set([...(mode !== 'attack' ? ce.danger.terms : []), ...(verdict === 'bad' && mode !== 'attack' ? best.danger.terms : [])])]
  return { verdict, title, lines, chosenKind: ce.kind, bestKind: best.kind, terms }
}

// ---------- 鳴きの助言 ----------
export interface CallAdvice {
  recommended: CallAction
  lines: string[]
}

export function callAdvice(s: GameState, seat: number, opts: CallOptions, policy: Policy = 'auto'): CallAdvice {
  const p = s.players[seat]
  const ph = s.phase
  const lines: string[] = []
  const rec: CallAction = policy === 'defend' ? { type: 'pass' } : cpuCallAction(s, seat, opts, 'strong', policy === 'attack')
  if (ph.type !== 'response') return { recommended: rec, lines }
  const k = kindOf(ph.tile)
  if (opts.ron && opts.ronResult) {
    const r = evaluateWin(buildWinInput(s, seat, ph.tile, false, { chankan: ph.kakan, noUra: true })) ?? opts.ronResult
    const pay = calcPayment(r.base, seat === s.dealer, false, s.honba)
    lines.push(`ロンできます！ ${winText(r)} → ${pay.ron}点`)
    if (policy === 'defend') lines.push('守りの方針でも、ロンできるときは和了りましょう（放銃を避けるのが目的で、和了は悪くありません）。')
    return { recommended: { type: 'ron' }, lines }
  }
  const cur = shanten(toCounts(p.hand), p.melds.length)
  const visible = visibleCounts(s, seat)
  let callBest = 99
  const describe = (label: string, used: Tile[], forbidden: Kind[]) => {
    const after = p.hand.filter((t) => !used.includes(t))
    const c = toCounts(after)
    let bestSh = 99
    let bestUk = 0
    let bestKind: Kind = -1
    for (let x = 0; x < 34; x++) {
      if (c[x] === 0 || forbidden.includes(x)) continue
      c[x]--
      const sh = shanten(c, p.melds.length + 1)
      const uk = ukeire(c, p.melds.length + 1, visible, sh).total
      if (sh < bestSh || (sh === bestSh && uk > bestUk)) {
        bestSh = sh
        bestUk = uk
        bestKind = x
      }
      c[x]++
    }
    callBest = Math.min(callBest, bestSh)
    let txt = `${label}すると ${shantenText(cur)}→${shantenText(bestSh)}`
    if (bestKind >= 0) txt += `（${kindLabel(bestKind)}を切って受け入れ${bestUk}枚）`
    lines.push(txt)
  }
  if (opts.pon.length > 0) describe('ポン', opts.pon[0], [k])
  if (opts.chi.length > 0) describe('チー', opts.chi[0], [k])
  const yakuhai = k >= 31 || k === 27 + s.roundWind || k === 27 + ((seat - s.dealer + 4) % 4)
  if (opts.pon.length > 0 && yakuhai) lines.push(`${kindLabel(k)}は役牌なので、ポンすると1翻の役が確定します。`)
  if (!isOpen(p)) lines.push('鳴くと門前でなくなり、リーチ・平和・一盃口などがつかなくなります。')
  if (rec.type === 'pass' && (opts.pon.length > 0 || opts.chi.length > 0) && policy === 'defend') {
    lines.push('守りの方針：鳴くと手牌が減って、安全な牌を残しにくくなります。スルーがおすすめです。')
  } else if (rec.type === 'pass' && (opts.pon.length > 0 || opts.chi.length > 0)) {
    const riichiThreat = threats(s, seat).some((t) => t.reason === 'riichi')
    if (riichiThreat && cur >= 1) lines.push('リーチを受けているので、鳴いて手を短くするより守りを優先しましょう。')
    else if (callBest >= cur) lines.push(`鳴いても手が進まない（${shantenText(cur)}のまま、または戻る）ので、スルーがおすすめです。`)
    else if (!isOpen(p) && cur <= 1) lines.push('門前で手が早いので、鳴かずにリーチを目指す方が高くなりやすいです。')
    else lines.push('鳴いた後に役（タンヤオ・役牌・ホンイツなど）が見込めないので、スルーがおすすめです。役がないと和了れません。')
  }
  if (rec.type === 'pon' || rec.type === 'chi') {
    lines.push(`おすすめ: ${rec.type === 'pon' ? 'ポン' : 'チー'}`)
  } else {
    lines.push('おすすめ: スルー')
  }
  return { recommended: rec, lines }
}

/** リーチ判断の補助：その牌でリーチした場合の待ち */
export function riichiPreview(s: GameState, seat: number, tile: Tile): string {
  const p = s.players[seat]
  const hand13 = p.hand.filter((t) => t !== tile)
  const visible = visibleCounts(s, seat)
  const uk = ukeire(toCounts(hand13), p.melds.length, visible)
  const waits = waitDetails(s, seat, hand13, uk.tiles)
  return waits.map((w) => `${kindLabel(w.kind)}(残${w.remaining}) ${w.riichiPoints}点`).join(' / ')
}

// 他家の手牌の状態（テンパイ・待ち・フリテンなど）。手牌を表向きで見せるときに使う。

import { isDiscardFuriten, type GameState } from './game'
import { shanten, waitingKinds } from './shanten'
import { kindLabel, toCounts } from './tiles'

export function handStatus(s: GameState, seat: number): { text: string; tenpai: boolean; furiten: boolean; riichi: boolean } {
  const p = s.players[seat]
  const drawn = p.drawn !== null && p.hand.includes(p.drawn) ? p.drawn : null
  const base = p.hand.filter((t) => t !== drawn)
  const counts = toCounts(base)
  const n = base.length
  const sh = shanten(counts, p.melds.length)
  if (sh < 0) return { text: '和了の形', tenpai: true, furiten: false, riichi: p.riichi }
  if (n % 3 === 2) {
    // 鳴いた直後などで、切る牌がまだ決まっていない手（14枚相当）
    return { text: sh === 0 ? 'テンパイの形（打牌前）' : `${sh}シャンテン（打牌前）`, tenpai: sh === 0, furiten: false, riichi: p.riichi }
  }
  if (sh > 0) return { text: `${sh}シャンテン`, tenpai: false, furiten: false, riichi: p.riichi }
  const waits = waitingKinds(counts, p.melds.length)
  const furiten = p.furitenTemp || p.furitenRiichi || isDiscardFuriten(s, seat, base)
  const text = waits.length > 0 ? `テンパイ 待ち：${waits.map(kindLabel).join('・')}` : 'テンパイ（待ちなし）'
  return { text, tenpai: true, furiten, riichi: p.riichi }
}

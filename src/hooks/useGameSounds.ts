// 対局の出来事（切る・鳴く・リーチ・和了・流局・終局）を見て、効果音を鳴らす。
// 状態の「前回との違い」から鳴らすので、人の操作でもCPUの手番でも同じように鳴る。

import { useEffect, useRef, type MutableRefObject } from 'react'
import type { GameState } from '../engine/game'
import { playSound, type SoundName } from '../sound'

interface Prev {
  roundNo: number
  discardSeq: number
  eventSeq: number
  phase: string
  myResponse: boolean
  myAction: boolean
}

/** 席 → 左右の位置（下家は右、上家は左、あなたと対面は中央） */
const PAN = [0, 0.55, 0, -0.55]

function snapshot(s: GameState, myResponse: boolean, myAction: boolean): Prev {
  return { roundNo: s.roundNo, discardSeq: s.discardSeq, eventSeq: s.eventSeq, phase: s.phase.type, myResponse, myAction }
}

/** 局の終わりの音（自分が和了／放銃／他家の和了／流局） */
function roundEndSound(s: GameState): { name: SoundName; delay: number } {
  const res = s.roundResult
  if (!res) return { name: 'resultOther', delay: 0.2 }
  if (res.type !== 'win') return { name: 'drawGame', delay: 0.25 }
  const mine = res.wins.find((w) => w.winner === 0)
  if (mine) {
    const r = mine.result
    const name: SoundName = r.yakuman > 0 ? 'winYakuman' : r.limit ? 'winBig' : 'win'
    return { name, delay: 0.35 }
  }
  if (res.wins.some((w) => w.from === 0)) return { name: 'lose', delay: 0.35 }
  return { name: 'resultOther', delay: 0.3 }
}

export function useGameSounds(gameRef: MutableRefObject<GameState>, ver: number, myResponse: boolean, myAction: boolean) {
  const prev = useRef<Prev | null>(null)
  useEffect(() => {
    const s = gameRef.current
    const now = snapshot(s, myResponse, myAction)
    const p = prev.current
    prev.current = now
    // 最初の表示：新しく始めた対局なら牌をかき混ぜる音。続きから再開したときは、何も鳴らさない
    if (!p) {
      if (s.roundNo === 1 && s.discardSeq === 0 && s.phase.type === 'draw') playSound('shuffle')
      return
    }

    // 新しい局（または新しい対局）
    if (now.roundNo !== p.roundNo) {
      playSound('shuffle')
      return
    }

    // 牌を切った（待った で戻ったときは、番号が減るので鳴らさない）
    if (now.discardSeq > p.discardSeq) {
      let seat = 0
      let best = -1
      s.players.forEach((pl, i) => {
        const d = pl.discards[pl.discards.length - 1]
        if (d && (d.seq ?? -1) > best) {
          best = d.seq ?? -1
          seat = i
        }
      })
      playSound(seat === 0 ? 'discardMe' : 'discard', { pan: PAN[seat], vel: seat === 0 ? 1 : 0.7 })
    }

    // ポン・チー・カン・リーチ・ロン・ツモ
    if (now.eventSeq > p.eventSeq && s.event) {
      const ev = s.event
      const map: Partial<Record<typeof ev.kind, SoundName>> = {
        pon: 'pon',
        chi: 'chi',
        kan: 'kan',
        riichi: 'riichi',
        ron: 'ron',
        tsumo: 'tsumo',
      }
      const name = map[ev.kind]
      if (name) playSound(name, { pan: PAN[ev.seat], delay: ev.kind === 'riichi' ? 0.06 : 0.02 })
    }

    // 局が終わった／対局が終わった
    if (now.phase !== p.phase) {
      if (now.phase === 'roundEnd') {
        const r = roundEndSound(s)
        playSound(r.name, { delay: r.delay })
      } else if (now.phase === 'gameEnd' && s.final) {
        const rank = s.final.order.indexOf(0)
        playSound(`rank${Math.min(4, rank + 1)}` as SoundName, { delay: 0.2 })
      }
    }

    // 鳴き・ロンの確認が出た／自分の番が来た
    if (now.myResponse && !p.myResponse) playSound('prompt', { delay: 0.12 })
    else if (now.myAction && !p.myAction && s.players[0].drawn !== null) playSound('draw')
  }, [ver, myResponse, myAction, gameRef])
}

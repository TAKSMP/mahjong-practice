// 進行の自動処理（CPUの手番・応答をまとめて進める）

import { cpuCallAction, cpuTurnAction, type CpuLevel } from './ai'
import { applyTurnAction, drawTile, respond, type GameState } from './game'

export type StepResult = 'progress' | 'waitHuman' | 'roundEnd' | 'gameEnd'

/**
 * 1ステップだけ進める。人間（humanSeats）の入力が必要なら 'waitHuman'。
 */
export function autoStep(s: GameState, level: CpuLevel, humanSeats: number[] = [0]): StepResult {
  const ph = s.phase
  switch (ph.type) {
    case 'draw':
      drawTile(s)
      return 'progress'
    case 'action':
      if (humanSeats.includes(s.turn)) return 'waitHuman'
      applyTurnAction(s, cpuTurnAction(s, s.turn, level))
      return 'progress'
    case 'response': {
      for (let seat = 0; seat < 4; seat++) {
        if (ph.responses[seat] !== null) continue
        if (humanSeats.includes(seat)) continue
        respond(s, seat, cpuCallAction(s, seat, ph.options[seat]!, level))
        if (s.phase !== ph) return 'progress'
      }
      if (s.phase.type === 'response') return 'waitHuman'
      return 'progress'
    }
    case 'roundEnd':
      return 'roundEnd'
    case 'gameEnd':
      return 'gameEnd'
  }
}

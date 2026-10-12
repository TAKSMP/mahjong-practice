// 牌の絵柄（SVG）。viewBox は 60×80。

import { memo } from 'react'
import type { Kind } from '../engine/tiles'

const BLUE = '#1d4f9a'
const GREEN = '#17803d'
const RED = '#d32626'
const BLACK = '#1d1d1f'

const KANJI_NUM = ['一', '二', '三', '四', '五', '六', '七', '八', '九']
const HONORS = ['東', '南', '西', '北', '白', '發', '中']

function Pin({ x, y, r, color }: { x: number; y: number; r: number; color: string }) {
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill="none" stroke={color} strokeWidth={r * 0.32} />
      <circle cx={x} cy={y} r={r * 0.42} fill={color} />
      <circle cx={x} cy={y} r={r * 0.16} fill="#fff" />
    </g>
  )
}

function Bamboo({ x, y, h = 20, w = 7, color }: { x: number; y: number; h?: number; w?: number; color: string }) {
  return (
    <g>
      <rect x={x - w / 2} y={y - h / 2} width={w} height={h} rx={w / 2} fill={color} />
      <rect x={x - w / 2 - 0.6} y={y - 1} width={w + 1.2} height={2} rx={1} fill={color} />
      <line x1={x} y1={y - h / 2 + 2.5} x2={x} y2={y + h / 2 - 2.5} stroke="#fff" strokeWidth={1.1} opacity={0.75} />
    </g>
  )
}

function pinLayout(n: number, red: boolean): JSX.Element[] {
  const P = (x: number, y: number, r: number, c: string, key: number) => <Pin key={key} x={x} y={y} r={r} color={c} />
  const R = red ? RED : undefined
  switch (n) {
    case 1:
      return [
        <g key="1">
          <circle cx={30} cy={40} r={20} fill="none" stroke={R ?? GREEN} strokeWidth={3} />
          <circle cx={30} cy={40} r={14} fill="none" stroke={R ?? BLUE} strokeWidth={4} />
          <circle cx={30} cy={40} r={7} fill={R ?? RED} />
          <circle cx={30} cy={40} r={2.5} fill="#fff" />
        </g>,
      ]
    case 2:
      return [P(30, 22, 11, R ?? GREEN, 0), P(30, 58, 11, R ?? BLUE, 1)]
    case 3:
      return [P(14, 16, 9, R ?? BLUE, 0), P(30, 40, 9, RED, 1), P(46, 64, 9, R ?? GREEN, 2)]
    case 4:
      return [P(17, 22, 10, R ?? BLUE, 0), P(43, 22, 10, R ?? GREEN, 1), P(17, 58, 10, R ?? GREEN, 2), P(43, 58, 10, R ?? BLUE, 3)]
    case 5:
      return [
        P(16, 18, 9, R ?? BLUE, 0),
        P(44, 18, 9, R ?? GREEN, 1),
        P(30, 40, 9, RED, 2),
        P(16, 62, 9, R ?? GREEN, 3),
        P(44, 62, 9, R ?? BLUE, 4),
      ]
    case 6:
      return [
        P(17, 15, 8.5, R ?? GREEN, 0),
        P(43, 15, 8.5, R ?? GREEN, 1),
        P(17, 42, 8.5, RED, 2),
        P(43, 42, 8.5, RED, 3),
        P(17, 64, 8.5, RED, 4),
        P(43, 64, 8.5, RED, 5),
      ]
    case 7:
      return [
        P(13, 11, 7.5, R ?? GREEN, 0),
        P(30, 18, 7.5, R ?? GREEN, 1),
        P(47, 25, 7.5, R ?? GREEN, 2),
        P(17, 47, 8, RED, 3),
        P(43, 47, 8, RED, 4),
        P(17, 67, 8, RED, 5),
        P(43, 67, 8, RED, 6),
      ]
    case 8:
      return [11, 30, 50, 69].flatMap((y, i) => [P(17, y, 8, R ?? BLUE, i * 2), P(43, y, 8, R ?? BLUE, i * 2 + 1)])
    case 9:
      return [15, 40, 65].flatMap((y, i) =>
        [13, 30, 47].map((x, j) => P(x, y, 7.8, i === 1 ? RED : i === 0 ? R ?? BLUE : R ?? GREEN, i * 3 + j)),
      )
  }
  return []
}

function souLayout(n: number, red: boolean): JSX.Element[] {
  const B = (x: number, y: number, c: string, key: number, h = 20, w = 7) => <Bamboo key={key} x={x} y={y} color={c} h={h} w={w} />
  const G = red ? RED : GREEN
  switch (n) {
    case 1:
      // 一索：鳥
      return [
        <g key="bird">
          <ellipse cx={31} cy={46} rx={13} ry={16} fill={G} />
          <circle cx={26} cy={25} r={7.5} fill={red ? RED : RED} />
          <circle cx={24.5} cy={23.5} r={1.8} fill="#fff" />
          <path d="M19 26 L11 28 L19 30 Z" fill="#c98b1a" />
          <path d="M33 60 Q40 72 50 70 Q42 66 41 58 Z" fill={BLUE} />
          <path d="M28 61 Q30 74 38 74 Q33 68 34 60 Z" fill={red ? RED : GREEN} />
          <path d="M25 40 Q31 50 40 44" fill="none" stroke="#fff" strokeWidth={2} opacity={0.7} />
        </g>,
      ]
    case 2:
      return [B(30, 21, G, 0, 24, 8), B(30, 59, G, 1, 24, 8)]
    case 3:
      return [B(30, 21, G, 0, 24, 8), B(18, 59, G, 1, 24, 8), B(42, 59, G, 2, 24, 8)]
    case 4:
      return [B(18, 21, G, 0, 24, 8), B(42, 21, G, 1, 24, 8), B(18, 59, G, 2, 24, 8), B(42, 59, G, 3, 24, 8)]
    case 5:
      return [B(15, 21, G, 0, 24), B(45, 21, G, 1, 24), B(30, 40, RED, 2, 24), B(15, 59, G, 3, 24), B(45, 59, G, 4, 24)]
    case 6:
      return [B(14, 21, G, 0, 24), B(30, 21, G, 1, 24), B(46, 21, G, 2, 24), B(14, 59, G, 3, 24), B(30, 59, G, 4, 24), B(46, 59, G, 5, 24)]
    case 7:
      return [
        B(30, 13, RED, 0, 18),
        B(14, 40, G, 1, 18),
        B(30, 40, G, 2, 18),
        B(46, 40, G, 3, 18),
        B(14, 65, G, 4, 18),
        B(30, 65, G, 5, 18),
        B(46, 65, G, 6, 18),
      ]
    case 8:
      return [
        <g key="8">
          {[
            [10, 20, 0],
            [23, 20, 0],
            [37, 20, 0],
            [50, 20, 0],
            [10, 60, 0],
            [23, 60, 0],
            [37, 60, 0],
            [50, 60, 0],
          ].map(([x, y], i) => (
            <g key={i} transform={`rotate(${i < 4 ? (i % 2 === 0 ? 18 : -18) : i % 2 === 0 ? -18 : 18} ${x} ${y})`}>
              <Bamboo x={x} y={y} color={G} h={26} w={6.5} />
            </g>
          ))}
        </g>,
      ]
    case 9:
      return [13, 40, 65].flatMap((y, i) => [13, 30, 47].map((x, j) => B(x, i === 0 ? 14 : y, j === 1 ? RED : i === 1 ? BLUE : G, i * 3 + j, 20, 7)))
  }
  return []
}

export const TileFace = memo(function TileFace({ kind, red }: { kind: Kind; red?: boolean }) {
  let content: JSX.Element | JSX.Element[]
  if (kind < 9) {
    const n = kind + 1
    content = (
      <g fontFamily="'Hiragino Mincho ProN','Yu Mincho','Noto Serif JP','Noto Serif CJK JP',serif" fontWeight={700} textAnchor="middle">
        <text x={30} y={34} fontSize={30} fill={red ? RED : BLACK}>
          {KANJI_NUM[n - 1]}
        </text>
        <text x={30} y={72} fontSize={30} fill={RED}>
          萬
        </text>
      </g>
    )
  } else if (kind < 18) {
    content = pinLayout(kind - 8, !!red)
  } else if (kind < 27) {
    content = souLayout(kind - 17, !!red)
  } else if (kind === 31) {
    content = <rect x={12} y={14} width={36} height={52} rx={3} fill="none" stroke={BLUE} strokeWidth={3.5} />
  } else {
    const ch = HONORS[kind - 27]
    const color = kind === 32 ? GREEN : kind === 33 ? RED : BLACK
    content = (
      <text
        x={30}
        y={54}
        fontSize={kind >= 31 ? 40 : 42}
        textAnchor="middle"
        fontFamily="'Hiragino Mincho ProN','Yu Mincho','Noto Serif JP','Noto Serif CJK JP',serif"
        fontWeight={700}
        fill={color}
      >
        {ch}
      </text>
    )
  }
  return (
    <svg viewBox="0 0 60 80" className="tile-svg" aria-hidden>
      {content}
    </svg>
  )
})

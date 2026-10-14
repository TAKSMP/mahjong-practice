// クイズ用の牌の並び

import { TileView } from '../../components/Tile'
import { arrangeHand, parseTiles } from '../../quiz/util'

type Size = 'xs' | 's' | 'm' | 'l'

/** 牌の列（クイズの手牌・河・副露・見えている牌など） */
export function TileRow({ tiles, size = 's', className = '', arrange = false }: { tiles: string; size?: Size; className?: string; arrange?: boolean }) {
  return (
    <div className={`q-tiles q-t-${size} ${className}`}>
      {(arrange ? arrangeHand(tiles) : parseTiles(tiles)).map((t, i) => (
        <TileView key={i} kind={t.kind} red={t.red} />
      ))}
    </div>
  )
}

export type HandMark = 'ans' | 'pick' | 'ng'

/** 選べる手牌（切る牌を選ぶ問題） */
export function HandRow({
  tiles,
  selected,
  onPick,
  marks,
  disabled,
  draw,
}: {
  tiles: string
  selected: number | null
  onPick?: (i: number) => void
  marks?: Record<number, HandMark>
  disabled?: boolean
  /** 最後の牌をツモ牌として少し離す */
  draw?: boolean
}) {
  const list = arrangeHand(tiles)
  return (
    <div className={`q-tiles q-t-m q-hand ${draw && list.length % 3 === 2 ? 'with-draw' : ''}`}>
      {list.map((t, i) => (
        <div
          key={i}
          className={`q-hand-tile ${selected === i ? 'sel' : ''} ${marks?.[i] ? `mark-${marks[i]}` : ''}`}
          onClick={disabled || !onPick ? undefined : () => onPick(i)}
          role={disabled || !onPick ? undefined : 'button'}
        >
          <TileView kind={t.kind} red={t.red} />
        </div>
      ))}
    </div>
  )
}

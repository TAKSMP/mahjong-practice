import { memo } from 'react'
import { kindLabel, type Kind } from '../engine/tiles'
import { TileFace } from './TileFace'

export interface TileProps {
  kind: Kind
  red?: boolean
  back?: boolean
  /** 横向き（リーチ宣言牌・鳴いた牌） */
  sideways?: boolean
  dim?: boolean
  /** 牌の名前を下に表示 */
  label?: boolean
  className?: string
  onClick?: () => void
}

export const TileView = memo(function TileView({ kind, red, back, sideways, dim, label, className, onClick }: TileProps) {
  const cls = ['tile', back ? 'tile-back' : '', sideways ? 'tile-side' : '', dim ? 'tile-dim' : '', red ? 'tile-red' : '', className ?? '']
    .filter(Boolean)
    .join(' ')
  return (
    <div className={cls} onClick={onClick} role={onClick ? 'button' : undefined}>
      <div className="tile-body">{back ? null : <TileFace kind={kind} red={red} />}</div>
      {label && !back ? <div className="tile-label">{kindLabel(kind)}</div> : null}
    </div>
  )
})

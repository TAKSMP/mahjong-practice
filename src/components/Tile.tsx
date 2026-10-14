import { memo } from 'react'
import { kindParts, type Kind } from '../engine/tiles'
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
      {label && !back ? <TileName kind={kind} className="tile-label" /> : null}
    </div>
  )
})

/** 牌の読み方（カタカナ）を、数字と種類の2段で見せる。例: ウー / ワン */
export function TileName({ kind, className = '' }: { kind: Kind; className?: string }) {
  const parts = kindParts(kind)
  return (
    <div className={`tile-name ${className}`}>
      {parts.map((p, i) => (
        <span key={i}>{p}</span>
      ))}
    </div>
  )
}

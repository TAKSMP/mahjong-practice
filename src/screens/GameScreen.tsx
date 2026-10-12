// 対局画面

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  beforeHints,
  callAdvice,
  discardFeedback,
  evalKey,
  kindsText,
  riichiPreview,
  shantenHelp,
  shantenText,
  type Feedback,
  type HintTag,
} from '../engine/advisor'
import { autoStep } from '../engine/controller'
import {
  applyTurnAction,
  canDiscard,
  cloneState,
  doraIndicators,
  getTurnOptions,
  nextRound,
  respond,
  type CallAction,
  type GameEvent,
  type GameState,
} from '../engine/game'
import { doraFromIndicator, kindLabel, kindOf, toCounts, type Tile } from '../engine/tiles'
import { waitingKinds } from '../engine/shanten'
import { MeldView, Table, isRedTile, setRedTiles } from '../components/Table'
import { TileView } from '../components/Tile'
import { GameEndOverlay, RoundResultOverlay } from '../components/ResultOverlay'
import { saveGame, type AppSettings, type HintMode } from '../settings'

interface Props {
  initial: GameState
  settings: AppSettings
  onSettingsChange: (s: AppSettings) => void
  onExit: () => void
  onNewGame: () => void
  onGameFinished: (s: GameState) => void
  onRoundFinished: (s: GameState, feedback: Feedback[]) => void
  onOpenHelp: () => void
}

interface Snap {
  state: GameState
  feedbackLen: number
}

const SPEED = { slow: 1.7, normal: 1, fast: 0.45 }
const TAG_MARK: Record<HintTag, string> = { best: '◎', good: '○', ok: '△', bad: '×', forbidden: '' }

export function GameScreen({ initial, settings, onSettingsChange, onExit, onNewGame, onGameFinished, onRoundFinished, onOpenHelp }: Props) {
  const gameRef = useRef<GameState>(initial)
  const [ver, setVer] = useState(0)
  const bump = useCallback(() => setVer((v) => v + 1), [])
  const [selected, setSelected] = useState<Tile | null>(null)
  const [riichiMode, setRiichiMode] = useState(false)
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [roundFeedback, setRoundFeedback] = useState<Feedback[]>([])
  const [undo, setUndo] = useState<Snap[]>([])
  const [menu, setMenu] = useState(false)
  const [chiPick, setChiPick] = useState<Tile[][] | null>(null)
  const [kanPick, setKanPick] = useState(false)
  const [bubble, setBubble] = useState<GameEvent | null>(null)
  const [showHintPanel, setShowHintPanel] = useState(true)
  // 結果画面で再開した局は、成績を二重に数えない
  const reportedRound = useRef<number>(initial.phase.type === 'roundEnd' ? initial.roundNo : -1)
  const reportedGame = useRef(false)
  const s = gameRef.current
  setRedTiles(s.redTiles)
  const ph = s.phase
  const me = s.players[0]
  const hintMode = settings.hintMode

  const myAction = ph.type === 'action' && s.turn === 0
  const myResponse = ph.type === 'response' && ph.responses[0] === null && ph.options[0] !== null
  const callOpts = ph.type === 'response' ? ph.options[0] : null

  // ---- 吹き出し ----
  useEffect(() => {
    const ev = s.event
    if (!ev || (bubble && bubble.seq === ev.seq)) return
    setBubble(ev)
    const id = setTimeout(() => setBubble(null), 1300)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ver])

  // ---- 自動進行 ----
  useEffect(() => {
    const st = gameRef.current
    const p = st.phase
    if (menu) return
    if (p.type === 'roundEnd') {
      if (reportedRound.current !== st.roundNo) {
        reportedRound.current = st.roundNo
        onRoundFinished(st, roundFeedback)
        saveGame(st)
      }
      return
    }
    if (p.type === 'gameEnd') {
      if (!reportedGame.current) {
        reportedGame.current = true
        onGameFinished(st)
        saveGame(null)
      }
      return
    }
    const f = SPEED[settings.speed]
    if (p.type === 'action' && st.turn === 0) {
      saveGame(st)
      // リーチ中は自動でツモ切り（ツモ・暗槓ができるときは待つ）
      const pl = st.players[0]
      if (pl.riichi) {
        const opts = getTurnOptions(st, 0)
        if (!opts.tsumo && opts.ankan.length === 0) {
          const id = setTimeout(() => {
            applyTurnAction(st, { type: 'discard', tile: pl.drawn! })
            bump()
          }, 650 * f)
          return () => clearTimeout(id)
        }
      }
      return
    }
    if (p.type === 'response' && p.responses[0] === null && p.options[0]) {
      const o = p.options[0]
      if ((settings.autoPassCalls || st.players[0].riichi) && !o.ron) {
        const id = setTimeout(() => {
          respond(st, 0, { type: 'pass' })
          bump()
        }, 50)
        return () => clearTimeout(id)
      }
      saveGame(st)
      return
    }
    let delay = 80
    if (p.type === 'draw') delay = st.turn === 0 ? 260 : 120
    else if (p.type === 'action') delay = 520
    else if (p.type === 'response') delay = 120
    const id = setTimeout(() => {
      autoStep(st, settings.cpuLevel, [0])
      bump()
    }, delay * f)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ver, menu, settings.speed, settings.cpuLevel, settings.autoPassCalls])

  // 自分の手番が来たら選択をリセット
  useEffect(() => {
    if (!myAction) {
      setSelected(null)
      setRiichiMode(false)
      setKanPick(false)
    }
  }, [myAction])

  const hints = useMemo(() => {
    if (!myAction || hintMode !== 'before') return null
    return beforeHints(s, 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ver, myAction, hintMode])

  const turnOpts = useMemo(() => (myAction ? getTurnOptions(s, 0) : null), [ver, myAction]) // eslint-disable-line react-hooks/exhaustive-deps

  const advice = useMemo(() => {
    if (!myResponse || !callOpts || !settings.callAdvice || hintMode === 'off') return null
    return callAdvice(s, 0, callOpts)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ver, myResponse, settings.callAdvice, hintMode])

  const pushUndo = () => {
    setUndo((u) => [...u.slice(-9), { state: cloneState(gameRef.current), feedbackLen: roundFeedback.length }])
  }

  const doUndo = () => {
    const last = undo[undo.length - 1]
    if (!last) return
    gameRef.current = last.state
    setUndo(undo.slice(0, -1))
    setRoundFeedback((f) => f.slice(0, last.feedbackLen))
    setFeedback(null)
    setSelected(null)
    setRiichiMode(false)
    setMenu(false)
    bump()
  }

  // 局が変わったら「待った」とこの局の評価をリセット
  const roundKey = s.roundNo
  const lastRoundKey = useRef(roundKey)
  useEffect(() => {
    if (lastRoundKey.current !== roundKey) {
      lastRoundKey.current = roundKey
      setUndo([])
      setRoundFeedback([])
      setFeedback(null)
    }
  }, [roundKey])

  const discard = (tile: Tile, riichi = false) => {
    const st = gameRef.current
    if (!canDiscard(st, 0, tile)) return
    pushUndo()
    let fb: Feedback | null = null
    if (hintMode !== 'off' && !st.players[0].riichi) fb = discardFeedback(st, 0, tile, riichi)
    applyTurnAction(st, { type: 'discard', tile, riichi })
    setSelected(null)
    setRiichiMode(false)
    if (fb) {
      setRoundFeedback((f) => [...f, fb!])
      setFeedback(hintMode === 'after' ? fb : null)
    }
    bump()
  }

  const onTileTap = (tile: Tile) => {
    if (!myAction) return
    const st = gameRef.current
    if (riichiMode) {
      if (turnOpts?.riichiTiles.some((t) => kindOf(t) === kindOf(tile))) {
        if (selected === tile) discard(tile, true)
        else setSelected(tile)
      }
      return
    }
    if (!canDiscard(st, 0, tile)) {
      setSelected(tile)
      return
    }
    if (selected === tile) discard(tile)
    else setSelected(tile)
  }

  const doTurn = (a: Parameters<typeof applyTurnAction>[1]) => {
    pushUndo()
    applyTurnAction(gameRef.current, a)
    setKanPick(false)
    setSelected(null)
    bump()
  }

  const doRespond = (a: CallAction) => {
    const st = gameRef.current
    pushUndo()
    if (advice && hintMode === 'after' && a.type !== 'ron') {
      const rec = advice.recommended
      const same = rec.type === a.type
      const fb: Feedback = {
        verdict: same ? 'best' : 'soso',
        title: same ? 'ナイス判断' : rec.type === 'pass' ? '鳴かない方がよかったかも' : '鳴いてもよかったかも',
        lines: advice.lines,
        chosenKind: ph.type === 'response' ? kindOf(ph.tile) : 0,
        bestKind: ph.type === 'response' ? kindOf(ph.tile) : 0,
      }
      setFeedback(fb)
    }
    respond(st, 0, a)
    setChiPick(null)
    bump()
  }

  const setHintMode = (m: HintMode) => onSettingsChange({ ...settings, hintMode: m })

  // ---- 手牌 ----
  const handTiles = me.hand.filter((t) => t !== me.drawn)
  const drawn = me.drawn !== null && me.hand.includes(me.drawn) ? me.drawn : null
  const selHint = hints && selected !== null ? hints.tiles.get(evalKey(s, selected)) : null
  const threatsExist = !!hints && hints.rec.threats.length > 0

  const renderHandTile = (t: Tile) => {
    const h = hints?.tiles.get(evalKey(s, t))
    const riichiOk = riichiMode && turnOpts?.riichiTiles.some((x) => kindOf(x) === kindOf(t))
    const disabled = myAction && (!canDiscard(s, 0, t) || (riichiMode && !riichiOk))
    const cls = ['hand-tile', selected === t ? 'selected' : '', disabled ? 'disabled' : '', riichiOk ? 'riichi-ok' : ''].join(' ')
    return (
      <div key={t} className={cls} onClick={() => onTileTap(t)}>
        {h && h.tag !== 'forbidden' ? (
          <div className={`hint-badge tag-${h.tag}`}>
            <span className="hint-mark">{TAG_MARK[h.tag]}</span>
            <span className="hint-num">{h.tag === 'bad' ? '' : h.eval.shanten === 0 ? h.eval.yakuWaitTotal : h.eval.ukeireTotal}</span>
          </div>
        ) : (
          <div className="hint-badge hint-empty" />
        )}
        <TileView kind={kindOf(t)} red={isRedTile(t)} />
        <div className={`danger-bar ${h && threatsExist ? `danger-${dangerClass(h.eval.danger.score)}` : ''}`} />
        {settings.showNames ? <div className="hand-name">{kindLabel(kindOf(t))}</div> : null}
      </div>
    )
  }

  // ---- パネルの内容 ----
  let panel: JSX.Element | null = null
  if (myResponse && callOpts) {
    panel = (
      <div className="panel panel-call">
        <div className="panel-head">
          {ph.type === 'response' ? `${s.players[ph.from].name}の ${kindLabel(kindOf(ph.tile))}` : ''}
          {callOpts.ron ? ' — ロンできます！' : ' を鳴けます'}
        </div>
        {advice ? advice.lines.map((l, i) => <div key={i} className="panel-line">{l}</div>) : null}
      </div>
    )
  } else if (myAction && hintMode === 'before' && hints) {
    if (riichiMode) {
      panel = (
        <div className="panel">
          <div className="panel-head">リーチ：切る牌を選んでください</div>
          {selected !== null ? (
            <div className="panel-line">{kindLabel(kindOf(selected))}を切ってリーチ → {riichiPreview(s, 0, selected)}（もう一度タップで決定）</div>
          ) : (
            <div className="panel-line">光っている牌がリーチできる牌です。</div>
          )}
        </div>
      )
    } else if (selHint) {
      panel = (
        <div className="panel">
          <div className="panel-head">
            {kindLabel(selHint.eval.kind)}
            {selHint.eval.isRed ? '(赤)' : ''} を切ると… <span className={`tagchip tag-${selHint.tag}`}>{tagText(selHint.tag, selHint.rank)}</span>
          </div>
          <div className="panel-line">{selHint.summary}</div>
          {selHint.notes.map((n, i) => (
            <div key={i} className={`panel-line ${n.startsWith('⚠') ? 'warn' : 'note'}`}>
              {n}
            </div>
          ))}
          {selHint.tag !== 'forbidden' ? <div className="panel-tip">もう一度タップすると切ります</div> : null}
        </div>
      )
    } else {
      panel = (
        <div className="panel">
          <div className="panel-head">
            今: {shantenText(hints.currentShanten)}
            <span className="panel-sub">（{hints.currentShanten >= 1 ? shantenHelp(hints.currentShanten) : hints.currentShanten === 0 ? '1枚切ればテンパイ' : '和了！'}）</span>
          </div>
          {hints.actionAdvice.map((l, i) => (
            <div key={i} className="panel-line good">
              {l}
            </div>
          ))}
          <div className="panel-line">
            <b>{hints.headline}</b>
          </div>
          {hints.detail.map((l, i) => (
            <div key={i} className="panel-line">
              {l}
            </div>
          ))}
          <div className="panel-tip">牌をタップすると「切ったらどうなるか」が見られます。◎=おすすめ 数字=有効牌の残り枚数</div>
        </div>
      )
    }
  } else if (feedback && hintMode === 'after') {
    panel = (
      <div className={`panel panel-fb fb-${feedback.verdict}`}>
        <div className="panel-head">
          {feedback.title}
          <button className="mini-btn" onClick={() => setFeedback(null)}>
            ✕
          </button>
        </div>
        {feedback.lines.map((l, i) => (
          <div key={i} className={`panel-line ${l.startsWith('⚠') ? 'warn' : ''}`}>
            {l}
          </div>
        ))}
        {undo.length > 0 && feedback.verdict !== 'best' ? (
          <button className="mini-btn wide" onClick={doUndo}>
            ↩ 待った（打ち直して結果を比べる）
          </button>
        ) : null}
      </div>
    )
  } else if (myAction && hintMode === 'after') {
    const turn = turnOpts
    panel = (
      <div className="panel">
        <div className="panel-head">あなたの番です</div>
        {turn?.tsumo ? <div className="panel-line good">ツモ和了できます！</div> : null}
        {turn && turn.riichiTiles.length > 0 ? <div className="panel-line good">テンパイ！リーチできます</div> : null}
        <div className="panel-tip">切った後に、その一打の評価が出ます。</div>
      </div>
    )
  } else if (myAction && hintMode === 'off') {
    panel = null
  } else if (me.riichi && ph.type !== 'roundEnd') {
    panel = (
      <div className="panel">
        <div className="panel-head">リーチ中</div>
        <div className="panel-line">待ち: {kindsText(waitsOf(s))}</div>
      </div>
    )
  }

  // ---- ボタン ----
  const buttons: JSX.Element[] = []
  if (myAction && turnOpts) {
    if (turnOpts.tsumo) buttons.push(<button key="tsumo" className="act act-win" onClick={() => doTurn({ type: 'tsumo' })}>ツモ</button>)
    if (turnOpts.riichiTiles.length > 0)
      buttons.push(
        <button key="riichi" className={`act act-riichi ${riichiMode ? 'on' : ''}`} onClick={() => { setRiichiMode(!riichiMode); setSelected(null) }}>
          {riichiMode ? 'リーチ取消' : 'リーチ'}
        </button>,
      )
    if (turnOpts.ankan.length + turnOpts.kakan.length > 0)
      buttons.push(<button key="kan" className="act" onClick={() => setKanPick(!kanPick)}>カン</button>)
    if (turnOpts.kyuushu) buttons.push(<button key="kyuushu" className="act" onClick={() => doTurn({ type: 'kyuushu' })}>九種九牌</button>)
  }
  if (myResponse && callOpts) {
    const rec = advice?.recommended.type
    if (callOpts.ron) buttons.push(<button key="ron" className="act act-win" onClick={() => doRespond({ type: 'ron' })}>ロン</button>)
    if (callOpts.pon.length > 0) {
      const v = callOpts.pon.find((x) => x.some(isRedTile)) ?? callOpts.pon[0]
      buttons.push(<button key="pon" className={`act ${rec === 'pon' ? 'rec' : ''}`} onClick={() => doRespond({ type: 'pon', tiles: v })}>ポン</button>)
    }
    if (callOpts.chi.length > 0)
      buttons.push(
        <button key="chi" className={`act ${rec === 'chi' ? 'rec' : ''}`} onClick={() => (callOpts.chi.length === 1 ? doRespond({ type: 'chi', tiles: callOpts.chi[0] }) : setChiPick(callOpts.chi))}>
          チー
        </button>,
      )
    if (callOpts.minkan) buttons.push(<button key="kan" className="act" onClick={() => doRespond({ type: 'minkan' })}>カン</button>)
    buttons.push(<button key="pass" className={`act act-pass ${rec === 'pass' ? 'rec' : ''}`} onClick={() => doRespond({ type: 'pass' })}>スルー</button>)
  }

  const dora = doraIndicators(s)
  const lastDiscard = (() => {
    if (ph.type === 'response') {
      const p = s.players[ph.from]
      return { seat: ph.from, index: p.discards.length - 1 }
    }
    return null
  })()

  return (
    <div className="game">
      <div className="topbar">
        <button className="icon-btn" onClick={() => setMenu(true)} aria-label="メニュー">
          ☰
        </button>
        <div className="dora-box">
          <span className="dora-label">ドラ</span>
          {dora.map((t) => (
            <TileView key={t} kind={doraFromIndicator(kindOf(t))} className="tile-xs" />
          ))}
        </div>
        <div className="hint-switch">
          {(['before', 'after', 'off'] as HintMode[]).map((m) => (
            <button key={m} className={hintMode === m ? 'on' : ''} onClick={() => setHintMode(m)}>
              {m === 'before' ? '打つ前' : m === 'after' ? '打った後' : 'なし'}
            </button>
          ))}
        </div>
        {undo.length > 0 && hintMode !== 'off' ? (
          <button className="icon-btn" onClick={doUndo} aria-label="待った">
            ↩
          </button>
        ) : null}
      </div>

      <Table s={s} bubble={bubble} lastDiscard={lastDiscard} />

      <div className="bottom">
        {panel && showHintPanel ? <div className="panel-wrap">{panel}</div> : <div className="panel-wrap" />}
        <div className="actions">
          {buttons}
          {panel ? (
            <button className="act act-ghost" onClick={() => setShowHintPanel(!showHintPanel)}>
              {showHintPanel ? 'ヒント隠す' : 'ヒント表示'}
            </button>
          ) : null}
        </div>
        {kanPick && turnOpts ? (
          <div className="picker">
            {[...turnOpts.ankan.map((k) => ({ k, t: 'ankan' as const })), ...turnOpts.kakan.map((k) => ({ k, t: 'kakan' as const }))].map(({ k, t }) => (
              <button key={`${t}${k}`} className="pick" onClick={() => doTurn({ type: t, kind: k })}>
                <TileView kind={k} className="tile-xs" /> {t === 'ankan' ? '暗槓' : '加槓'}
              </button>
            ))}
          </div>
        ) : null}
        {chiPick ? (
          <div className="picker">
            {chiPick.map((v, i) => (
              <button key={i} className="pick" onClick={() => doRespond({ type: 'chi', tiles: v })}>
                {v.map((t) => (
                  <TileView key={t} kind={kindOf(t)} red={isRedTile(t)} className="tile-xs" />
                ))}
              </button>
            ))}
            <button className="pick" onClick={() => setChiPick(null)}>
              やめる
            </button>
          </div>
        ) : null}
        <div className="hand-area">
          <div className="hand">
            {handTiles.map(renderHandTile)}
            {drawn !== null ? (
              <>
                <div className="drawn-gap" />
                {renderHandTile(drawn)}
              </>
            ) : null}
          </div>
          {me.melds.length > 0 ? (
            <div className="my-melds">
              {me.melds.map((m, i) => (
                <MeldView key={i} meld={m} seat={0} />
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {ph.type === 'roundEnd' ? (
        <RoundResultOverlay
          s={s}
          feedback={roundFeedback}
          onNext={() => {
            nextRound(gameRef.current)
            bump()
          }}
          onUndo={undo.length > 0 && hintMode !== 'off' ? doUndo : undefined}
        />
      ) : null}
      {ph.type === 'gameEnd' ? <GameEndOverlay s={s} onAgain={onNewGame} onTitle={onExit} /> : null}

      {menu ? (
        <div className="overlay" onClick={() => setMenu(false)}>
          <div className="menu-card" onClick={(e) => e.stopPropagation()}>
            <div className="menu-title">メニュー</div>
            <button className="btn btn-sub" disabled={undo.length === 0} onClick={doUndo}>
              ↩ 待った（1手戻す）
            </button>
            <label className="menu-row">
              <input type="checkbox" checked={settings.showNames} onChange={(e) => onSettingsChange({ ...settings, showNames: e.target.checked })} />
              牌の名前を表示
            </label>
            <label className="menu-row">
              <input type="checkbox" checked={settings.autoPassCalls} onChange={(e) => onSettingsChange({ ...settings, autoPassCalls: e.target.checked })} />
              鳴きの確認をしない（ロン以外スルー）
            </label>
            <div className="menu-row">
              速さ：
              {(['slow', 'normal', 'fast'] as const).map((sp) => (
                <button key={sp} className={`chip ${settings.speed === sp ? 'on' : ''}`} onClick={() => onSettingsChange({ ...settings, speed: sp })}>
                  {sp === 'slow' ? 'ゆっくり' : sp === 'normal' ? 'ふつう' : 'はやい'}
                </button>
              ))}
            </div>
            <button className="btn btn-sub" onClick={onOpenHelp}>
              📖 役・用語の解説
            </button>
            <button className="btn btn-sub" onClick={() => { saveGame(gameRef.current); onExit() }}>
              中断してタイトルへ（続きから再開できます）
            </button>
            <button className="btn btn-main" onClick={() => setMenu(false)}>
              対局に戻る
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function dangerClass(score: number): string {
  if (score <= 0) return 'safe'
  if (score <= 15) return 'low'
  if (score <= 35) return 'mid'
  if (score <= 60) return 'high'
  return 'max'
}

function tagText(tag: HintTag, rank: number): string {
  if (tag === 'best') return 'おすすめ'
  if (tag === 'good') return `良い（${rank}番目）`
  if (tag === 'ok') return `まあまあ（${rank}番目）`
  if (tag === 'bad') return '非推奨'
  return '切れない'
}

function waitsOf(s: GameState) {
  const p = s.players[0]
  const hand = p.drawn !== null ? p.hand.filter((t) => t !== p.drawn) : p.hand
  return waitingKinds(toCounts(hand), p.melds.length)
}

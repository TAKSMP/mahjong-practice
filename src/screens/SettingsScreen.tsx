// ルール設定・サポート設定

import { RULE_PRESETS, type Rules } from '../engine/rules'
import { playSound } from '../sound'
import type { AppSettings } from '../settings'

interface Props {
  rules: Rules
  settings: AppSettings
  onRules: (r: Rules) => void
  onSettings: (s: AppSettings) => void
  onBack: () => void
}

function Toggle({ label, desc, value, onChange }: { label: string; desc?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="set-row">
      <div className="set-text">
        <div className="set-label">{label}</div>
        {desc ? <div className="set-desc">{desc}</div> : null}
      </div>
      <input type="checkbox" className="switch" checked={value} onChange={(e) => onChange(e.target.checked)} />
    </label>
  )
}

function Choice<T extends string | number>({
  label,
  desc,
  value,
  options,
  onChange,
}: {
  label: string
  desc?: string
  value: T
  options: { v: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="set-row set-col">
      <div className="set-text">
        <div className="set-label">{label}</div>
        {desc ? <div className="set-desc">{desc}</div> : null}
      </div>
      <div className="chips">
        {options.map((o) => (
          <button key={String(o.v)} className={`chip ${o.v === value ? 'on' : ''}`} onClick={() => onChange(o.v)}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export function SettingsScreen({ rules, settings, onRules, onSettings, onBack }: Props) {
  const r = rules
  const set = <K extends keyof Rules>(k: K, v: Rules[K]) => onRules({ ...r, [k]: v })
  const st = <K extends keyof AppSettings>(k: K, v: AppSettings[K]) => onSettings({ ...settings, [k]: v })
  const presetMatch = RULE_PRESETS.find((p) => JSON.stringify(p.rules) === JSON.stringify(r))
  return (
    <div className="page">
      <div className="page-head">
        <button className="icon-btn" onClick={onBack}>
          ←
        </button>
        <h2>設定</h2>
      </div>

      <section className="set-section">
        <h3>打ち筋サポート</h3>
        <Choice
          label="サポートの出し方"
          desc="「打つ前」は各牌を切った場合の結果とおすすめを表示。「打った後」は切った直後にその一打を評価します。対局中も上のボタンで切り替えられます。"
          value={settings.hintMode}
          options={[
            { v: 'before', label: '打つ前のヒント' },
            { v: 'after', label: '打った直後の指摘' },
            { v: 'off', label: 'なし' },
          ]}
          onChange={(v) => st('hintMode', v)}
        />
        <Toggle
          label="相手の手牌を見る（練習モード）"
          desc="対局中、他家の手牌を表向きで見ます。テンパイ・待ち・フリテンも表示。対局中のボタンや「☰」メニューでも切り替えられます"
          value={settings.openHands}
          onChange={(v) => st('openHands', v)}
        />
        <Toggle label="鳴き・ロンの助言" desc="ポン・チーできるときに、鳴くべきかどうかの理由を表示" value={settings.callAdvice} onChange={(v) => st('callAdvice', v)} />
        <Toggle label="牌の名前を表示" desc="手牌の下に「5萬」「東」などの名前を出します" value={settings.showNames} onChange={(v) => st('showNames', v)} />
        <Toggle label="鳴きの確認をしない" desc="ロン以外の鳴きは自動でスルー（門前の練習に）" value={settings.autoPassCalls} onChange={(v) => st('autoPassCalls', v)} />
        <Choice
          label="CPUの強さ"
          value={settings.cpuLevel}
          options={[
            { v: 'weak', label: 'よわい' },
            { v: 'normal', label: 'ふつう' },
            { v: 'strong', label: 'つよい' },
          ]}
          onChange={(v) => st('cpuLevel', v)}
        />
        <Choice
          label="進行の速さ"
          value={settings.speed}
          options={[
            { v: 'slow', label: 'ゆっくり' },
            { v: 'normal', label: 'ふつう' },
            { v: 'fast', label: 'はやい' },
          ]}
          onChange={(v) => st('speed', v)}
        />
      </section>

      <section className="set-section">
        <h3>効果音</h3>
        <Toggle label="効果音" desc="牌を切る音・ポン／チー・リーチ・和了などの効果音（BGMはありません）" value={settings.se} onChange={(v) => st('se', v)} />
        <Choice
          label="音の大きさ"
          desc="押すと、その大きさで試し聞きできます"
          value={settings.seVolume}
          options={[
            { v: 35, label: '小' },
            { v: 70, label: '中' },
            { v: 100, label: '大' },
          ]}
          onChange={(v) => {
            st('seVolume', v)
            // 音量の反映を待ってから、試し聞き
            setTimeout(() => playSound('pon'), 60)
          }}
        />
        <div className="set-desc se-note">iPhoneは、本体横のマナーモード（消音スイッチ）がオンだと鳴りません。音が出ないときは確認してください。</div>
      </section>

      <section className="set-section">
        <h3>ルール</h3>
        <div className="set-desc">ルールの変更は、次に始める対局から反映されます。</div>
        <div className="presets">
          {RULE_PRESETS.map((p) => (
            <button key={p.id} className={`preset ${presetMatch?.id === p.id ? 'on' : ''}`} onClick={() => onRules(p.rules)}>
              <div className="preset-name">{p.name}</div>
              <div className="preset-desc">{p.desc}</div>
            </button>
          ))}
        </div>
        <Choice
          label="対局の長さ"
          desc="東風戦＝東場のみ（4局〜）、半荘戦＝東場＋南場（8局〜）"
          value={r.length}
          options={[
            { v: 'tonpuu', label: '東風戦' },
            { v: 'hanchan', label: '半荘戦' },
          ]}
          onChange={(v) => set('length', v)}
        />
        <Choice
          label="持ち点"
          value={r.startPoints}
          options={[
            { v: 25000, label: '25000' },
            { v: 30000, label: '30000' },
          ]}
          onChange={(v) => onRules({ ...r, startPoints: v, returnPoints: Math.max(v, r.returnPoints) })}
        />
        <Choice
          label="返し（原点）"
          desc="オカ・西入・アガリやめの基準点"
          value={r.returnPoints}
          options={[
            { v: 25000, label: '25000' },
            { v: 30000, label: '30000' },
          ].filter((o) => o.v >= r.startPoints)}
          onChange={(v) => set('returnPoints', v)}
        />
        <Choice
          label="ウマ"
          desc="順位による成績の加減（2着・3着の差 / 1着・4着の差）"
          value={`${r.uma[0]}-${r.uma[1]}`}
          options={[
            { v: '0-0', label: 'なし' },
            { v: '5-10', label: '5-10' },
            { v: '10-20', label: '10-20' },
            { v: '10-30', label: '10-30' },
            { v: '20-30', label: '20-30' },
          ]}
          onChange={(v) => set('uma', v.split('-').map(Number) as [number, number])}
        />
        <Toggle label="オカ" desc="(返し−持ち点)×4 をトップがもらう" value={r.oka} onChange={(v) => set('oka', v)} />
        <Choice
          label="赤ドラ"
          desc="赤い5の牌。持っているだけで1翻"
          value={r.aka}
          options={[
            { v: 0, label: 'なし' },
            { v: 3, label: '3枚' },
            { v: 4, label: '4枚（5筒×2）' },
          ]}
          onChange={(v) => set('aka', v)}
        />
        <Toggle label="喰いタン" desc="鳴いてもタンヤオが成立" value={r.kuitan} onChange={(v) => set('kuitan', v)} />
        <Toggle label="後付け" desc="なしの場合、鳴いた手はすべての待ちで役がないと和了れない" value={r.atozuke} onChange={(v) => set('atozuke', v)} />
        <Toggle label="一発" value={r.ippatsu} onChange={(v) => set('ippatsu', v)} />
        <Toggle label="裏ドラ" value={r.uradora} onChange={(v) => set('uradora', v)} />
        <Toggle label="カンドラ" desc="カンするとドラが増える（カン裏も含む）" value={r.kandora} onChange={(v) => set('kandora', v)} />
        <Toggle label="飛び" desc="誰かの点数がマイナスになったら終了" value={r.tobi} onChange={(v) => set('tobi', v)} />
        <Choice
          label="同時にロンされたとき"
          value={r.multiRon}
          options={[
            { v: 'double', label: 'ダブロンあり' },
            { v: 'atamahane', label: '頭ハネ' },
          ]}
          onChange={(v) => set('multiRon', v)}
        />
        <Toggle label="途中流局" desc="九種九牌・四風連打・四家立直・四槓散了・三家和" value={r.tochuRyuukyoku} onChange={(v) => set('tochuRyuukyoku', v)} />
        <Toggle label="流し満貫" value={r.nagashiMangan} onChange={(v) => set('nagashiMangan', v)} />
        <Toggle label="西入" desc="オーラスで誰も返しに届かなければ西場へ延長" value={r.westRound} onChange={(v) => set('westRound', v)} />
        <Toggle label="アガリやめ" desc="オーラスで親が和了ってトップなら終了" value={r.agariYame} onChange={(v) => set('agariYame', v)} />
        <Choice
          label="親の連荘"
          value={r.renchan}
          options={[
            { v: 'tenpai', label: 'テンパイ連荘' },
            { v: 'agari', label: '和了連荘' },
          ]}
          onChange={(v) => set('renchan', v)}
        />
        <Toggle label="数え役満" desc="13翻以上で役満（なしなら三倍満）" value={r.kazoeYakuman} onChange={(v) => set('kazoeYakuman', v)} />
        <Toggle label="切り上げ満貫" desc="4翻30符・3翻60符を満貫として扱う" value={r.kiriageMangan} onChange={(v) => set('kiriageMangan', v)} />
        <Toggle label="ダブル役満" desc="国士十三面・四暗刻単騎・純正九蓮・大四喜" value={r.doubleYakuman} onChange={(v) => set('doubleYakuman', v)} />
      </section>
      <div className="page-foot">
        <button className="btn btn-main" onClick={onBack}>
          もどる
        </button>
      </div>
    </div>
  )
}

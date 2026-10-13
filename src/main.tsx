import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
import './styles.css'
import { playSound, unlockSound } from './sound'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// オフラインでも遊べるように（ネットにつながるときは常に最新を取得）
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {})
  })
}

// スマホは、画面を操作するまで音を出せない。最初のタップで音を使えるようにする
document.addEventListener('pointerdown', unlockSound, { capture: true })
document.addEventListener('touchend', unlockSound, { capture: true })
document.addEventListener('keydown', unlockSound, { capture: true })

// ボタンを押したときの小さな音（牌や、牌を切る操作は、それぞれ専用の音を鳴らす）
document.addEventListener(
  'click',
  (e) => {
    const t = e.target
    if (t instanceof Element && t.closest('button, .chip, .tab, .preset, label.set-row')) playSound('tap')
  },
  { capture: true },
)

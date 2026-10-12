import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

// スマホ配布用: すべてを1つのHTMLファイルにまとめてビルドする設定。
// 更新直後にキャッシュの食い違いで「真っ白」になるのを防ぐ。
export default defineConfig({
  base: './',
  plugins: [react(), viteSingleFile()],
  build: {
    outDir: 'dist-single',
    assetsInlineLimit: 100000000,
    cssCodeSplit: false,
  },
})

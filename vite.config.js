import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// GitHub Pages 배포 시 리포지토리 이름으로 base를 바꿔주세요.
// 예: 리포지토리가 https://github.com/USERNAME/pra-paint 라면 base: '/pra-paint/'
export default defineConfig({
  base: '/pra-paint/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Next Build',
        short_name: 'Next Build',
        description: '프라모델 킷 제작 계획과 도료 재고 관리',
        theme_color: '#16181B',
        background_color: '#16181B',
        display: 'standalone',
        start_url: '/pra-paint/',
        scope: '/pra-paint/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' }
        ]
      }
    })
  ]
})

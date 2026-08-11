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
        name: '프라 도료 관리',
        short_name: '도료관리',
        description: '프라모델 도료 재고 및 매칭 관리',
        theme_color: '#1E1B18',
        background_color: '#1E1B18',
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

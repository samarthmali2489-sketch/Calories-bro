import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [
      react(), 
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
        manifest: {
          name: 'Cal.ai',
          short_name: 'Cal.ai',
          description: 'Your intelligent nutrition assistant',
          theme_color: '#0a0a0a',
          background_color: '#0a0a0a',
          display: 'standalone',
          orientation: 'portrait',
          icons: [
            {
              src: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBR2eh3E1AbrnepIjFPO8gW0Wxfu_HmL2GpA_elqepKKYVVadYp7CRRsegm2nNEWYLyrzFoXUm8pu0Bsw3W6_CfUmSNajyyVXxOJRwEnvpvNiu_7PT5vt4GgqNfrM1IY64odnUmMZgaLanLqkQLnrdIQbHQsfDIU9wj6DSP0eQwDuqP9Zy88mrJsXpgwmy7E1AtEm39NkMgoP0mBl0zCP80IJWl4dSgDfo9LfHzuFvpxXGuly-LVzxg8SLoLNmXjTnFT8zK5u6ei6o',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBR2eh3E1AbrnepIjFPO8gW0Wxfu_HmL2GpA_elqepKKYVVadYp7CRRsegm2nNEWYLyrzFoXUm8pu0Bsw3W6_CfUmSNajyyVXxOJRwEnvpvNiu_7PT5vt4GgqNfrM1IY64odnUmMZgaLanLqkQLnrdIQbHQsfDIU9wj6DSP0eQwDuqP9Zy88mrJsXpgwmy7E1AtEm39NkMgoP0mBl0zCP80IJWl4dSgDfo9LfHzuFvpxXGuly-LVzxg8SLoLNmXjTnFT8zK5u6ei6o',
              sizes: '512x512',
              type: 'image/png'
            }
          ]
        }
      })
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});

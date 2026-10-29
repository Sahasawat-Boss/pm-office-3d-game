import { defineConfig } from 'vite';

export default defineConfig({
  base: './',            // ให้ build ไปวางที่ไหนก็เปิดได้ (Vercel / GitHub Pages / โฟลเดอร์ย่อย)
  build: { chunkSizeWarningLimit: 1000 }
});

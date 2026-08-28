import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    watch: {
      // Predpomnjeni zapisniki niso del aplikacije. Brez tega Vite ob vsakem
      // uvozu sproži ponovno nalaganje strani za vsako od 150+ datotek.
      ignored: ['**/scripts/.predpomnilnik/**', '**/supabase/.temp/**'],
    },
  },
})

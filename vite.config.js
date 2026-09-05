import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'node:child_process'

/**
 * V zgrajeno stran zapiše commit, iz katerega je nastala.
 *
 * Brez tega ni načina, da bi od zunaj preverili, KAJ je pravzaprav v zraku.
 * To ni teoretično: povezava med Vercelom in GitHubom se je 3. septembra
 * podrla (repozitorij se je preimenoval, Vercel je obdržal staro pot) in
 * produkcija je dva dni tiho stregla staro različico. Nič ni javilo napake —
 * deploy se preprosto ni zgodil. Zdaj to ujame `preveri-deploy` v CI.
 */
function znamkaCommita() {
  const sha =
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.GITHUB_SHA ||
    (() => {
      try {
        return execSync('git rev-parse HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
          .toString()
          .trim()
      } catch {
        return ''
      }
    })()

  return {
    name: 'znamka-commita',
    transformIndexHtml(html) {
      if (!sha) return html
      return html.replace(
        '</head>',
        `    <meta name="slff-commit" content="${sha}" />\n  </head>`,
      )
    },
  }
}

export default defineConfig({
  plugins: [react(), znamkaCommita()],
  server: {
    watch: {
      // Predpomnjeni zapisniki niso del aplikacije. Brez tega Vite ob vsakem
      // uvozu sproži ponovno nalaganje strani za vsako od 150+ datotek.
      ignored: ['**/scripts/.predpomnilnik/**', '**/supabase/.temp/**'],
    },
  },
})

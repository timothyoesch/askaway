import tailwindcss from '@tailwindcss/vite'

// https://nuxt.com/docs/api/configuration/nuxt-config
//
// The app is built as a static SPA (`nuxt generate`) and served by PocketBase
// from pb_public. Code is kept SSR-safe (no window/document access outside
// onMounted or client-only composables) so `ssr: true` can be switched on later
// if link previews ever need a Nuxt server. See docs/development.md.
export default defineNuxtConfig({
  compatibilityDate: '2026-10-01',
  ssr: false,
  devtools: { enabled: true },

  modules: ['@nuxtjs/i18n'],

  css: ['~/assets/css/main.css'],

  vite: {
    plugins: [tailwindcss()],
  },

  runtimeConfig: {
    public: {
      // Empty = same origin (production, PocketBase serves the app).
      // In development set NUXT_PUBLIC_PB_URL=http://127.0.0.1:8090
      pbUrl: '',
    },
  },

  i18n: {
    strategy: 'no_prefix',
    defaultLocale: 'de',
    locales: [
      { code: 'de', language: 'de-CH', name: 'Deutsch', file: 'de.json' },
      { code: 'en', language: 'en', name: 'English', file: 'en.json' },
    ],
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: 'askaway_lang',
      redirectOn: 'root',
      fallbackLocale: 'de',
    },
  },

  app: {
    head: {
      meta: [
        { name: 'theme-color', content: '#ffadec' },
        { property: 'og:image', content: '/og.png' },
        { name: 'twitter:card', content: 'summary_large_image' },
      ],
      link: [
        { rel: 'icon', type: 'image/png', href: '/favicon/favicon-96x96.png', sizes: '96x96' },
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon/favicon.svg' },
        { rel: 'shortcut icon', href: '/favicon/favicon.ico' },
        { rel: 'apple-touch-icon', href: '/favicon/apple-touch-icon.png' },
        { rel: 'manifest', href: '/favicon/site.webmanifest' },
      ],
    },
  },
})

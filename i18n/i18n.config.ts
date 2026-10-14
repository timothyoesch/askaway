const datetime = {
  short: { year: 'numeric', month: 'short', day: 'numeric' },
  long: { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' },
} as const

export default defineI18nConfig(() => ({
  fallbackLocale: 'de',
  datetimeFormats: {
    'de': datetime,
    'en': datetime,
  },
}))

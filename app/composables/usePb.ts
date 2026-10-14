import PocketBase from 'pocketbase'

let client: PocketBase | null = null

// Shared PocketBase client. Only call from client-side code (setup in pages is
// fine while ssr is off; use onMounted for anything that must stay SSR-safe).
export function usePb(): PocketBase {
  if (!client) {
    const base = useRuntimeConfig().public.pbUrl as string
    client = new PocketBase(base || window.location.origin)
    client.autoCancellation(false)
  }
  return client
}

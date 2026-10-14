import type { RealtimeMessage } from '~/utils/types'

// Subscribes to Ask Away! realtime topics for the lifetime of the component.
// `onReconnect` fires after a dropped connection comes back, so pages can
// reload their state and catch up on anything they missed meanwhile.
export function useRealtime() {
  const pb = usePb()
  const unsubscribers: Array<() => Promise<void>> = []
  let stopped = false

  async function subscribe(
    topic: string,
    handler: (message: RealtimeMessage) => void,
    headers?: Record<string, string>,
  ) {
    const unsubscribe = await pb.realtime.subscribe(
      topic,
      (data: RealtimeMessage) => handler(data),
      headers ? { headers } : undefined,
    )
    if (stopped) unsubscribe()
    else unsubscribers.push(unsubscribe)
  }

  async function onReconnect(handler: () => void) {
    let first = true
    const unsubscribe = await pb.realtime.subscribe('PB_CONNECT', () => {
      if (first) {
        first = false
        return
      }
      handler()
    })
    if (stopped) unsubscribe()
    else unsubscribers.push(unsubscribe)
  }

  function stop() {
    stopped = true
    for (const unsubscribe of unsubscribers.splice(0)) {
      unsubscribe().catch(() => {})
    }
  }

  onBeforeUnmount(stop)

  return { subscribe, onReconnect, stop }
}

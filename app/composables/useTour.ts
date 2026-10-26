import { driver, type Driver, type DriveStep } from 'driver.js'
import 'driver.js/dist/driver.css'
import { toast } from 'vue-sonner'

export interface TourStep {
  /** CSS selector of the element to highlight; omit for a centred message. */
  element?: string
  title: string
  text: string
  side?: 'top' | 'right' | 'bottom' | 'left'
}

// Both settings live in this browser (localStorage), not per event, so they
// carry over to every event the person moderates.
const SEEN_KEY = 'askaway:tours-seen'
const AUTO_KEY = 'askaway:tours-auto'

function read<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key)
    return raw === null ? fallback : (JSON.parse(raw) as T)
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage blocked: the setting only lasts for this visit.
  }
}

let active: Driver | null = null

// Short guided tours (driver.js). Each tour has an id; `autoStart` only runs a
// tour the first time this browser sees it (and only while automatic tips are
// on), `start` always runs it (help menu).
export function useTour() {
  const { t } = useI18n()
  const autoEnabled = useState('tours-auto', () => (import.meta.client ? read(AUTO_KEY, true) : true))

  function start(id: string, steps: TourStep[], options: { auto?: boolean, onClose?: () => void } = {}) {
    active?.destroy()
    const usable = steps.filter(step => !step.element || document.querySelector(step.element))
    if (!usable.length) {
      options.onClose?.()
      return
    }
    markSeen(id)

    const driveSteps: DriveStep[] = usable.map(step => ({
      element: step.element,
      popover: { title: step.title, description: step.text, side: step.side },
    }))

    active = driver({
      steps: driveSteps,
      popoverClass: 'askaway-tour',
      showProgress: usable.length > 1,
      progressText: '{{current}} / {{total}}',
      nextBtnText: t('tour.next'),
      prevBtnText: t('tour.back'),
      doneBtnText: t('tour.done'),
      stagePadding: 6,
      stageRadius: 16,
      overlayColor: '#2a0099',
      overlayOpacity: 0.35,
      smoothScroll: true,
      // Tours that started on their own get a way out for good.
      onPopoverRender: (popover) => {
        if (!options.auto) return
        const optOut = document.createElement('button')
        optOut.type = 'button'
        optOut.className = 'askaway-tour-optout'
        optOut.textContent = t('tour.disable')
        optOut.addEventListener('click', () => {
          setAuto(false)
          active?.destroy()
          toast(t('tour.disabledInfo'))
        })
        popover.wrapper.appendChild(optOut)
      },
      onDestroyed: () => {
        active = null
        options.onClose?.()
      },
    })
    active.drive()
  }

  function autoStart(id: string, steps: TourStep[], options: { onClose?: () => void } = {}) {
    if (active || !autoEnabled.value || hasSeen(id)) return false
    start(id, steps, { ...options, auto: true })
    return true
  }

  function markSeen(id: string) {
    const seen = read<string[]>(SEEN_KEY, [])
    if (!seen.includes(id)) write(SEEN_KEY, [...seen, id])
  }

  function hasSeen(id: string) {
    return read<string[]>(SEEN_KEY, []).includes(id)
  }

  // Switching tips back on also forgets which tours were seen, so they show again.
  function setAuto(value: boolean) {
    autoEnabled.value = value
    write(AUTO_KEY, value)
    if (value) write(SEEN_KEY, [])
  }

  onBeforeUnmount(() => active?.destroy())

  return { start, autoStart, hasSeen, autoEnabled, setAuto }
}

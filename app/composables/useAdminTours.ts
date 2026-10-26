import type { TourStep } from './useTour'
import type { AdminEvent, Role } from '~/utils/types'

export type AdminTourId = 'basics' | 'queue' | 'live' | 'share' | 'settings'

interface Context {
  role: Role
  event: AdminEvent
  hasPending: boolean
  hasLive: boolean
}

// Step definitions for the moderation page tours. Each tour belongs to one
// area and stays short (2–5 steps). Steps whose element isn't on the page are
// skipped by useTour. Empty question lists show a sample card while the tour runs.
export function useAdminTours() {
  const { t } = useI18n()

  function menuItems(role: Role) {
    const items: Array<{ id: AdminTourId, emoji: string, label: string }> = [
      { id: 'basics', emoji: '🎛️', label: t('tour.menu.basics') },
      { id: 'queue', emoji: '🛡️', label: t('tour.menu.queue') },
      { id: 'live', emoji: '🎤', label: t('tour.menu.live') },
      { id: 'share', emoji: '🔗', label: t('tour.menu.share') },
    ]
    if (role === 'owner') items.push({ id: 'settings', emoji: '⚙️', label: t('tour.menu.settings') })
    return items
  }

  function steps(id: AdminTourId, ctx: Context): TourStep[] {
    const owner = ctx.role === 'owner'
    switch (id) {
      case 'basics':
        return [
          { title: t('tour.basics.welcomeTitle'), text: owner ? t('tour.basics.welcomeOwner') : t('tour.basics.welcomeMod') },
          { element: '[data-tour="screen"]', title: t('tour.basics.screenTitle'), text: t('tour.basics.screen') },
          { element: '[data-tour="presenter"]', title: t('tour.basics.presenterTitle'), text: t('tour.basics.presenter') },
          { element: '[data-tour="tabs"]', title: t('tour.basics.tabsTitle'), text: t('tour.basics.tabs') },
          { element: '[data-tour="help"]', title: t('tour.basics.helpTitle'), text: t('tour.basics.help') },
        ]
      case 'queue':
        return [
          // With an empty queue the page shows a sample question during the tour.
          {
            element: '[data-tour="first-pending"]',
            title: t('tour.queue.decideTitle'),
            text: ctx.hasPending ? t('tour.queue.decide') : `${t('tour.queue.decide')} ${t('tour.queue.empty')}`,
          },
          ctx.event.moderation
            ? { element: '[data-tour="tab-declined"]', title: t('tour.queue.undoTitle'), text: t('tour.queue.undo') }
            : { title: t('tour.queue.offTitle'), text: t('tour.queue.off') },
          ...(owner ? [{ element: '[data-tour="tab-settings"]', title: t('tour.queue.switchTitle'), text: t('tour.queue.switch') }] : []),
        ]
      case 'live':
        return [
          {
            element: '[data-tour="first-live"]',
            title: t('tour.live.actionsTitle'),
            text: ctx.hasLive ? t('tour.live.actions') : `${t('tour.live.actions')} ${t('tour.live.empty')}`,
          },
          { element: '[data-tour="spotlight-box"]', title: t('tour.live.spotlightTitle'), text: t('tour.live.spotlight') },
          { element: '[data-tour="tab-answered"]', title: t('tour.live.answeredTitle'), text: t('tour.live.answered') },
        ]
      case 'share':
        return [
          { element: '[data-tour="share-public"]', title: t('tour.share.publicTitle'), text: t('tour.share.public') },
          ...(owner
            ? [
                { element: '[data-tour="share-team"]', title: t('tour.share.teamTitle'), text: t('tour.share.team') },
                { element: '[data-tour="share-account"]', title: t('tour.share.accountTitle'), text: t('tour.share.account') },
              ]
            : [{ title: t('tour.share.modTitle'), text: t('tour.share.mod') }]),
        ]
      case 'settings':
        return [
          { element: '[data-tour="settings-moderation"]', title: t('tour.settings.moderationTitle'), text: t('tour.settings.moderation') },
          { element: '[data-tour="settings-newsletter"]', title: t('tour.settings.newsletterTitle'), text: t('tour.settings.newsletter') },
          { element: '[data-tour="settings-export"]', title: t('tour.settings.exportTitle'), text: t('tour.settings.export') },
          { element: '[data-tour="settings-danger"]', title: t('tour.settings.closeTitle'), text: t('tour.settings.close') },
        ]
    }
  }

  return { menuItems, steps }
}

import type { TourStep } from './useTour'
import type { AdminEvent, Role } from '~/utils/types'

export type AdminTourId = 'basics' | 'questions' | 'share' | 'settings'

interface Context {
  role: Role
  event: AdminEvent
  hasPending: boolean
  hasLive: boolean
}

// Step definitions for the moderation page tours. Each tour belongs to one
// area and stays short (2–5 steps). Steps whose element isn't on the page are
// skipped by useTour. Without real questions, the questions tour shows sample cards.
export function useAdminTours() {
  const { t } = useI18n()

  function menuItems(role: Role) {
    const items: Array<{ id: AdminTourId, emoji: string, label: string }> = [
      { id: 'basics', emoji: '🎛️', label: t('tour.menu.basics') },
      { id: 'questions', emoji: '💬', label: t('tour.menu.questions') },
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
      case 'questions':
        return [
          { element: '[data-tour="question-filter"]', title: t('tour.questions.filterTitle'), text: t('tour.questions.filter') },
          // With moderation on, an empty list shows a sample waiting question during the tour.
          ctx.event.moderation || ctx.hasPending
            ? { element: '[data-tour="first-pending"]', title: t('tour.questions.decideTitle'), text: t('tour.questions.decide') }
            : { title: t('tour.questions.offTitle'), text: owner ? `${t('tour.questions.off')} ${t('tour.questions.offOwner')}` : t('tour.questions.off') },
          {
            element: '[data-tour="first-live"]',
            title: t('tour.questions.actionsTitle'),
            text: ctx.hasLive ? t('tour.questions.actions') : `${t('tour.questions.actions')} ${t('tour.questions.empty')}`,
          },
          { element: '[data-tour="spotlight-box"]', title: t('tour.questions.spotlightTitle'), text: t('tour.questions.spotlight') },
          { element: '[data-tour="tab-answered"]', title: t('tour.questions.archiveTitle'), text: t('tour.questions.archive') },
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

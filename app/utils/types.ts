export type Screen = 'registration' | 'questions'
export type Role = 'owner' | 'mod'
export type QuestionStatus = 'pending' | 'approved' | 'rejected'

export interface PublicEvent {
  code: string
  title: string
  description: string
  startsAt: string | null
  screen: Screen
  moderation: boolean
  spotlight: string | null
  closed: boolean
  closedAt: string | null
  newsletter: {
    org: string
    purpose: string
    privacyUrl: string | null
    consentText?: string
  } | null
}

export interface AdminEvent extends PublicEvent {
  hasOwner: boolean
  newsletterAvailable: boolean
  newsletterEnabled: boolean
  newsletterOrg: string
  newsletterPurpose: string
  newsletterPrivacyUrl: string
  created: string
  lastActivityAt: string
}

export interface Question {
  id: string
  content: string
  animal: string
  name: string
  votes: number
  pinned: boolean
  answeredAt: string | null
  created: string
  status?: QuestionStatus
  approvedAt?: string | null
}

export interface Participant {
  id: string
  animal: string
  name: string
}

export interface Me {
  participant: Participant
  votes: string[]
  questions: Question[]
  ownApproved: string[]
}

export interface InstanceConfig {
  eventCreation: 'anyone' | 'registered'
  registration: 'open' | 'closed'
  mailEnabled: boolean
  defaultModeration: boolean
  questionMaxLength: number
  questionCooldownSeconds: number
  retentionDays: number
}

export type RealtimeMessage =
  | { type: 'question', question: Question }
  | { type: 'question_removed', id: string }
  | { type: 'votes', id: string, votes: number }
  | { type: 'event', event: PublicEvent | AdminEvent }
  | { type: 'deleted' }
  | { type: 'access_revoked' }

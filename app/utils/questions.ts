import type { Question } from './types'

export type SortMode = 'popular' | 'newest'

// Pinned first, then by votes (or newest), oldest first on ties so early
// questions don't get leapfrogged by later ones with the same count.
export function sortQuestions(list: Question[], mode: SortMode = 'popular'): Question[] {
  return [...list].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
    if (mode === 'popular' && a.votes !== b.votes) return b.votes - a.votes
    const diff = new Date(a.created).getTime() - new Date(b.created).getTime()
    return mode === 'newest' ? -diff : diff
  })
}

export function upsert(list: Question[], question: Question): Question[] {
  const index = list.findIndex(q => q.id === question.id)
  if (index === -1) return [...list, question]
  const next = [...list]
  next[index] = { ...next[index], ...question }
  return next
}

export function remove(list: Question[], id: string): Question[] {
  return list.filter(q => q.id !== id)
}

export function setVotes(list: Question[], id: string, votes: number): Question[] {
  return list.map(q => (q.id === id ? { ...q, votes } : q))
}

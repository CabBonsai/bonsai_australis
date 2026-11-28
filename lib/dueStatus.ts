// Due-date urgency for care tasks: label and colours for a prominent due chip.
// overdue = strong red, due today = orange, within a week = amber, later = calm green.

export type DueTone = 'overdue' | 'today' | 'soon' | 'later' | 'none'

export interface DueStatus {
  tone: DueTone
  days: number | null // negative = overdue
  headline: string
  dateText: string
  fg: string
  bg: string
  border: string
  cardBg: string
  cardBorder: string
}

function localToday(): string {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

function utcMs(dateStr: string): number {
  const [y, m, d] = dateStr.slice(0, 10).split('-').map(Number)
  return Date.UTC(y, (m || 1) - 1, d || 1)
}

export function dueStatus(dueDate: string | null | undefined, today: string = localToday()): DueStatus {
  if (!dueDate) {
    return { tone: 'none', days: null, headline: 'No due date', dateText: '', fg: '#6b7280', bg: '#f3f4f6', border: '#d1d5db', cardBg: '#f3f7ea', cardBorder: '#cdd9b4' }
  }
  const days = Math.round((utcMs(dueDate) - utcMs(today)) / 86400000)
  const dateText = new Date(utcMs(dueDate)).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
  const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'}`

  if (days < 0) {
    return { tone: 'overdue', days, headline: `OVERDUE by ${plural(-days, 'day')}`, dateText: `was due ${dateText}`, fg: '#ffffff', bg: '#dc2626', border: '#b91c1c', cardBg: '#fef2f2', cardBorder: '#dc2626' }
  }
  if (days === 0) {
    return { tone: 'today', days, headline: 'Due TODAY', dateText, fg: '#ffffff', bg: '#ea580c', border: '#c2410c', cardBg: '#fff7ed', cardBorder: '#fb923c' }
  }
  if (days <= 7) {
    return { tone: 'soon', days, headline: `Due in ${plural(days, 'day')}`, dateText, fg: '#92400e', bg: '#fef3c7', border: '#f59e0b', cardBg: '#fffbeb', cardBorder: '#fcd34d' }
  }
  const headline = days <= 60 ? `Due in ${plural(days, 'day')}` : `Due in about ${plural(Math.round(days / 30), 'month')}`
  return { tone: 'later', days, headline, dateText, fg: '#3f5228', bg: '#e8f0d8', border: '#cdd9b4', cardBg: '#f3f7ea', cardBorder: '#cdd9b4' }
}

// Client-side downloads for exports (questions, newsletter sign-ups).

export function toCsv(rows: Array<Record<string, unknown>>): string {
  if (!rows.length) return ''
  const headers = Object.keys(rows[0]!)
  const escape = (value: unknown) => {
    const s = value === null || value === undefined ? '' : String(value)
    // Quote everything; neutralise spreadsheet formulas (=, +, -, @).
    const safe = /^[=+\-@]/.test(s) ? `'${s}` : s
    return `"${safe.replace(/"/g, '""')}"`
  }
  return [headers.map(escape).join(','), ...rows.map(row => headers.map(h => escape(row[h])).join(','))].join('\r\n')
}

export function download(filename: string, content: string, type = 'text/csv') {
  // BOM so Excel opens UTF-8 CSVs (umlauts!) correctly.
  const blob = new Blob([type === 'text/csv' ? '﻿' + content : content], { type: `${type};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function slug(text: string) {
  return text.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'event'
}

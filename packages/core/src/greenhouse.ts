import { z } from 'zod'

const posting = z.object({
  id: z.number().int().positive(),
  title: z.string().trim().min(1).max(240),
  location: z.object({ name: z.string().trim().max(400) }),
  content: z.string().max(96_000).optional(),
  absolute_url: z.string().max(2048),
})
export const greenhousePayload = z.object({
  jobs: z.array(posting).max(500),
  meta: z.object({ total: z.number().int().nonnegative() }),
})

const entities: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', rsquo: '’',
}
function decodeEntities(text: string) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, name: string) => {
    if (!name.startsWith('#')) return Object.hasOwn(entities, name) ? entities[name] : entity
    const hex = name[1]?.toLowerCase() === 'x'
    const code = Number.parseInt(name.slice(hex ? 2 : 1), hex ? 16 : 10)
    return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff)
      ? String.fromCodePoint(code) : ''
  })
}

function plainText(html: string) {
  return decodeEntities(decodeEntities(html)
    .replace(/<!--[\s\S]*?-->|<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<\/?(?:p|div|br|li|h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<[^>]*>/g, ''))
    .replace(/\u0000/g, '')
    .split(/\r?\n/).map((line) => line.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n')
}

export function matchPosting(title: string, location: string, jd: string) {
  const fullStack = /\bfull[\s–-]*stack\b/i.test(title)
  const frontEnd = /\bfront[\s–-]*end\b/i.test(title)
  if (!fullStack && !(frontEnd && /\breact(?:\.js|js)?\b/i.test(title + ' ' + jd))) return null

  const explicitCanada = /\b(?:Canada|Canadian|British Columbia|Ontario|Québec|Quebec|Alberta|Manitoba|Saskatchewan|Nova Scotia|New Brunswick|Newfoundland|Labrador|Prince Edward Island|Northwest Territories|Nunavut|Yukon)\b|(?:^|[,(/]\s*)(?:BC|ON|QC|AB|MB|SK|NS|NB|NL|PE|NT|NU|YT)\s*(?:[,);/]|$)/i.test(location)
  const remoteCanada = /\bremote\b/i.test(location) &&
    /\bremote\s*[-–:(]?\s*(?:within\s+|in\s+)?Canada\b|\bmust\s+(?:reside|be based|be located)\s+in\s+Canada\b/i.test(jd)
  if (!explicitCanada && !remoteCanada) return null
  const canadianVancouver = location.split(/[;|]/).some((part) =>
    /\bvancouver\b/i.test(part) && /\b(?:BC|British Columbia|Canada)\b/i.test(part) &&
    !/\b(?:WA|Washington|USA)\b|\b(?:North|West|Metro|Greater) Vancouver\b/i.test(part))
  if (canadianVancouver) return 0
  if (/\b(?:Metro Vancouver|Greater Vancouver|North Vancouver|West Vancouver|Burnaby|Richmond|Surrey|Coquitlam)\b/i.test(location) &&
      /\b(?:BC|British Columbia)\b/i.test(location)) return 1
  return 2
}

export type CollectedJob = {
  externalId: string
  title: string
  location: string
  url: string
  jd: string
  priority: number
}

export function normalizeGreenhouse(raw: z.infer<typeof posting>): CollectedJob | null {
  const url = URL.parse(raw.absolute_url)
  if (!url || url.protocol !== 'https:' || url.username || url.password || url.port ||
      !url.hostname.includes('.') || url.hostname.endsWith('.local') ||
      /^(?:[\d.]+|\[.*\])$/.test(url.hostname)) return null
  url.hash = ''
  const { title, location: { name: location } } = raw
  const jd = plainText(raw.content ?? '')
  const priority = matchPosting(title, location, jd)
  if (!jd || priority === null) return null
  return { externalId: String(raw.id), title, location, url: url.href, jd, priority }
}

export const API = 'https://musegod.org/api/v1'
export const SITE = 'https://musegod.org'

export type MuseSummary = {
  id: number
  name: string
  tier: string
  rank: number
  traits: Record<string, string>
  owner: string | null
  page: string
  image: string
}

export type MuseDetail = Omit<MuseSummary, 'owner'> & {
  owner: { address: string; name?: string } | string | null
  soul?: { source: string; md: string; intro?: string; tone?: string[]; help?: string; line?: string } | null
  agent?: { agentId: number; holderControls: boolean }
  links?: { prompt: string; page: string; registration: string; opensea: string; images?: Record<string, string> }
}

export type MusePage = { total: number; limit: number; offset: number; muses: MuseSummary[] }

export function isAddress(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value)
}

export async function fetchOwnedMuses(address: string, signal?: AbortSignal): Promise<MuseSummary[]> {
  if (!isAddress(address)) throw new Error('A valid EVM wallet address is required.')
  const result: MuseSummary[] = []
  let offset = 0
  do {
    const response = await fetch(`${API}/muses?owner=${encodeURIComponent(address)}&limit=100&offset=${offset}`, { signal })
    if (!response.ok) throw new Error(`Muse API returned ${response.status}. Please retry.`)
    const page = (await response.json()) as MusePage
    if (!Array.isArray(page.muses) || typeof page.total !== 'number') throw new Error('Muse API returned an unexpected response.')
    result.push(...page.muses.filter((muse) => muse.owner?.toLowerCase() === address.toLowerCase()))
    offset += page.muses.length
    if (page.muses.length === 0) break
    if (offset >= page.total || offset >= 999) break
  } while (true)
  return result
}

export async function fetchMuse(id: number, signal?: AbortSignal): Promise<MuseDetail> {
  if (!Number.isInteger(id) || id < 1 || id > 999) throw new Error('Invalid muse ID.')
  const response = await fetch(`${API}/muses/${id}`, { signal })
  if (!response.ok) throw new Error(`Muse details returned ${response.status}. Please retry.`)
  return (await response.json()) as MuseDetail
}

export function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

export function safeMuseUrl(url: string | undefined, fallback: string): string {
  if (!url) return fallback
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' && ['musegod.org', 'opensea.io'].includes(parsed.hostname) ? parsed.href : fallback
  } catch {
    return fallback
  }
}

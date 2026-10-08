import { fetchJson } from './core.js'

export function sanitizeFlockState(raw) {
  return {
    fetchedAt: Number.isFinite(raw?.fetchedAt) ? raw.fetchedAt : null,
    calls: (Array.isArray(raw?.calls) ? raw.calls : []).slice(0, 2).map((item) => ({
      call: { brief: String(item?.call?.brief ?? '').slice(0, 1000), timestamp: Number.isFinite(item?.call?.timestamp) ? item.call.timestamp : null },
      results: (Array.isArray(item?.results) ? item.results : []).slice(0, 50).map((result) => ({
        agent: { number: Number.isInteger(result?.agent?.number) ? result.agent.number : null, name: String(result?.agent?.name ?? '').slice(0, 100), namedToken: Number.isInteger(result?.agent?.namedToken) ? result.agent.namedToken : null },
        text: String(result?.text ?? '').slice(0, 2000), timestamp: Number.isFinite(result?.timestamp) ? result.timestamp : null, picked: result?.picked === true,
      })),
    })),
    credits: (Array.isArray(raw?.credits) ? raw.credits : []).slice(0, 100).map((item) => ({ agent: { number: item?.agent?.number ?? null, name: String(item?.agent?.name ?? '').slice(0, 100) }, picks: Number.isFinite(item?.picks) ? item.picks : null })),
  }
}

export function sanitizeFlockAgent(raw) {
  return { agent: raw?.agent ? { number: raw.agent.number ?? null, name: String(raw.agent.name ?? '').slice(0, 100), token: raw.agent.token ? { id: raw.agent.token.id ?? null, checkedAt: raw.agent.token.checkedAt ?? null } : null, namedToken: raw.agent.namedToken ?? null } : null, picks: Number.isFinite(raw?.picks) ? raw.picks : null, fetchedAt: raw?.fetchedAt ?? null }
}

export async function getFlock(path) { return fetchJson(`https://flock.musegod.org/api/v1/${path}`, { timeout: 8000, attempts: 2 }) }

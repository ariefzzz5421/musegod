import { z } from 'zod'

export const chains = {
  ethereum: { dex: 'ethereum', address: /^0x[a-fA-F0-9]{40}$/ },
  base: { dex: 'base', address: /^0x[a-fA-F0-9]{40}$/ },
  avalanche: { dex: 'avalanche', address: /^0x[a-fA-F0-9]{40}$/ },
  solana: { dex: 'solana', address: /^[1-9A-HJ-NP-Za-km-z]{32,44}$/ },
  robinhood: { dex: null, address: /^0x[a-fA-F0-9]{40}$/ },
  hyperliquid: { dex: null, address: /^0x[a-fA-F0-9]{40}$/ },
}
export const tokenInput = z.object({
  chain: z.enum(Object.keys(chains)),
  address: z.string().trim().min(32).max(44),
  question: z.string().trim().max(500).optional().default(''),
  museId: z.number().int().min(1).max(999).default(242),
})

export function parseTokenInput(value) {
  const input = tokenInput.parse(value)
  if (!chains[input.chain].address.test(input.address)) throw new Error('Invalid token address for this network.')
  return input
}

export function send(res, status, body) {
  res.setHeader('Cache-Control', 'no-store')
  return res.status(status).json(body)
}

export function handleError(res, error) {
  if (error instanceof z.ZodError) return send(res, 400, { error: error.issues.map((issue) => issue.message).join('; ') })
  const status = Number.isInteger(error?.status) ? error.status : 500
  return send(res, status, { error: status >= 500 ? (status === 503 ? error.message : 'The service could not complete this request. Please try again.') : error.message })
}

export function fail(status, message) { const error = new Error(message); error.status = status; throw error }

export function requireMethod(req, method) {
  if (req.method !== method) fail(405, `${method} required.`)
  if (Number(req.headers['content-length'] || 0) > 8192) fail(413, 'Request is too large.')
  if (req.body && JSON.stringify(req.body).length > 8192) fail(413, 'Request is too large.')
}

export async function fetchJson(url, { timeout = 8000, attempts = 2 } = {}) {
  for (let index = 0; index < attempts; index++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeout)
    try {
      const response = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } })
      if ((response.status === 429 || response.status >= 500) && index + 1 < attempts) { await new Promise((resolve) => setTimeout(resolve, 500 * (index + 1))); continue }
      if (!response.ok) fail(response.status === 429 ? 429 : 502, `Source returned ${response.status}.`)
      return await response.json()
    } finally { clearTimeout(timer) }
  }
  fail(429, 'Source is rate limited. Try again shortly.')
}

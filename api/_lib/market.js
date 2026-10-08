import { chains, fail, fetchJson } from './core.js'

const fresh = new Map()
export async function getTokenSnapshot(chain, address) {
  const adapter = chains[chain]
  if (chain === 'robinhood' && address.toLowerCase() === '0x0379e228f6887c6f18bf394042ecaf81b308cb2e') {
    const raw = await fetchJson('https://musegod.org/api/v1/market')
    const token = raw?.token || {}
    return { status: 'available', checkedAt: new Date().toISOString(), source: 'MUSEGOD Official API', sourceUrl: 'https://musegod.org/api/v1/market', primaryPair: { pairAddress: null, dex: 'official aggregate; pool unspecified', url: 'https://musegod.org/api/v1/market', base: 'MUSEGOD', quote: 'USD', priceUsd: finite(token.priceUsd), liquidityUsd: null, volume24hUsd: finite(token.volumeUsd), marketCapUsd: finite(token.marketCapUsd), createdAt: null, priceChange: { h1: null, h6: null, h24: finite(token.changePct) }, transactions24h: { buys: finite(token.buys), sells: finite(token.sells) } }, pairs: [] }
  }
  if (!adapter?.dex) return { status: 'not_supported', reason: `No verified market adapter is configured for ${chain}.`, checkedAt: new Date().toISOString(), pairs: [] }
  const key = `${chain}:${address.toLowerCase()}`
  const cached = fresh.get(key)
  if (cached && Date.now() - cached.at < 30_000) return cached.value
  let raw
  try { raw = await fetchJson(`https://api.dexscreener.com/token-pairs/v1/${adapter.dex}/${encodeURIComponent(address)}`) }
  catch (error) { if (error?.status === 429) throw error; fail(502, 'DexScreener market data is unavailable. Try again shortly.') }
  const pairs = (Array.isArray(raw) ? raw : []).filter((pair) => pair && typeof pair.pairAddress === 'string' && pair.chainId === adapter.dex && (chain === 'solana' ? pair.baseToken?.address === address : pair.baseToken?.address?.toLowerCase() === address.toLowerCase())).slice(0, 20).map((pair) => ({
    pairAddress: pair.pairAddress, dex: pair.dexId ?? 'N/A', url: /^https:\/\/dexscreener\.com\//.test(pair.url ?? '') ? pair.url : null,
    base: pair.baseToken?.symbol ?? 'N/A', quote: pair.quoteToken?.symbol ?? 'N/A',
    priceUsd: finite(pair.priceUsd), liquidityUsd: finite(pair.liquidity?.usd), volume24hUsd: finite(pair.volume?.h24),
    marketCapUsd: finite(pair.marketCap), createdAt: Number.isFinite(pair.pairCreatedAt) ? new Date(pair.pairCreatedAt).toISOString() : null,
    priceChange: { h1: finite(pair.priceChange?.h1), h6: finite(pair.priceChange?.h6), h24: finite(pair.priceChange?.h24) },
    transactions24h: { buys: finite(pair.txns?.h24?.buys), sells: finite(pair.txns?.h24?.sells) },
  }))
  pairs.sort((a, b) => (b.liquidityUsd ?? -1) - (a.liquidityUsd ?? -1))
  const value = { status: pairs.length ? 'available' : 'no_pairs', checkedAt: new Date().toISOString(), source: 'DexScreener', sourceUrl: `https://dexscreener.com/${adapter.dex}/${address}`, primaryPair: pairs[0] ?? null, pairs }
  fresh.set(key, { at: Date.now(), value })
  if (fresh.size > 200) fresh.delete(fresh.keys().next().value)
  return value
}
function finite(value) { const number = Number(value); return value == null || !Number.isFinite(number) ? null : number }

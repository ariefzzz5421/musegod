import test from 'node:test'
import assert from 'node:assert/strict'
import { parseTokenInput } from '../api/_lib/core.js'
import { getTokenSnapshot } from '../api/_lib/market.js'
import { requireMuseOwner } from '../api/_lib/auth.js'
import research from '../api/intelligence/research.js'
import workspace from '../api/intelligence/workspace.js'
import { sanitizeFlockAgent, sanitizeFlockState } from '../api/_lib/flock.js'

function response() { return { statusCode: 0, body: null, setHeader() {}, status(code) { this.statusCode = code; return this }, json(body) { this.body = body; return this } } }

test('chain-aware token validation rejects malformed contracts', () => {
  assert.equal(parseTokenInput({ chain: 'base', address: '0x1111111111111111111111111111111111111111' }).chain, 'base')
  assert.throws(() => parseTokenInput({ chain: 'base', address: '0x1234' }))
  assert.throws(() => parseTokenInput({ chain: 'unknown', address: '0x1111111111111111111111111111111111111111' }))
})

test('market adapter selects a single deepest pool and leaves missing values null', async () => {
  const original = globalThis.fetch
  globalThis.fetch = async () => new Response(JSON.stringify([
    { chainId: 'base', pairAddress: 'small', dexId: 'one', baseToken: { address: '0x1111111111111111111111111111111111111111' }, priceUsd: '1', liquidity: { usd: 100 }, volume: { h24: 20 } },
    { chainId: 'base', pairAddress: 'deep', dexId: 'two', baseToken: { address: '0x1111111111111111111111111111111111111111' }, priceUsd: '2', liquidity: { usd: 300 }, volume: { h24: 50 } },
    { chainId: 'base', pairAddress: 'wrong-side', dexId: 'three', baseToken: { address: '0x2222222222222222222222222222222222222222' }, priceUsd: '900', liquidity: { usd: 9000 } },
  ]), { status: 200 })
  try {
    const result = await getTokenSnapshot('base', '0x1111111111111111111111111111111111111111')
    assert.equal(result.primaryPair.pairAddress, 'deep')
    assert.equal(result.primaryPair.liquidityUsd, 300)
    assert.equal(result.primaryPair.marketCapUsd, null)
    assert.equal(result.primaryPair.transactions24h.buys, null)
    assert.equal(result.pairs.length, 2)
  } finally { globalThis.fetch = original }
})

test('unsupported network is explicit', async () => {
  const result = await getTokenSnapshot('hyperliquid', '0x1111111111111111111111111111111111111111')
  assert.equal(result.status, 'not_supported')
  assert.equal(result.pairs.length, 0)
})

test('MUSEGOD on Robinhood Chain uses official aggregate without inventing a pool', async () => {
  const original = globalThis.fetch
  globalThis.fetch = async () => new Response(JSON.stringify({ token: { priceUsd: 0.0002, volumeUsd: 1200, marketCapUsd: 200000 } }), { status: 200 })
  try {
    const result = await getTokenSnapshot('robinhood', '0x0379E228F6887c6F18bf394042ECAF81B308cb2e')
    assert.equal(result.source, 'MUSEGOD Official API')
    assert.equal(result.primaryPair.priceUsd, 0.0002)
    assert.equal(result.primaryPair.pairAddress, null)
    assert.equal(result.primaryPair.liquidityUsd, null)
  } finally { globalThis.fetch = original }
})

test('anonymous requests cannot access private workspace or run research', async () => {
  const first = response()
  await research({ method: 'POST', headers: {}, body: {} }, first)
  assert.equal(first.statusCode, 401)
  const second = response()
  await workspace({ method: 'GET', headers: {}, query: {} }, second)
  assert.equal(second.statusCode, 401)
})

test('ownership changes revoke NFT-gated access', async () => {
  const original = globalThis.fetch
  globalThis.fetch = async () => new Response(JSON.stringify({ id: 242, owner: { address: '0x2222222222222222222222222222222222222222' } }), { status: 200 })
  try {
    await assert.rejects(() => requireMuseOwner({ wallets: ['0x1111111111111111111111111111111111111111'] }, 242, { readOwner: async () => '0x2222222222222222222222222222222222222222' }), { status: 403 })
    const result = await requireMuseOwner({ wallets: ['0x2222222222222222222222222222222222222222'] }, 242, { readOwner: async () => '0x2222222222222222222222222222222222222222' })
    assert.equal(result.owner, '0x2222222222222222222222222222222222222222')
  } finally { globalThis.fetch = original }
})

test('Flock public responses keep association separate from signature and omit join material', () => {
  const state = sanitizeFlockState({ deployment: { joinCode: 'never-send' }, calls: [{ call: { brief: 'Daily call', timestamp: 100 }, results: [{ agent: { number: 130, name: 'Firework', namedToken: null }, text: 'Answer', picked: false, joinCode: 'secret' }] }] })
  assert.equal(state.calls[0].results[0].agent.namedToken, null)
  assert.equal(JSON.stringify(state).includes('never-send'), false)
  assert.equal(JSON.stringify(state).includes('joinCode'), false)
  const agent = sanitizeFlockAgent({ agent: { number: 130, name: 'Firework', token: { id: 242 }, namedToken: null, joinCode: 'secret' }, picks: 0 })
  assert.equal(agent.agent.token.id, 242)
  assert.equal(agent.agent.namedToken, null)
  assert.equal(JSON.stringify(agent).includes('secret'), false)
})

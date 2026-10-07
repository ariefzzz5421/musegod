import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { fetchOwnedMuses, isAddress, safeMuseUrl } from '../src/muse.ts'

const wallet = '0x00a839de7922491683f547a67795204763ff8237'
const originalFetch = globalThis.fetch
after(() => { globalThis.fetch = originalFetch })

test('rejects invalid wallet addresses before contacting API', async () => {
  assert.equal(isAddress(wallet), true)
  assert.equal(isAddress('0x123'), false)
  await assert.rejects(() => fetchOwnedMuses('0x123'), /valid EVM wallet/)
})

test('paginates ownership and filters mismatched records', async () => {
  const calls = []
  globalThis.fetch = async (url) => {
    calls.push(String(url))
    const offset = Number(new URL(url).searchParams.get('offset'))
    return { ok: true, json: async () => offset === 0
      ? { total: 3, muses: [{ id: 1, owner: wallet }, { id: 2, owner: '0x0000000000000000000000000000000000000000' }] }
      : { total: 3, muses: [{ id: 3, owner: wallet.toUpperCase() }] } }
  }
  const muses = await fetchOwnedMuses(wallet)
  assert.deepEqual(muses.map((muse) => muse.id), [1, 3])
  assert.equal(calls.length, 2)
  assert.match(calls[1], /offset=2/)
})

test('does not turn an API error into an empty collection', async () => {
  globalThis.fetch = async () => ({ ok: false, status: 503 })
  await assert.rejects(() => fetchOwnedMuses(wallet), /503/)
})

test('accepts only official HTTPS links in API content', () => {
  const fallback = 'https://musegod.org/muse/1'
  assert.equal(safeMuseUrl('https://musegod.org/muse/1', fallback), fallback)
  assert.equal(safeMuseUrl('javascript:alert(1)', fallback), fallback)
  assert.equal(safeMuseUrl('https://other.example/muse/1', fallback), fallback)
})

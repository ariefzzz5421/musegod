import { PrivyClient } from '@privy-io/node'
import { createPublicClient, http } from 'viem'
import { fail } from './core.js'

let client
const nftContract = '0x13Ea3072b7215d4C9c2Ec4f498A08c5825129836'
const ownerAbi = [{ type: 'function', name: 'ownerOf', stateMutability: 'view', inputs: [{ name: 'tokenId', type: 'uint256' }], outputs: [{ name: 'owner', type: 'address' }] }]
const chainClient = createPublicClient({ transport: http('https://rpc.mainnet.chain.robinhood.com', { timeout: 8000, retryCount: 1 }) })
function getClient() {
  const appId = process.env.PRIVY_APP_ID || process.env.VITE_PRIVY_APP_ID
  const appSecret = process.env.PRIVY_APP_SECRET
  if (!appId || !appSecret) fail(503, 'Privy server credentials are not configured.')
  client ??= new PrivyClient({ appId, appSecret })
  return client
}

export async function authenticate(req) {
  const match = /^Bearer ([A-Za-z0-9._-]+)$/.exec(req.headers.authorization || '')
  if (!match) fail(401, 'Connect your wallet to use private features.')
  try {
    const privy = getClient()
    const claims = await privy.utils().auth().verifyAccessToken(match[1])
    const user = await privy.users()._get(claims.user_id)
    const wallets = user.linked_accounts.filter((account) => account.type === 'wallet' || account.type === 'smart_wallet').map((account) => account.address.toLowerCase())
    return { userId: claims.user_id, wallets }
  } catch (error) {
    if (error?.status === 503) throw error
    fail(401, 'Your session could not be verified. Please reconnect your wallet.')
  }
}

export async function requireMuseOwner(auth, museId, { readOwner = async (id) => chainClient.readContract({ address: nftContract, abi: ownerAbi, functionName: 'ownerOf', args: [BigInt(id)] }) } = {}) {
  const response = await fetch(`https://musegod.org/api/v1/muses/${museId}`, { signal: AbortSignal.timeout(8000), cache: 'no-store' })
  if (!response.ok) fail(503, 'Current NFT ownership could not be checked.')
  const muse = await response.json()
  let owner
  try { owner = await readOwner(museId) } catch { fail(503, 'Robinhood Chain ownership check is unavailable. Private access is paused.') }
  if (!owner || !auth.wallets.includes(owner.toLowerCase())) fail(403, 'This Privy account does not currently own the selected Muse.')
  return { muse, owner: owner.toLowerCase() }
}

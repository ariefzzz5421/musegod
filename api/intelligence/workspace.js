import { z } from 'zod'
import { authenticate, requireMuseOwner } from '../_lib/auth.js'
import { database } from '../_lib/db.js'
import { fail, handleError, parseTokenInput, requireMethod, send } from '../_lib/core.js'

const itemSchema = z.object({ chain: z.string(), address: z.string(), pairAddress: z.string().max(100).optional().default(''), tags: z.array(z.string().trim().max(24)).max(6).default([]), note: z.string().max(2000).default(''), thresholds: z.object({ priceAbove: z.number().positive().nullable(), priceBelow: z.number().positive().nullable(), liquidityBelow: z.number().positive().nullable(), volumeAbove: z.number().positive().nullable() }).default({ priceAbove: null, priceBelow: null, liquidityBelow: null, volumeAbove: null }) })
const bodySchema = z.object({ museId: z.number().int().min(1).max(999), wallet: z.string().regex(/^0x[a-fA-F0-9]{40}$/), item: itemSchema.optional(), removeId: z.string().max(120).optional(), mission: z.string().max(1000).optional(), schedule: z.enum(['manual', 'daily', 'weekly']).optional() })

export default async function handler(req, res) {
  try {
    if (!['GET', 'POST'].includes(req.method)) fail(405, 'GET or POST required.')
    if (req.method === 'POST') requireMethod(req, 'POST')
    const auth = await authenticate(req)
    const input = req.method === 'GET' ? { museId: Number(req.query.museId || 242), wallet: req.query.wallet } : bodySchema.parse(req.body)
    if (!Number.isInteger(input.museId) || input.museId < 1 || input.museId > 999 || !/^0x[a-fA-F0-9]{40}$/.test(input.wallet || '')) fail(400, 'Valid Muse ID and wallet required.')
    if (!auth.wallets.includes(input.wallet.toLowerCase())) fail(403, 'Wallet is not linked to this session.')
    const { owner } = await requireMuseOwner(auth, input.museId)
    if (input.wallet.toLowerCase() !== owner) fail(403, 'Select the wallet that currently owns this Muse.')
    const db = database()
    const key = `${auth.userId}_${input.museId}`
    const collection = db.collection('agentConfigurations')
    const ref = collection.doc(key)
    if (req.method === 'GET') {
      const [config, list, reports] = await Promise.all([ref.get(), db.collection('watchlistItems').where('ownerId', '==', auth.userId).where('museId', '==', input.museId).limit(100).get(), db.collection('researchReports').where('ownerId', '==', auth.userId).where('museId', '==', input.museId).orderBy('createdAt', 'desc').limit(30).get()])
      return send(res, 200, { config: config.exists ? config.data() : { mission: '', schedule: 'manual' }, watchlist: list.docs.map((doc) => ({ id: doc.id, ...doc.data() })), reports: reports.docs.map((doc) => ({ id: doc.id, ...doc.data() })) })
    }
    if (input.item) {
      const parsed = parseTokenInput({ chain: input.item.chain, address: input.item.address })
      const id = `${key}_${parsed.chain}_${parsed.address.toLowerCase()}`
      await db.collection('watchlistItems').doc(id).set({ ...input.item, chain: parsed.chain, address: parsed.address, ownerId: auth.userId, wallet: input.wallet.toLowerCase(), museId: input.museId, updatedAt: new Date().toISOString() })
    }
    if (input.removeId) {
      if (!input.removeId.startsWith(`${key}_`)) fail(403, 'This item does not belong to your workspace.')
      await db.collection('watchlistItems').doc(input.removeId).delete()
    }
    if (input.mission !== undefined || input.schedule !== undefined) await ref.set({ ownerId: auth.userId, wallet: input.wallet.toLowerCase(), museId: input.museId, ...(input.mission !== undefined ? { mission: input.mission } : {}), ...(input.schedule !== undefined ? { schedule: input.schedule } : {}), updatedAt: new Date().toISOString() }, { merge: true })
    return send(res, 200, { saved: true })
  } catch (error) { return handleError(res, error) }
}

import { handleError, parseTokenInput, requireMethod, send } from '../_lib/core.js'
import { getTokenSnapshot } from '../_lib/market.js'

export default async function handler(req, res) {
  try {
    requireMethod(req, 'GET')
    const input = parseTokenInput({ chain: req.query.chain, address: req.query.address })
    return send(res, 200, await getTokenSnapshot(input.chain, input.address))
  } catch (error) { return handleError(res, error) }
}

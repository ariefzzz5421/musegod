import { getFlock, sanitizeFlockAgent } from '../_lib/flock.js'
import { fail, handleError } from '../_lib/core.js'

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') fail(405, 'GET required.')
    const number = Number(req.query.number)
    if (!Number.isInteger(number) || number < 1 || number > 9999) fail(400, 'Valid founding number required.')
    const value = sanitizeFlockAgent(await getFlock(`founding/${number}`))
    res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60')
    return res.status(200).json(value)
  } catch (error) { return handleError(res, error) }
}

import { getFlock, sanitizeFlockState } from '../_lib/flock.js'
import { fail, handleError } from '../_lib/core.js'

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') fail(405, 'GET required.')
    const value = sanitizeFlockState(await getFlock('state'))
    res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60')
    return res.status(200).json(value)
  } catch (error) { return handleError(res, error) }
}

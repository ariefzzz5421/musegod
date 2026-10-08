export type Screen = 'overview' | 'collection' | 'guide' | 'utilize' | 'musegod' | 'intelligence' | 'identity' | 'developer' | 'agent'

const paths: Record<Screen, string> = {
  overview: '/',
  collection: '/my-muses',
  guide: '/how-it-works',
  utilize: '/utilize',
  musegod: '/musegod',
  intelligence: '/intelligence',
  identity: '/agent-identity',
  developer: '/developer',
  agent: '/agent/242',
}

export function pathFor(screen: Screen): string { return paths[screen] }

export function screenFromPath(path: string): Screen {
  const normalized = path.replace(/\/+$/, '') || '/'
  if (/^\/agent\/[1-9]\d{0,2}$/.test(normalized)) return 'agent'
  return (Object.keys(paths) as Screen[]).find((screen) => paths[screen] === normalized) ?? 'overview'
}

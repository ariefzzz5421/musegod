export type Screen = 'overview' | 'collection' | 'guide' | 'utilize' | 'musegod'

const paths: Record<Screen, string> = {
  overview: '/',
  collection: '/my-muses',
  guide: '/how-it-works',
  utilize: '/utilize',
  musegod: '/musegod',
}

export function pathFor(screen: Screen): string { return paths[screen] }

export function screenFromPath(path: string): Screen {
  const normalized = path.replace(/\/+$/, '') || '/'
  return (Object.keys(paths) as Screen[]).find((screen) => paths[screen] === normalized) ?? 'overview'
}

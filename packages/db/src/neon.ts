export function isNeonUrl(value: string | undefined) {
  return URL.parse(value ?? '')?.hostname.endsWith('.neon.tech') ?? false
}

export function neonConnectionString(value: string | undefined, endpoint: 'pooled' | 'direct', role?: string) {
  const url = URL.parse(value ?? '')
  if (!value || !url || !['postgres:', 'postgresql:'].includes(url.protocol) ||
      !/^ep-[a-z0-9-]+(?:\.[a-z0-9-]+)+\.neon\.tech$/.test(url.hostname) ||
      url.hostname.split('.')[0].endsWith('-pooler') !== (endpoint === 'pooled') ||
      (url.port && url.port !== '5432') || !url.username || !url.password || (role && url.username !== role) ||
      !/^\/[^/]+$/.test(url.pathname) || url.hash ||
      url.searchParams.getAll('sslmode').join(',') !== 'verify-full' ||
      [...url.searchParams.keys()].some((key) => key !== 'sslmode' && key !== 'channel_binding') ||
      url.searchParams.getAll('channel_binding').some((mode) => mode !== 'require')) {
    throw new Error('Expected a Neon ' + endpoint + ' PostgreSQL URL with sslmode=verify-full.')
  }
  return value
}

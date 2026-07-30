/**
 * Returns the client-side route preserved by `public/404.html` on GitHub
 * Pages. Only a same-origin absolute path is accepted, so the 404 hand-off
 * cannot turn into an external redirect.
 */
export function restoredPagesRoute(search: string, baseUrl: string) {
  const route = new URLSearchParams(search).get('p')
  if (!route || !/^\/(?!\/)/.test(route)) return null

  const basePath = baseUrl.replace(/\/$/, '')
  return `${basePath}${route}`
}

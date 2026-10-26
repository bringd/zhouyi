/** Keep community requests and their HttpOnly session on the Pages origin. */
interface CommunityContext {
  request: Request
  env: { COMMUNITY_API_ORIGIN?: string }
  next: () => Promise<Response>
}

const DEFAULT_ORIGIN = 'https://zhouyi-worker.bringd.workers.dev'
const COMMUNITY_PATH = /^\/api\/(?:records|feed|favorites|auth)(?:\/|$)/
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

export const onRequest = async (
  context: CommunityContext,
): Promise<Response> => {
  const { request } = context
  const incoming = new URL(request.url)
  if (!COMMUNITY_PATH.test(incoming.pathname)) return context.next()

  const origin = request.headers.get('origin')
  if (
    !SAFE_METHODS.has(request.method) &&
    ((origin && origin !== incoming.origin) ||
      request.headers.get('sec-fetch-site') === 'cross-site')
  ) {
    return Response.json(
      { error: 'invalid-origin', message: '请求来源无效' },
      { status: 403 },
    )
  }

  const headers = new Headers()
  for (const name of ['accept', 'content-type']) {
    const value = request.headers.get(name)
    if (value) headers.set(name, value)
  }
  headers.set('origin', incoming.origin)
  const session = request.headers
    .get('cookie')
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith('zhouyi_session='))
  if (session) headers.set('cookie', session)

  try {
    const target = new URL(context.env.COMMUNITY_API_ORIGIN || DEFAULT_ORIGIN)
    target.pathname = incoming.pathname
    target.search = incoming.search
    const upstream = await fetch(target, {
      method: request.method,
      headers,
      body: SAFE_METHODS.has(request.method) ? undefined : request.body,
      redirect: 'manual',
      signal: request.signal,
    })
    const responseHeaders = new Headers(upstream.headers)
    for (const name of [...responseHeaders.keys()]) {
      if (
        name.startsWith('access-control-') ||
        [
          'connection',
          'transfer-encoding',
          'content-length',
          'set-cookie',
        ].includes(name)
      ) {
        responseHeaders.delete(name)
      }
    }
    // Only retain the application's session, scoped to the Pages host.
    const cookie = upstream.headers
      .get('set-cookie')
      ?.split(/,(?=\s*[^;,=\s]+=)/)
      .find((part) => part.trim().startsWith('zhouyi_session='))
    if (cookie) {
      let scoped = cookie.trim().replace(/;\s*domain=[^;]*/gi, '')
      if (incoming.protocol === 'https:' && !/;\s*secure(?:;|$)/i.test(scoped))
        scoped += '; Secure'
      responseHeaders.set('set-cookie', scoped)
    }
    responseHeaders.set('cache-control', 'no-store')
    return new Response(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    })
  } catch (error) {
    console.warn('[community-proxy] upstream unavailable', error)
    return Response.json(
      { error: 'upstream-unavailable', message: '云端暂不可用，请稍后重试' },
      { status: 502 },
    )
  }
}

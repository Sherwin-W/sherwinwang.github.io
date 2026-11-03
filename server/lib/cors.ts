const DEFAULT_ORIGINS = ['https://sherwinwang.dev', 'https://www.sherwinwang.dev'];

export function corsHeaders(request: Request, allowed?: string): Record<string, string> {
  const list = allowed ? allowed.split(',').map((s) => s.trim()).filter(Boolean) : DEFAULT_ORIGINS;
  const origin = request.headers.get('origin');
  const headers: Record<string, string> = { vary: 'origin' };
  if (origin && list.includes(origin)) {
    headers['access-control-allow-origin'] = origin;
    headers['access-control-allow-methods'] = 'GET, OPTIONS';
    headers['access-control-max-age'] = '86400';
    headers['access-control-expose-headers'] = 'retry-after';
  }
  return headers;
}

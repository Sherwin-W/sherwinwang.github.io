// One-time, owner-only Spotify authorization. Run it on your own machine:
//   SPOTIFY_CLIENT_ID=... SPOTIFY_CLIENT_SECRET=... node server/scripts/spotify-auth.mjs
// It opens a loopback callback on 127.0.0.1 (never deployed), uses PKCE + a random state,
// and prints the refresh token once so you can paste it into Vercel's env settings.
import http from 'node:http';
import crypto from 'node:crypto';

const { SPOTIFY_CLIENT_ID: clientId, SPOTIFY_CLIENT_SECRET: clientSecret } = process.env;
const PORT = Number(process.env.PORT ?? 8888);
const REDIRECT = `http://127.0.0.1:${PORT}/callback`;
const SCOPES = 'user-read-currently-playing user-read-recently-played';

if (!clientId || !clientSecret) {
  console.error('Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET first.');
  process.exit(1);
}

const b64url = (buf) => buf.toString('base64url');
const verifier = b64url(crypto.randomBytes(48));
const challenge = b64url(crypto.createHash('sha256').update(verifier).digest());
const state = b64url(crypto.randomBytes(16));

const authorize = new URL('https://accounts.spotify.com/authorize');
authorize.search = new URLSearchParams({
  response_type: 'code',
  client_id: clientId,
  scope: SCOPES,
  redirect_uri: REDIRECT,
  state,
  code_challenge_method: 'S256',
  code_challenge: challenge,
}).toString();

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, REDIRECT);
  if (url.pathname !== '/callback') { res.writeHead(404).end(); return; }
  const finish = (status, message) => { res.writeHead(status, { 'content-type': 'text/plain' }).end(message); setTimeout(() => server.close(), 100); };
  if (url.searchParams.get('state') !== state) return finish(400, 'State mismatch. Start again.');
  const code = url.searchParams.get('code');
  if (!code) return finish(400, `Spotify returned: ${url.searchParams.get('error') ?? 'no code'}`);
  const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`, 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: REDIRECT, code_verifier: verifier }),
  });
  const body = await tokenRes.json();
  if (!tokenRes.ok || !body.refresh_token) return finish(502, 'Token exchange failed. See the terminal.') ?? console.error(body);
  console.log('\nSPOTIFY_REFRESH_TOKEN=' + body.refresh_token + '\n');
  console.log('Add it to Vercel (Production env). Do not commit it.');
  finish(200, 'Authorized. You can close this tab and return to the terminal.');
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Redirect URI to register in the Spotify dashboard: ${REDIRECT}\n`);
  console.log('Open this URL in your browser and approve:\n\n' + authorize + '\n');
});

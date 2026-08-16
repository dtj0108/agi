/**
 * Local loopback OAuth flow
 */

import { createServer } from 'http';
import { createHash, randomBytes } from 'crypto';

function toBase64Url(buffer: any) {
  return Buffer.from(buffer)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function generatePkce() {
  const codeVerifier = toBase64Url(randomBytes(48));
  const codeChallenge = toBase64Url(createHash('sha256').update(codeVerifier).digest());
  return { codeVerifier, codeChallenge };
}

function generateState() {
  return toBase64Url(randomBytes(24));
}

function createResponsePage(title: any, message: any) {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${title}</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; padding: 2rem; line-height: 1.5; }
      .card { max-width: 620px; margin: 3rem auto; border: 1px solid #ddd; border-radius: 12px; padding: 1.5rem; }
      h1 { margin-top: 0; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>${title}</h1>
      <p>${message}</p>
      <p>You can close this tab and return to Entity.</p>
    </div>
  </body>
</html>`;
}

async function listenOnPort(server: any, host: any, port: any) {
  await new Promise((resolve: any, reject: any) => {
    const onError = (err: any) => reject(err);
    server.once('error', onError);
    server.listen(port, host, () => {
      server.off('error', onError);
      resolve();
    });
  });
}

async function bindWithinRange(host: any, basePort: any, portRange: any, requestHandler: any) {
  const lastPort = basePort + Math.max(0, Number(portRange) || 0);

  for (let port = basePort; port <= lastPort; port += 1) {
    const server = createServer(requestHandler);
    try {
      await listenOnPort(server, host, port);
      return { server, port };
    } catch (err: any) {
      server.close();
      if (err?.code !== 'EADDRINUSE' && err?.code !== 'EACCES') {
        throw err;
      }
    }
  }

  throw new Error(`Unable to bind local OAuth callback server on ${host}:${basePort}-${lastPort}`);
}

export async function runLoopbackLogin({
  provider,
  issuer,
  clientId,
  scopes,
  callbackHost,
  callbackPort,
  callbackPortRange,
  openBrowser,
  extraAuthorizeParams,
  timeoutMs = 10 * 60 * 1000,
}: any) {
  const metadata = await provider.discoverMetadata(issuer);
  const pkce = generatePkce();
  const state = generateState();

  let resolver: any;
  let rejecter: any;
  const done = new Promise<{ code: string }>((resolve: any, reject: any) => {
    resolver = resolve;
    rejecter = reject;
  });

  const requestHandler = (req: any, res: any) => {
    try {
      const parsed = new URL(req.url, 'http://localhost');
      if (parsed.pathname !== '/auth/callback') {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not Found');
        return;
      }

      const queryState = parsed.searchParams.get('state');
      if (queryState !== state) {
        res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(createResponsePage('Sign-in failed', 'State mismatch. Please restart login.'));
        rejecter(new Error('OAuth callback state mismatch'));
        return;
      }

      const errorCode = parsed.searchParams.get('error');
      if (errorCode) {
        const description = parsed.searchParams.get('error_description') || errorCode;
        res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(createResponsePage('Sign-in denied', description));
        rejecter(new Error(`OAuth callback error: ${description}`));
        return;
      }

      const code = parsed.searchParams.get('code');
      if (!code) {
        res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(createResponsePage('Sign-in failed', 'Missing authorization code.'));
        rejecter(new Error('OAuth callback missing authorization code'));
        return;
      }

      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(createResponsePage('Sign-in complete', 'Authentication succeeded.'));
      resolver({ code });
    } catch (err: any) {
      rejecter(err);
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Internal error');
    }
  };

  const { server, port } = await bindWithinRange(
    callbackHost,
    callbackPort,
    callbackPortRange,
    requestHandler
  );

  const redirectUri = `http://${callbackHost}:${port}/auth/callback`;
  const authUrl = provider.buildAuthorizationUrl({
    metadata,
    issuer,
    clientId,
    redirectUri,
    scope: scopes.join(' '),
    state,
    codeChallenge: pkce.codeChallenge,
    extraParams: extraAuthorizeParams,
  });

  if (typeof openBrowser === 'function') {
    await openBrowser(authUrl);
  }

  const timer = setTimeout(() => {
    rejecter(new Error('OAuth login timed out waiting for callback'));
  }, timeoutMs);

  try {
    const { code } = await done;
    const tokens = await provider.exchangeAuthorizationCode({
      metadata,
      issuer,
      clientId,
      code,
      redirectUri,
      codeVerifier: pkce.codeVerifier,
    });

    return {
      authUrl,
      callbackPort: port,
      redirectUri,
      tokens,
    };
  } finally {
    clearTimeout(timer);
    await new Promise((resolve: any) => server.close(() => resolve()));
  }
}

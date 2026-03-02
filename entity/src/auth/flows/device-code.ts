/**
 * OAuth device-code flow wrapper
 */

export async function runDeviceCodeLogin({ provider, issuer, clientId, scopes, onPrompt = null }: any) {
  const metadata = await provider.discoverMetadata(issuer);

  const deviceAuth = await provider.startDeviceAuthorization({
    metadata,
    issuer,
    clientId,
    scope: scopes.join(' '),
  });

  if (typeof onPrompt === 'function') {
    await onPrompt(deviceAuth);
  }

  const tokens = await provider.pollDeviceToken({
    metadata,
    issuer,
    clientId,
    deviceCode: deviceAuth.device_code,
    interval: deviceAuth.interval,
    expiresIn: deviceAuth.expires_in,
  });

  return {
    deviceAuth,
    tokens,
  };
}

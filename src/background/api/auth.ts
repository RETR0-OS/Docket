import { setStorage, getStorage } from '../../shared/storage.ts';

interface TokenCache {
  token: string;
  expiry: number;
}

function getClientId(): string {
  const manifest = chrome.runtime.getManifest() as { oauth2?: { client_id?: string } };
  return manifest.oauth2?.client_id ?? '';
}

function getScopes(): string {
  const manifest = chrome.runtime.getManifest() as { oauth2?: { scopes?: string[] } };
  return (manifest.oauth2?.scopes ?? []).join(' ');
}

async function readCachedToken(): Promise<string | null> {
  const result = await chrome.storage.session.get('authToken');
  const cache = result['authToken'] as TokenCache | undefined;
  if (cache && Date.now() < cache.expiry) return cache.token;
  return null;
}

async function writeCachedToken(token: string, expiresIn: number): Promise<void> {
  const cache: TokenCache = {
    token,
    expiry: Date.now() + expiresIn * 1000 - 60_000,
  };
  await chrome.storage.session.set({ authToken: cache });
}

async function launchFlow(interactive: boolean): Promise<string> {
  const redirectUrl = chrome.identity.getRedirectURL();
  const authUrl = new URL('https://accounts.google.com/o/oauth2/auth');
  authUrl.searchParams.set('client_id', getClientId());
  authUrl.searchParams.set('redirect_uri', redirectUrl);
  authUrl.searchParams.set('response_type', 'token');
  authUrl.searchParams.set('scope', getScopes());
  if (!interactive) authUrl.searchParams.set('prompt', 'none');

  return new Promise((resolve, reject) => {
    chrome.identity.launchWebAuthFlow(
      { url: authUrl.toString(), interactive },
      (redirectResponse) => {
        if (chrome.runtime.lastError || !redirectResponse) {
          reject(new Error(chrome.runtime.lastError?.message ?? 'Not authenticated'));
          return;
        }
        const hash = new URL(redirectResponse).hash.slice(1);
        const params = new URLSearchParams(hash);
        const token = params.get('access_token');
        const expiresIn = parseInt(params.get('expires_in') ?? '3600', 10);
        if (!token) {
          reject(new Error('Not authenticated'));
          return;
        }
        writeCachedToken(token, expiresIn);
        resolve(token);
      },
    );
  });
}

export async function getToken(interactive: boolean): Promise<string> {
  // 1. Check session-persisted cache (survives service worker restarts)
  const cached = await readCachedToken();
  if (cached) return cached;

  // 2. Try silent refresh — works if user has an active Google session
  try {
    return await launchFlow(false);
  } catch {
    // silent refresh failed
  }

  // 3. Interactive flow if allowed
  if (interactive) return launchFlow(true);

  throw new Error('Not authenticated');
}

export async function getUserInfo(token: string): Promise<{ email: string }> {
  const resp = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok) throw new Error('Failed to fetch user info');
  return resp.json() as Promise<{ email: string }>;
}

export async function signIn(): Promise<string> {
  const token = await launchFlow(true);
  const info = await getUserInfo(token);
  await setStorage({ email: info.email });
  return info.email;
}

export async function signOut(): Promise<void> {
  await chrome.storage.session.remove('authToken');
  const storage = await getStorage();
  await setStorage({ email: undefined, workingHours: storage.workingHours });
}

export async function getAuthStatus(): Promise<{ signedIn: boolean; email?: string }> {
  const { email } = await getStorage();
  if (!email) return { signedIn: false };
  return { signedIn: true, email };
}

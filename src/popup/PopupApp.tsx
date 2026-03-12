import { useEffect, useState } from 'react';
import Header from './components/Header.tsx';
import AuthScreen from './AuthScreen.tsx';
import SettingsScreen from './SettingsScreen.tsx';
import type { AuthStatusResponse } from '../shared/message-types.ts';

type View = 'loading' | 'auth' | 'settings';

function sendMessage<T>(msg: object): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(msg, (response: T) => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
      else resolve(response);
    });
  });
}

export default function PopupApp() {
  const [view, setView] = useState<View>('loading');
  const [email, setEmail] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    sendMessage<AuthStatusResponse>({ type: 'AUTH_GET_STATUS' })
      .then((res) => {
        if (res.ok && res.data.signedIn) {
          setEmail(res.data.email ?? '');
          setView('settings');
        } else {
          setView('auth');
        }
      })
      .catch(() => setView('auth'));
  }, []);

  const handleSignIn = async () => {
    setAuthLoading(true);
    setAuthError('');
    try {
      const res = await sendMessage<AuthStatusResponse>({ type: 'AUTH_SIGN_IN' });
      if (res.ok && res.data.signedIn) {
        setEmail(res.data.email ?? '');
        setView('settings');
      } else {
        setAuthError(!res.ok ? res.error : 'Sign-in failed');
      }
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : 'Sign-in failed');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    await sendMessage({ type: 'AUTH_SIGN_OUT' });
    setEmail('');
    setView('auth');
  };

  if (view === 'loading') {
    return <div className="flex items-center justify-center h-32 text-gray-400 text-sm">Loading…</div>;
  }

  if (view === 'auth') {
    return <AuthScreen onSignIn={handleSignIn} loading={authLoading} error={authError} />;
  }

  return (
    <div className="flex flex-col min-w-[340px]">
      <Header email={email} onSignOut={handleSignOut} />
      <SettingsScreen />
    </div>
  );
}

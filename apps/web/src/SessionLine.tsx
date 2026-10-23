import { useEffect, useState } from 'react';
import type { copy } from './copy';

export default function SessionLine({ text }: { text: typeof copy.en | typeof copy.es }) {
  const [session, setSession] = useState<'connecting' | 'connected' | 'offline' | 'unconfigured'>('connecting');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    let request = 0;
    const connect = async () => {
      const current = ++request;
      setSession('connecting');
      try {
        const firebase = await import('./firebase');
        if (!active || current !== request) return;
        if (!firebase.sessionConfigured) { setSession('unconfigured'); return; }
        await firebase.startAnonymousSession();
        if (active && current === request) setSession('connected');
      } catch {
        if (active && current === request) setSession('offline');
      }
    };
    void connect();
    window.addEventListener('online', connect);
    return () => { active = false; window.removeEventListener('online', connect); };
  }, [attempt]);
  return (
    <footer className="session-line" aria-live="polite">
      <span className={`session-mark ${session}`} aria-hidden="true" />
      <span>{text[session]}</span>
      {session === 'offline' && <button onClick={() => setAttempt((value) => value + 1)}>{text.retry}</button>}
    </footer>
  );
}

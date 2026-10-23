import { useEffect, useState } from 'react';
import { firestore } from './firebase';
import { closedConfig, listenConfig } from './live-config';
export function useLiveConfig(disabled = false) {
  const [config, setConfig] = useState(closedConfig);
  const [status, setStatus] = useState<'loading' | 'live' | 'failed'>('loading');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!firestore || disabled) return;
    const timeout = window.setTimeout(() => { setConfig(closedConfig); setStatus('failed'); }, 8000);
    const stop = listenConfig(firestore, (value) => {
      window.clearTimeout(timeout); setConfig(value); setStatus('live');
    }, () => { window.clearTimeout(timeout); setConfig(closedConfig); setStatus('failed'); });
    const offline = () => { setConfig(closedConfig); setStatus('failed'); };
    window.addEventListener('offline', offline);
    return () => { window.clearTimeout(timeout); stop(); window.removeEventListener('offline', offline); };
  }, [disabled, attempt]);
  return { config, status: !firestore ? 'failed' as const : status,
    retry: () => { setStatus('loading'); setAttempt((n) => n + 1); } };
}

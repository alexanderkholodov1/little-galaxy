import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import qrcode from 'qrcode-generator';
import type { Language, RenderObject } from '@little-galaxy/shared';
import { firestore } from './firebase';
import { listenActive } from './galaxy-data';
import { coreCopy } from './core-copy';
import ErrorBoundary from './ErrorBoundary';
const Scene = lazy(() => import('./GalaxyScene'));
export default function Screen({ language }: { language: Language }) {
  const text = coreCopy[language];
  const [objects, setObjects] = useState<RenderObject[]>([]);
  const [known, setKnown] = useState(false);
  const [state, setState] = useState<'loading' | 'live' | 'failed'>('loading');
  const [attempt, setAttempt] = useState(0);
  const join = new URL('/galaxy/create', window.location.origin).href;
  const qrSvg = useMemo(() => {
    const qr = qrcode(0, 'M'); qr.addData(join); qr.make();
    return qr.createSvgTag({ cellSize: 3, margin: 12, scalable: true });
  }, [join]);
  useEffect(() => {
    if (!firestore) return;
    const timeout = window.setTimeout(() => setState('failed'), 8000);
    const offline = () => setState('failed');
    window.addEventListener('offline', offline);
    const stop = listenActive(firestore, (value, fromCache) => {
      // An empty local cache is not evidence that the server's galaxy is empty.
      if (fromCache && value.length === 0) return;
      setObjects(value); setKnown(true); setState(fromCache ? 'failed' : 'live');
      if (!fromCache) window.clearTimeout(timeout);
    }, () => setState('failed'));
    return () => { stop(); window.clearTimeout(timeout); window.removeEventListener('offline', offline); };
  }, [attempt]);
  const status = !firestore ? 'failed' : state;
  return <section className="live-screen"><div className="screen-heading"><p className="eyebrow">Collective Galaxy / 2026</p><h1>{text.screen}</h1></div>
    <div className="galaxy-field"><ErrorBoundary fallback={<p className="scene-message">{text.unavailable}<button onClick={() => window.location.reload()}>{text.retry}</button></p>}>
      <Suspense fallback={<p className="scene-message">{text.loading}</p>}><Scene objects={objects} label={text.scene} unavailable={text.unavailable}/></Suspense>
    </ErrorBoundary>
      <div className="screen-reading" aria-live="polite"><span className="creator-count">{known ? objects.length : '—'}</span> {text.creators}</div>
      <a className="join-qr" href={join}><span className="qr-image" dangerouslySetInnerHTML={{ __html: qrSvg }}/><span>{text.join}</span></a>
      {(status !== 'live' || objects.length === 0) && <div className="field-status" role="status"><p>{status === 'loading' ? text.loading : status === 'failed' ? text.failed : text.empty}</p>{status === 'failed' && <button onClick={() => { setState('loading'); setAttempt((v) => v + 1); }}>{text.retry}</button>}</div>}
    </div>
  </section>;
}

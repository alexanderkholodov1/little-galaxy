import { lazy, Suspense, useEffect, useState } from 'react';
import qrcode from 'qrcode-generator';
import { syntheticObjects } from '@little-galaxy/shared';
import type { Language, RenderObject } from '@little-galaxy/shared';
import { firestore } from './firebase';
import { listenActive } from './galaxy-data';
import { coreCopy } from './core-copy';
import ErrorBoundary from './ErrorBoundary';
const Scene = lazy(() => import('./GalaxyScene'));
export default function Screen({ language }: { language: Language }) {
  const text = coreCopy[language];
  const [synthetic] = useState(() =>
    import.meta.env.DEV ? Number(new URLSearchParams(location.search).get('synthetic')) || 0 : 0,
  );
  const [objects, setObjects] = useState<RenderObject[]>(() => syntheticObjects(synthetic));
  const [fps, setFps] = useState(0);
  const [known, setKnown] = useState(synthetic > 0);
  const [state, setState] = useState<'loading' | 'live' | 'failed'>('loading');
  const [attempt, setAttempt] = useState(0);
  const join = new URL('/galaxy/create', window.location.origin).href;
  const qr = qrcode(0, 'M');
  qr.addData(join);
  qr.make();
  useEffect(() => {
    if (!firestore || synthetic) return;
    const timeout = window.setTimeout(() => setState('failed'), 8000);
    const offline = () => setState('failed');
    window.addEventListener('offline', offline);
    const stop = listenActive(
      firestore,
      (value, fromCache) => {
        // An empty local cache is not evidence that the server's galaxy is empty.
        if (fromCache && value.length === 0) return;
        setObjects(value);
        setKnown(true);
        setState(fromCache ? 'failed' : 'live');
        if (!fromCache) window.clearTimeout(timeout);
      },
      () => setState('failed'),
    );
    return () => {
      stop();
      window.clearTimeout(timeout);
      window.removeEventListener('offline', offline);
    };
  }, [attempt, synthetic]);
  const status = synthetic ? 'live' : !firestore ? 'failed' : state;
  return (
    <section className="live-screen">
      <div className="screen-heading">
        <p className="eyebrow">Collective Galaxy / 2026</p>
        <h1>{text.screen}</h1>
      </div>
      <div className="galaxy-field">
        <ErrorBoundary
          fallback={
            <p className="scene-message">
              {text.unavailable}
              <button onClick={() => window.location.reload()}>{text.retry}</button>
            </p>
          }
        >
          <Suspense fallback={<p className="scene-message">{text.loading}</p>}>
            <Scene objects={objects} label={text.scene} unavailable={text.unavailable} onFps={setFps} />
          </Suspense>
        </ErrorBoundary>
        <output className="fps-reading" data-fps={fps.toFixed(1)}>
          {fps.toFixed(1)} fps{synthetic > 0 ? ` · ${objects.length} synthetic` : ''}
        </output>
        <div className="screen-reading" aria-live="polite">
          <span className="creator-count">
            {known ? objects.filter((object) => !object.unclaimed).length : '—'}
          </span>{' '}
          {text.creators}
        </div>
        <a className="join-qr" href={join}>
          <span
            className="qr-image"
            dangerouslySetInnerHTML={{ __html: qr.createSvgTag({ cellSize: 3, margin: 12, scalable: true }) }}
          />
          <span>{text.join}</span>
        </a>
        {(status !== 'live' || objects.length === 0) && (
          <div className="field-status" role="status">
            <p>{status === 'loading' ? text.loading : status === 'failed' ? text.failed : text.empty}</p>
            {status === 'failed' && (
              <button
                onClick={() => {
                  setState('loading');
                  setAttempt((v) => v + 1);
                }}
              >
                {text.retry}
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

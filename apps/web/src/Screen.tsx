import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import qrcode from 'qrcode-generator';
import { objectName, syntheticObjects } from '@little-galaxy/shared';
import type { Language, RenderObject } from '@little-galaxy/shared';
import { firestore } from './firebase';
import { listenActive } from './galaxy-data';
import { coreCopy } from './core-copy';
import ErrorBoundary from './ErrorBoundary';
import { useSound } from './use-sound';
import SoundControls from './SoundControls';
const Scene = lazy(() => import('./GalaxyScene'));
export default function Screen({ language }: { language: Language }) {
  const text = coreCopy[language];
  const [synthetic] = useState(() =>
    import.meta.env.DEV ? Number(new URLSearchParams(location.search).get('synthetic')) || 0 : 0,
  );
  const [objects, setObjects] = useState<RenderObject[]>(() => syntheticObjects(synthetic));
  const sound = useSound(8);
  const [focused, setFocused] = useState<string>();
  const [pet, setPet] = useState<{ id: string; at: number }>();
  const focusObject = objects.find((o) => o.id === focused);
  function pick(id: string) {
    if (id !== focused) { setFocused(id); return; }
    setPet({ id, at: Date.now() }); sound.pet(id);
  }
  const debug = import.meta.env.DEV || new URLSearchParams(location.search).get('debug') === '1';
  const [fps, setFps] = useState(0);
  const [known, setKnown] = useState(synthetic > 0);
  const [state, setState] = useState<'loading' | 'live' | 'failed'>('loading');
  const [attempt, setAttempt] = useState(0);
  const join = new URL('/galaxy/create', window.location.origin).href;
  const qrSvg = useMemo(() => {
    const qr = qrcode(0, 'M'); qr.addData(join); qr.make();
    return qr.createSvgTag({ cellSize: 3, margin: 12, scalable: true });
  }, [join]);
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
      <div className="screen-sound">
        <SoundControls sound={sound} language={language} screen/>
        <label>{language === 'es' ? 'Enfocar objeto' : 'Focus object'}
          <select aria-label={language === 'es' ? 'Enfocar objeto' : 'Focus object'} value={focusObject?.id ?? ''}
            onChange={(e) => setFocused(e.target.value || undefined)}>
            <option value="">{language === 'es' ? 'Vista de galaxia' : 'Galaxy view'}</option>
            {objects.map((o) => <option key={o.id} value={o.id}>{objectName(o.nameKey, language)} · {o.id.slice(-6)}</option>)}
          </select>
        </label>
        {focusObject && <button onClick={() => pick(focusObject.id)}>{language === 'es' ? 'Acariciar objeto enfocado' : 'Pet focused object'}</button>}
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
            <Scene objects={objects} label={text.scene} unavailable={text.unavailable} onFps={debug ? setFps : undefined} focused={focusObject?.id} pet={pet} onPick={pick} onSoundCandidates={sound.update} />
          </Suspense>
        </ErrorBoundary>
        {debug && <output className="fps-reading" data-fps={fps.toFixed(1)}>
          {fps.toFixed(1)} fps{synthetic > 0 ? ` · ${objects.length} synthetic` : ''}
        </output>}
        <div className="screen-reading" aria-live="polite">
          <span className="creator-count">
            {known ? objects.filter((object) => !object.unclaimed && !object.moonHost).length : '—'}
          </span>{' '}
          {text.creators}
        </div>
        <a className="join-qr" href={join}>
          <span
            className="qr-image"
            dangerouslySetInnerHTML={{ __html: qrSvg }}
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

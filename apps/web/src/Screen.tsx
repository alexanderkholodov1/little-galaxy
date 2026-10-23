import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import qrcode from 'qrcode-generator';
import { objectName, syntheticObjects } from '@little-galaxy/shared';
import type { Language, RenderObject, ScreenScene } from '@little-galaxy/shared';
import { firestore } from './firebase';
import { listenActive } from './galaxy-data';
import { coreCopy } from './core-copy';
import ErrorBoundary from './ErrorBoundary';
import { useSound } from './use-sound';
import SoundControls from './SoundControls';
import { useLiveConfig } from './use-live-config';
import { listenRecentEvents } from './interaction-data';
import { addEffects } from './screen-effects';
import type { SkyEffect } from './screen-effects';
import SkyEffects from './SkyEffects';
const Scene = lazy(() => import('./GalaxyScene'));
export default function Screen({ language }: { language: Language }) {
  const text = coreCopy[language];
  const [synthetic] = useState(() =>
    import.meta.env.DEV ? Number(new URLSearchParams(location.search).get('synthetic')) || 0 : 0,
  );
  const [objects, setObjects] = useState<RenderObject[]>(() => syntheticObjects(synthetic));
  const [attempt, setAttempt] = useState(0);
  const live = useLiveConfig(synthetic > 0);
  const [now, setNow] = useState(Date.now);
  const [lastActivity, setLastActivity] = useState(Date.now);
  const [spotlight, setSpotlight] = useState<{ id: string; until: number }>();
  const [effects, setEffects] = useState<SkyEffect[]>([]);
  const [eventsFailed, setEventsFailed] = useState(false);
  const configuredScene = synthetic && import.meta.env.DEV
    ? new URLSearchParams(location.search).get('scene') ?? 'galaxy' : live.config.screenScene;
  const auto = configuredScene === 'galaxy' || configuredScene === 'spotlight';
  const spotlightObject = auto && spotlight && spotlight.until > now ? objects.find((o) => o.id === spotlight.id) : undefined;
  const idle = now - lastActivity >= (live.config.idleSeconds ?? 60) * 1000;
  const scene: ScreenScene = auto ? spotlightObject ? 'spotlight' : idle ? 'cinematic' : 'galaxy' : configuredScene as ScreenScene;
  useEffect(() => {
    const timer = window.setInterval(() => {
      const time = Date.now(); setNow(time);
      setEffects((previous) => previous.some((e) => time - e.at >= 6000) ? previous.filter((e) => time - e.at < 6000) : previous);
    }, 500);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (synthetic) {
      if (import.meta.env.DEV && new URLSearchParams(location.search).get('effects') === '1') {
        const timer = window.setTimeout(() => {
          const at = Date.now();
          setEffects(addEffects([], [
            ...Array.from({ length: 5 }, (_, i) => ({ id: `wave-${i}`, type: 'shake', objectId: '', at, payload: {} })),
            { id: 'comet', type: 'comet', objectId: '', at, payload: { dx: .9, dy: -.3 } },
            { id: 'star', type: 'shootingStar', objectId: '', at, payload: { messageKey: 'together' } },
            { id: 'meteors', type: 'meteorShower', objectId: '', at, payload: {} },
          ], at));
        }, 1500);
        return () => clearTimeout(timer);
      }
      return;
    }
    if (!firestore) return;
    return listenRecentEvents(firestore, (events) => {
      const time = Date.now();
      setEventsFailed(false);
      if (!events.length) return;
      setLastActivity(time);
      setEffects((old) => addEffects(old, events, time));
      const launch = [...events].reverse().find((e) => e.type === 'launch' || e.type === 'relaunch');
      if (launch) setSpotlight({ id: launch.objectId, until: time + 8000 });
    }, () => setEventsFailed(true));
  }, [synthetic, attempt]);
  const sound = useSound(8);
  const [focused, setFocused] = useState<string>();
  const [pet, setPet] = useState<{ id: string; at: number }>();
  const focusObject = spotlightObject ?? objects.find((o) => o.id === focused);
  function pick(id: string) {
    setLastActivity(Date.now());
    if (id !== focused) { setFocused(id); return; }
    setPet({ id, at: Date.now() }); sound.pet(id);
  }
  const debug = import.meta.env.DEV || new URLSearchParams(location.search).get('debug') === '1';
  const [fps, setFps] = useState(0);
  const [known, setKnown] = useState(synthetic > 0);
  const [state, setState] = useState<'loading' | 'live' | 'failed'>('loading');
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
  const visibleEffects = useMemo(() => effects.filter((e) => synthetic || (live.config.seasonOpen && (e.type === 'wave' ? live.config.shake : e.type === 'comet' ? live.config.comets : e.type === 'shootingStar' ? live.config.shootingStars : live.config.meteorShowers))), [effects, synthetic, live.config]);
  const status = synthetic ? 'live' : !firestore ? 'failed' : state;
  return (
    <section className="live-screen" data-screen-scene={scene}>
      <div className="screen-heading">
        <p className="eyebrow">Collective Galaxy / 2026</p>
        <h1>{text.screen}</h1>
      </div>
      <div className="screen-sound">
        <SoundControls sound={sound} language={language} screen/>
        <label>{language === 'es' ? 'Enfocar objeto' : 'Focus object'}
          <select aria-label={language === 'es' ? 'Enfocar objeto' : 'Focus object'} value={focusObject?.id ?? ''}
            onChange={(e) => { setFocused(e.target.value || undefined); setSpotlight(undefined); setLastActivity(Date.now()); }}>
            <option value="">{language === 'es' ? 'Vista de galaxia' : 'Galaxy view'}</option>
            {objects.map((o) => <option key={o.id} value={o.id}>{objectName(o.nameKey, language)} · {o.id.slice(-6)}</option>)}
          </select>
        </label>
        {focusObject && <button onClick={() => pick(focusObject.id)}>{language === 'es' ? 'Acariciar objeto enfocado' : 'Pet focused object'}</button>}
      </div>
      <div className="galaxy-field" data-scene={scene}>
        <ErrorBoundary
          fallback={
            <p className="scene-message">
              {text.unavailable}
              <button onClick={() => window.location.reload()}>{text.retry}</button>
            </p>
          }
        >
          <Suspense fallback={<p className="scene-message">{text.loading}</p>}>
            <Scene objects={objects} label={text.scene} unavailable={text.unavailable} onFps={debug ? setFps : undefined} focused={scene === 'cinematic' ? undefined : focusObject?.id} pet={pet} onPick={pick} onSoundCandidates={sound.update} cinematic={scene === 'cinematic'} />
          </Suspense>
        </ErrorBoundary>
        {visibleEffects.length > 0 && <SkyEffects effects={visibleEffects} language={language}/>}
        <div className="scene-crossfade" key={scene} aria-hidden="true"/>
        {spotlightObject && <p className="spotlight-caption" aria-live="polite">{language === 'es'
          ? `${spotlightObject.type === 'star' ? 'Nueva estrella' : spotlightObject.type === 'moon' ? 'Nueva luna' : 'Nuevo planeta'}: `
          : `New ${spotlightObject.type ?? 'planet'}: `}{objectName(spotlightObject.nameKey, language)}</p>}
        {configuredScene === 'spotlight' && !spotlightObject && <p className="scene-caption">{language === 'es' ? 'Esperando el próximo lanzamiento' : 'Waiting for the next launch'}</p>}
        {scene === 'timelapse' && <div className="timelapse-placeholder"><p className="eyebrow">G v0.6.0</p><h2>{language === 'es' ? 'La memoria de este cielo' : 'The memory of this sky'}</h2><p>{language === 'es' ? 'La repetición llegará en la próxima versión. El cielo en vivo sigue en marcha.' : 'Replay arrives in the next version. The live sky keeps moving.'}</p></div>}
        {(eventsFailed || (!synthetic && live.status === 'failed')) && <p className="events-status" role="status">{language === 'es' ? 'Eventos o escenas sin conexión.' : 'Events or scenes disconnected.'} <button onClick={() => { live.retry(); setAttempt((n) => n + 1); }}>{text.retry}</button></p>}
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

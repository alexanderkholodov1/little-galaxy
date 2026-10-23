import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
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
import { useVersionWatcher } from './version-watcher';
const Timelapse = lazy(() => import('./Timelapse'));
const Scene = lazy(() => import('./GalaxyScene'));
export default function Screen({ language }: { language: Language }) {
  const text = coreCopy[language];
  const [synthetic] = useState(() =>
    import.meta.env.DEV ? Number(new URLSearchParams(location.search).get('synthetic')) || 0 : 0,
  );
  const [objects, setObjects] = useState<RenderObject[]>(() => syntheticObjects(synthetic));
  const [attempt, setAttempt] = useState(0);
  const live = useLiveConfig(synthetic > 0);
  const { updateAvailable, reload } = useVersionWatcher({ appVersion: live.config.appVersion });
  const [reloading, setReloading] = useState(false);
  const soundAllowed = synthetic > 0 || (live.config.soundOnScreen !== false && live.config.sound !== false);
  const spotlightEnabled = live.status === 'live' ? live.config.spotlight !== false : true;
  const [now, setNow] = useState(Date.now);
  const [restored] = useState(() => {
    try { return JSON.parse(localStorage.getItem('galaxy.screen.context') ?? JSON.stringify({ configuredScene: localStorage.getItem('galaxy.screen.scene') === 'cinematic' ? 'galaxy' : localStorage.getItem('galaxy.screen.scene') ?? undefined, lastActivity: localStorage.getItem('galaxy.screen.scene') === 'cinematic' ? 0 : undefined })) as { configuredScene?: string; lastActivity?: number; focused?: string; spotlight?: { id: string; until: number }; kioskPresentation?: boolean }; } catch { return {}; }
  });
  const [lastActivity, setLastActivity] = useState(() => restored.lastActivity ?? Date.now());
  const [spotlight, setSpotlight] = useState<{ id: string; until: number } | undefined>(restored.spotlight);
  const [effects, setEffects] = useState<SkyEffect[]>([]);
  const [eventsFailed, setEventsFailed] = useState(false);
  const configuredScene = synthetic && import.meta.env.DEV
    ? new URLSearchParams(location.search).get('scene') ?? 'galaxy' : live.status !== 'live' && restored.configuredScene ? restored.configuredScene : live.config.screenScene;
  const auto = configuredScene === 'galaxy' || configuredScene === 'spotlight';
  const spotlightObject = spotlightEnabled && auto && spotlight && spotlight.until > now ? objects.find((o) => o.id === spotlight.id) : undefined;
  const idle = now - lastActivity >= (live.config.idleSeconds ?? 60) * 1000;
  const scene: ScreenScene = auto
    ? spotlightObject ? 'spotlight' : idle ? 'cinematic' : 'galaxy'
    : (configuredScene === 'spotlight' && !spotlightEnabled ? 'galaxy' : configuredScene as ScreenScene);
  const replaying = scene === 'timelapse';
  useEffect(() => {
    try { localStorage.setItem('galaxy.screen.scene', scene); } catch { /* Storage optional. */ }
  }, [scene]);
  useEffect(() => {
    if (!updateAvailable) return;
    let fade: number | undefined;
    const checkQuiet = () => {
      const quiet = !spotlightObject && effects.length === 0 && Date.now() - lastActivity >= 8000;
      if (quiet && fade === undefined) {
        setReloading(true);
        fade = window.setTimeout(() => { reload(); }, 600);
      }
    };
    const timer = window.setInterval(checkQuiet, 1500);
    return () => { clearInterval(timer); clearTimeout(fade); setReloading(false); };
  }, [updateAvailable, spotlightObject, effects.length, lastActivity, reload]);
  useEffect(() => {
    const timer = window.setInterval(() => {
      const time = Date.now(); setNow(time);
      setEffects((previous) => previous.some((e) => time - e.at >= 6000) ? previous.filter((e) => time - e.at < 6000) : previous);
    }, 500);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (replaying) return;
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
      if (launch && spotlightEnabled) setSpotlight({ id: launch.objectId, until: time + 8000 });
    }, () => setEventsFailed(true));
  }, [synthetic, attempt, replaying, spotlightEnabled]);
  const sound = useSound(8, soundAllowed);
  // Kiosk layout intent persists across reload/version recovery; DOM fullscreen needs a fresh gesture.
  const [kioskPresentation, setKioskPresentation] = useState(() => restored.kioskPresentation === true);
  const [mouseIdle, setMouseIdle] = useState(false);

  const toggleFullscreen = () => {
    if (typeof document === 'undefined') return;
    const isDomFs = Boolean(document.fullscreenElement);
    if (isDomFs) {
      setKioskPresentation(false);
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    } else {
      setKioskPresentation(true);
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else if (kioskPresentation) {
        // Fallback for environments lacking requestFullscreen (e.g. tests)
        setKioskPresentation(false);
      }
    }
  };

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const onFsChange = () => {
      // Esc / browser exit leaves kiosk; reload never fires this for the prior page.
      if (!document.fullscreenElement) setKioskPresentation(false);
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'f' || e.key === 'F') {
        const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
        if (tag === 'input' || tag === 'select' || tag === 'textarea') return;
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        e.preventDefault();
        toggleFullscreen();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [kioskPresentation]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let timer: ReturnType<typeof setTimeout>;
    const onMouseMove = () => {
      setMouseIdle(false);
      clearTimeout(timer);
      timer = setTimeout(() => setMouseIdle(true), 2500);
    };
    window.addEventListener('mousemove', onMouseMove);
    timer = setTimeout(() => setMouseIdle(true), 2500);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      clearTimeout(timer);
    };
  }, []);

  const [focused, setFocused] = useState<string | undefined>(restored.focused);
  const previousConfig = useRef(restored.configuredScene);
  useEffect(() => {
    if (live.status !== 'live') return;
    if (previousConfig.current !== undefined && previousConfig.current !== configuredScene) {
      setLastActivity(Date.now()); setFocused(undefined); setSpotlight(undefined);
    }
    previousConfig.current = configuredScene;
  }, [configuredScene, live.status]);
  useEffect(() => {
    if (live.status !== 'live') return;
    const save = () => {
      try { localStorage.setItem('galaxy.screen.context', JSON.stringify({ configuredScene, lastActivity, focused, spotlight, kioskPresentation })); } catch { /* Storage optional. */ }
    };
    save(); window.addEventListener('galaxy:save-state', save); window.addEventListener('beforeunload', save);
    return () => { window.removeEventListener('galaxy:save-state', save); window.removeEventListener('beforeunload', save); };
  }, [configuredScene, lastActivity, focused, spotlight, kioskPresentation, live.status]);
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
    if (!firestore || synthetic || replaying) return;
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
  }, [attempt, synthetic, replaying]);
  const visibleEffects = useMemo(() => effects.filter((e) => synthetic || (live.config.seasonOpen && (e.type === 'wave' ? live.config.shake : e.type === 'comet' ? live.config.comets : e.type === 'shootingStar' ? live.config.shootingStars : live.config.meteorShowers))), [effects, synthetic, live.config]);
  const status = synthetic ? 'live' : !firestore ? 'failed' : state;
  const fullscreenToggle = (
    <button
      type="button"
      className="fullscreen-toggle"
      aria-label={language === 'es' ? 'Pantalla completa (tecla F)' : 'Fullscreen (F key)'}
      onClick={toggleFullscreen}
    >
      {kioskPresentation
        ? (language === 'es' ? 'Salir de pantalla completa' : 'Exit fullscreen')
        : (language === 'es' ? 'Pantalla completa' : 'Fullscreen')}
    </button>
  );
  if (scene === 'timelapse') return <section className="screen-replay" data-screen-scene="timelapse" data-fullscreen={kioskPresentation ? 'true' : 'false'} data-mouse-idle={mouseIdle ? 'true' : 'false'}>{reloading && <div className="version-crossfade" aria-hidden="true"/>}<div className="screen-sound replay-kiosk-controls">{fullscreenToggle}</div><Suspense fallback={<p>{text.loading}</p>}><Timelapse language={language} join={<a className="join-qr replay-join" href={join}><span className="qr-image" dangerouslySetInnerHTML={{ __html: qrSvg }}/><span>{text.join}</span></a>}/></Suspense></section>;
  return (
    <section className="live-screen" data-screen-scene={scene} data-fullscreen={kioskPresentation ? 'true' : 'false'} data-mouse-idle={mouseIdle ? 'true' : 'false'}>
      <div className="screen-heading">
        <p className="eyebrow">Collective Galaxy / 2026</p>
        <h1>{text.screen}</h1>
      </div>
      <div className="screen-sound">
        <SoundControls sound={sound} language={language} screen disabled={!soundAllowed} disabledReason={live.status === 'live' ? (language === 'es' ? 'Sonido desactivado por el operador' : 'Sound disabled by operator') : (language === 'es' ? 'Sonido pausado hasta reconectar los controles' : 'Sound paused until live controls reconnect')}/>
        <label>{language === 'es' ? 'Enfocar objeto' : 'Focus object'}
          <select aria-label={language === 'es' ? 'Enfocar objeto' : 'Focus object'} value={focusObject?.id ?? ''}
            onChange={(e) => { setFocused(e.target.value || undefined); setSpotlight(undefined); setLastActivity(Date.now()); }}>
            <option value="">{language === 'es' ? 'Vista de galaxia' : 'Galaxy view'}</option>
            {objects.map((o) => <option key={o.id} value={o.id}>{objectName(o.nameKey, language)} · {o.id.slice(-6)}</option>)}
          </select>
        </label>
        {focusObject && <button onClick={() => pick(focusObject.id)}>{language === 'es' ? 'Acariciar objeto enfocado' : 'Pet focused object'}</button>}
        {fullscreenToggle}
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
            <Scene ready={known} objects={objects} label={text.scene} unavailable={text.unavailable} onFps={debug ? setFps : undefined} focused={scene === 'cinematic' ? undefined : focusObject?.id} pet={pet} onPick={pick} onSoundCandidates={sound.update} cinematic={scene === 'cinematic'} />
          </Suspense>
        </ErrorBoundary>
        {visibleEffects.length > 0 && <SkyEffects effects={visibleEffects} language={language}/>}
        <div className="scene-crossfade" key={scene} aria-hidden="true"/>
        {spotlightObject && <p className="spotlight-caption" aria-live="polite">{language === 'es'
          ? `${spotlightObject.type === 'star' ? 'Nueva estrella' : spotlightObject.type === 'moon' ? 'Nueva luna' : 'Nuevo planeta'}: `
          : `New ${spotlightObject.type ?? 'planet'}: `}{objectName(spotlightObject.nameKey, language)}</p>}
        {configuredScene === 'spotlight' && !spotlightObject && <p className="scene-caption">{language === 'es' ? 'Esperando el próximo lanzamiento' : 'Waiting for the next launch'}</p>}

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
      {reloading && <div className="version-crossfade" role="presentation" aria-hidden="true" />}
    </section>
  );
}

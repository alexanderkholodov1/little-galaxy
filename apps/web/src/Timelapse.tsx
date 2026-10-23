import type { ReactNode } from 'react';
import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { memoryRender, replay, replayScene } from '@little-galaxy/shared';
import type { Language } from '@little-galaxy/shared';
import { loadSeason } from './season-data';
import ErrorBoundary from './ErrorBoundary';
import SkyEffects from './SkyEffects';
import { addEffects } from './screen-effects';
const Scene = lazy(() => import('./GalaxyScene'));
export default function Timelapse({ language, join }: { language: Language; join?: ReactNode }) {
  const es = language === 'es';
  const [data, setData] = useState<Awaited<ReturnType<typeof loadSeason>>>();
  const [failed, setFailed] = useState(false), [attempt, setAttempt] = useState(0);
  const [at, setAt] = useState(0), [playing, setPlaying] = useState(() => { try { return localStorage.getItem('galaxy.timelapse.playing') === 'true'; } catch { return false; } });
  const [speed, setSpeed] = useState(() => {
    try {
      const s = Number(localStorage.getItem('galaxy.timelapse.speed'));
      return [1, 10, 60, 300, 600].includes(s) ? s : 60;
    } catch { return 60; }
  });
  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => { if (active) setFailed(true); controller.abort(); }, 12000);
    let active = true;
    loadSeason(controller.signal).then((value) => {
      if (active) {
        setData(value);
        let initialAt = value.manifest.start;
        try {
          const savedAt = Number(localStorage.getItem('galaxy.timelapse.at'));
          if (Number.isFinite(savedAt) && savedAt >= value.manifest.start && savedAt <= value.manifest.end) {
            initialAt = savedAt;
          }
        } catch { /* Storage optional. */ }
        setAt(initialAt);
        setFailed(false);
        clearTimeout(timeout);
      }
    }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; controller.abort(); clearTimeout(timeout); };
  }, [attempt]);
  useEffect(() => {
    if (at > 0) {
      try { localStorage.setItem('galaxy.timelapse.at', String(at)); } catch { /* Storage optional. */ }
    }
  }, [at]);
  useEffect(() => {
    try { localStorage.setItem('galaxy.timelapse.speed', String(speed)); } catch { /* Storage optional. */ }
  }, [speed]);
  useEffect(() => { try { localStorage.setItem('galaxy.timelapse.playing', String(playing)); } catch { /* Storage optional. */ } }, [playing]);
  const end = data?.manifest.end ?? 0;
  useEffect(() => {
    if (!playing || !data) return;
    let previous = performance.now();
    const timer = setInterval(() => {
      const now = performance.now(), delta = now - previous; previous = now;
      setAt((value) => {
        const next = value + delta * speed;
        if (next >= end) {
          setPlaying(false);
          return end;
        }
        return next;
      });
    }, 50);
    return () => clearInterval(timer);
  }, [playing, speed, end, data]);
  const state = useMemo(() => replay(data?.chunks ?? [], at), [data, at]);
  const objects = useMemo(() => replayScene(state), [state]);
  const departed = useMemo(() => state.filter((o) => o.status === 'hangar' && at - o.updatedAt < 120000).map(memoryRender), [state, at]);
  const events = useMemo(() => (data?.chunks ?? []).flatMap((c) => c.events).filter((e) => e[1] <= at), [data, at]);
  const births = useMemo(() => new Map(events.filter((e) => ['launch', 'relaunch', 'create'].includes(e[2])).map((e) => [e[3], e[1]])), [events]);
  const effects = useMemo(() => {
    let result: ReturnType<typeof addEffects> = [];
    for (const e of events.filter((e) => at - e[1] < 7500)) result = addEffects(result, [{ id: e[0], at: e[1], type: e[2], objectId: e[3], payload: typeof e[4] === 'number' ? {} : e[4] }], e[1]);
    return result.filter((e) => at - e.at < 6000);
  }, [events, at]);
  const retry = <button onClick={() => { setFailed(false); setAttempt((n) => n + 1); }}>{es ? 'Reintentar' : 'Retry'}</button>;
  return <section className="memory-log" aria-label={es ? 'Repetición de la temporada' : 'Season replay'}>
    <div className="memory-heading"><p className="eyebrow">{es ? 'Temporada: BAD 2026' : 'Season: BAD 2026'}</p><h1>{es ? 'La memoria de este cielo' : 'The memory of this sky'}</h1></div>
    <div className="memory-field">
    {failed ? <div className="memory-state" role="status"><h2>{es ? 'La memoria no está disponible' : 'Memory is unavailable'}</h2><p>{es ? 'Sin conexión o el archivo aún no está publicado. Vuelve a intentarlo.' : 'You may be offline, or the stand has not published the archive yet.'}</p>{retry}</div>
      : !data ? <p role="status">{es ? 'Leyendo el registro de observación…' : 'Reading the observing log…'}</p>
      : !data.manifest.eventCount ? <p role="status">{es ? 'Esta temporada aún no tiene observaciones.' : 'This season has no observations yet.'}</p>
      : <><ErrorBoundary fallback={<p>{es ? 'Vista 3D no disponible.' : '3D view unavailable.'}</p>}><Suspense fallback={<p>{es ? 'Preparando el cielo…' : 'Preparing the sky…'}</p>}>
          <Scene objects={objects} departed={departed} births={births} historicalAt={at} label={es ? 'Cielo histórico' : 'Historical sky'} unavailable={es ? '3D no disponible' : '3D unavailable'}/>
        </Suspense></ErrorBoundary><SkyEffects effects={effects} language={language} now={at}/></>}
        {join}
      </div>
      {data && data.manifest.eventCount > 0 && !failed && <>
        <div className="replay-controls">
          <button onClick={() => { if (at >= end) setAt(data.manifest.start); setPlaying(!playing || at >= end); }} aria-pressed={playing}>{playing ? (es ? 'Pausar' : 'Pause') : (es ? 'Reproducir' : 'Play')}</button>
          <label>{es ? 'Velocidad' : 'Speed'}<select value={speed} onChange={(e) => setSpeed(Number(e.target.value))}>{[1, 10, 60, 300, 600].map((s) => <option key={s} value={s}>{s}×</option>)}</select></label>
          <label className="replay-scrubber">{es ? 'Momento de la temporada' : 'Season time'}<input type="range" min={data.manifest.start} max={end} step="any" value={at} onChange={(e) => { setPlaying(false); setAt(Number(e.target.value)); }} onKeyDown={(e) => { if (e.key === 'Home') { setPlaying(false); setAt(data.manifest.start); } else if (e.key === 'End') { setPlaying(false); setAt(end); } }} /></label>
          <output>{new Date(at).toLocaleString(es ? 'es' : 'en', { timeZone: 'UTC' })} UTC · {objects.filter((o) => !o.moonHost).length} {es ? 'objetos' : 'objects'}</output>
        </div><p className="memory-source">{data.frozen ? (es ? 'Archivo estático' : 'Static archive') : (es ? 'Registro publicado por el stand' : 'Log published by the stand')} · {data.manifest.eventCount} {es ? 'eventos' : 'events'}</p>
      </>}
  </section>;
}

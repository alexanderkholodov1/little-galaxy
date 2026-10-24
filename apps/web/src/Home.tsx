import { lazy, Suspense, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { firestore } from './firebase';
import { listenActive } from './galaxy-data';
import type { RenderObject } from '@little-galaxy/shared';
import type { Language } from '@little-galaxy/shared';
import { loadHome } from './season-data';
import ErrorBoundary from './ErrorBoundary';
const Scene = lazy(() => import('./GalaxyScene'));
const Timelapse = lazy(() => import('./Timelapse'));
export default function Home({ language }: { language: Language }) {
  const es = language === 'es';
  const [data, setData] = useState<{ frozen: boolean; objects?: RenderObject[]; at?: number }>();
  const [failed, setFailed] = useState(false), [attempt, setAttempt] = useState(0), [replay, setReplay] = useState(false);
  useEffect(() => {
    const controller = new AbortController(); let active = true; let stop: (() => void) | undefined;
    const timeout = setTimeout(() => { if (active) setFailed(true); controller.abort(); }, 12000);
    loadHome(controller.signal).then((result) => {
      if (!active) return;
      if (result.frozen) { setData(result); setFailed(false); clearTimeout(timeout); return; }
      if (!firestore) throw new Error('No live connection');
      stop = listenActive(firestore, (objects, fromCache) => {
        if (!active || (fromCache && !objects.length)) return;
        setData({ frozen: false, objects, at: Date.now() });
        setFailed(fromCache); if (!fromCache) clearTimeout(timeout);
      }, () => { if (active) setFailed(true); });
    }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; controller.abort(); clearTimeout(timeout); stop?.(); };
  }, [attempt]);
  if (data?.frozen || replay) return <>{replay && !data?.frozen && <button className="replay-back" onClick={() => setReplay(false)}>{es ? 'Volver al cielo actual' : 'Return to the current sky'}</button>}<Suspense fallback={<p>{es ? 'Abriendo la memoria…' : 'Opening memory…'}</p>}><Timelapse language={language}/></Suspense></>;
  return <section className="memory-log">
    <div className="memory-heading"><p className="eyebrow">Collective Galaxy / BAD 2026</p><h1>{es ? 'Un cielo compartido.' : 'A shared sky.'}</h1></div>
    <div className="memory-field"><ErrorBoundary fallback={<p>{es ? 'Vista 3D no disponible.' : '3D view unavailable.'}</p>}><Suspense fallback={<p>{es ? 'Preparando el cielo…' : 'Preparing the sky…'}</p>}>
      {data && <Scene objects={data.objects ?? []} label={es ? 'Cielo de la feria' : 'Fair sky'} unavailable={es ? '3D no disponible' : '3D unavailable'}/>}
    </Suspense></ErrorBoundary>
    {(!data || failed) && <p role="status">{failed ? (es ? 'Sin conexión. Reintenta para ver el cielo.' : 'No connection. Retry to see the sky.') : (es ? 'Leyendo la última observación…' : 'Reading the latest observation…')}</p>}</div>
    <div className="replay-controls"><button onClick={() => { setFailed(false); setAttempt((n) => n + 1); }}>{failed ? (es ? 'Reintentar' : 'Retry') : (es ? 'Actualizar cielo' : 'Refresh sky')}</button><button onClick={() => setReplay(true)}>{es ? 'Repetir la temporada' : 'Replay the season'}</button><Link className="memory-return" to={`/create?lang=${language}`}>{es ? 'Crear un objeto' : 'Make an object'}</Link></div>
    {data && <p className="memory-source" role="status">{data.objects?.filter((o) => !o.moonHost).length} {es ? 'objetos' : 'objects'} · {es ? 'Última observación' : 'Last observation'}: {new Date(data.at!).toLocaleString(es ? 'es' : 'en', { timeZone: 'UTC' })} UTC{failed && (es ? ' · Sin conexión; se conserva la última observación.' : ' · Offline; keeping the last observation.')}</p>}
  </section>;
}

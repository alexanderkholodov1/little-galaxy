import { lazy, Suspense, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { memoryRender, objectName } from '@little-galaxy/shared';
import type { Language, MemoryObject } from '@little-galaxy/shared';
import { loadMemoryObject } from './season-data';
import { useSound } from './use-sound';
import SoundControls from './SoundControls';
import ErrorBoundary from './ErrorBoundary';
const Preview = lazy(() => import('./ObjectPreview'));
const Postcard = lazy(() => import('./Postcard'));
export default function ObjectPage({ language }: { language: Language }) {
  const { id = '' } = useParams();
  const es = language === 'es';
  const [result, setResult] = useState<{ id: string; object: MemoryObject | null }>();
  const [failed, setFailed] = useState(false), [attempt, setAttempt] = useState(0);
  const [pet, setPet] = useState<{ id: string; at: number }>();
  const sound = useSound(1), update = sound.update;
  const object = result?.id === id ? result.object : undefined;
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const timeout = setTimeout(() => { if (active) setFailed(true); controller.abort(); }, 12000);
    loadMemoryObject(id, controller.signal).then((value) => { if (active) { setResult({ id, object: value }); setFailed(false); clearTimeout(timeout); } }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; clearTimeout(timeout); controller.abort(); };
  }, [id, attempt]);
  useEffect(() => {
    update(object ? [memoryRender(object)] : [], object ? [{ id: object.id, visible: true, distance: 0, focused: true }] : []);
  }, [object, update]);
  const petObject = () => { setPet({ id, at: Date.now() }); sound.pet(id); };
  return <article className="object-record">
    <p className="eyebrow">Collective Galaxy / BAD 2026</p>
    {failed ? <div className="memory-state" role="status"><h1>{es ? 'No podemos abrir esta observación' : 'This observation is unavailable'}</h1><p>{es ? 'Puede que estés sin conexión. El objeto permanece en el archivo.' : 'You may be offline. The object stays in the archive.'}</p><button onClick={() => { setFailed(false); setAttempt((n) => n + 1); }}>{es ? 'Reintentar' : 'Retry'}</button></div>
      : object === undefined ? <p role="status">{es ? 'Buscando la observación…' : 'Finding the observation…'}</p>
      : object === null ? <div className="memory-state"><h1>{es ? 'Objeto no encontrado' : 'Object not found'}</h1><p>{es ? 'Comprueba el enlace. Puede que el stand aún no haya publicado esta observación.' : 'Check the link. The stand may still be preparing this observation.'}</p></div>
      : <>
        <h1>{objectName(object.nameKey, language)}</h1>
        <div className="object-layout"><div className="permanent-specimen"><ErrorBoundary fallback={<p>{es ? 'Vista 3D no disponible. El sonido y la postal siguen disponibles.' : '3D view unavailable. Sound and postcard remain available.'}</p>}><Suspense fallback={<p>{es ? 'Preparando el objeto…' : 'Preparing the object…'}</p>}><Preview draft={object} identity={id} departed={[]} pet={pet} onPet={petObject}/></Suspense></ErrorBoundary></div>
        <div className="object-notes"><p className="eyebrow">{es ? 'Registro de observación' : 'Observation record'}</p><dl><dt>{es ? 'Tipo' : 'Type'}</dt><dd>{es ? ({ planet: 'Planeta', star: 'Estrella', moon: 'Luna' }[object.type]) : object.type}</dd><dt>{es ? 'Primer lanzamiento' : 'First launch'}</dt><dd><time dateTime={new Date(object.createdAt).toISOString()}>{new Date(object.createdAt).toLocaleDateString(es ? 'es' : 'en', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })}</time></dd><dt>{es ? 'Estado' : 'Status'}</dt><dd>{object.status === 'active' ? (es ? 'En el cielo' : 'In the sky') : (es ? 'En el hangar · conservado para siempre' : 'Hangared · kept forever')}</dd></dl>
          <button onClick={petObject}>{es ? 'Tocar y escuchar' : 'Tap to listen'}</button><SoundControls sound={sound} language={language}/>
          <Suspense fallback={<p>{es ? 'Preparando postal…' : 'Preparing postcard…'}</p>}><Postcard object={object} language={language}/></Suspense>
        </div></div>
      </>}
    <Link className="memory-return" to={`/?lang=${language}`}>{es ? 'Volver a la galaxia' : 'Return to the galaxy'}</Link>
  </article>;
}

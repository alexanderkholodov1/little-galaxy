import { useEffect, useRef, useState } from 'react';
import type { Language, MemoryObject } from '@little-galaxy/shared';
import { createPostcard, downloadPostcard, sharePostcard } from './postcard';
export default function Postcard({ object, language }: { object: MemoryObject; language: Language }) {
  const es = language === 'es';
  const [prepared, setPrepared] = useState<{ key: string; file: File }>();
  const [state, setState] = useState<'idle' | 'rendering' | 'ready' | 'sharing' | 'shared' | 'downloaded' | 'cancelled' | 'failed'>('idle');
  const key = `${object.id}:${object.updatedAt}:${language}`;
  const file = prepared?.key === key ? prepared.file : undefined;
  const image = useRef<HTMLImageElement>(null);
  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file); if (image.current) image.current.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return <section className="postcard-actions" aria-label={es ? 'Postal' : 'Postcard'}>
    <h2>{es ? 'Conserva este cielo' : 'Keep this sky'}</h2><p>{es ? 'Postal de 1080 × 1920 con un enlace a tu objeto.' : 'A 1080 × 1920 postcard with a link to your object.'}</p>
    {file && <img ref={image} width="1080" height="1920" alt={es ? 'Vista previa de la postal' : 'Postcard preview'}/>}
    <button disabled={state === 'rendering' || state === 'sharing'} onClick={() => {
      setState('rendering');
      void createPostcard(object, language).then((blob) => { setPrepared({ key, file: new File([blob], `galaxy-${object.id}.png`, { type: 'image/png' }) }); setState('ready'); }).catch(() => setState('failed'));
    }}>{state === 'rendering' ? (es ? 'Dibujando postal…' : 'Drawing postcard…') : file ? (es ? 'Volver a dibujar' : 'Redraw postcard') : (es ? 'Crear postal' : 'Create postcard')}</button>
    {file && <><button disabled={state === 'sharing'} onClick={() => { setState('sharing'); void sharePostcard(file).then(setState).catch(() => setState('failed')); }}>{es ? 'Compartir postal' : 'Share postcard'}</button><button onClick={() => { downloadPostcard(file); setState('downloaded'); }}>{es ? 'Descargar PNG' : 'Download PNG'}</button></>}
    <p role="status">{state === 'failed' ? (es ? 'No se pudo preparar o compartir. Reintenta o descarga el PNG si está disponible.' : 'Could not prepare or share. Retry, or download the PNG if available.') : state === 'ready' ? (es ? 'Postal lista. Toca Compartir.' : 'Postcard ready. Tap Share.') : state === 'shared' ? (es ? 'Postal compartida.' : 'Postcard shared.') : state === 'downloaded' ? (es ? 'Descarga iniciada.' : 'Download started.') : state === 'cancelled' ? (es ? 'Se canceló. Tu postal sigue lista.' : 'Cancelled. Your postcard is still ready.') : ''}</p>
  </section>;
}

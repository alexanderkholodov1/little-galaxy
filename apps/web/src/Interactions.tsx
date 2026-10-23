import { useEffect, useRef, useState } from 'react';
import { interactionCooldown, interactionFlag, messageKeys, messageText, utcDay } from '@little-galaxy/shared';
import type { InteractionType, Language, LiveConfig, MessageKey } from '@little-galaxy/shared';
import { anonymousUid, firestore } from './firebase';
import { InteractionError, sendInteraction } from './interaction-data';
import { enableMotion } from './motion';
const copy = {
  en: { title: 'Across the shared sky', shake: 'Send an aurora wave', motion: 'Enable phone shake', motionReady: 'Motion enabled. Shake twice to send a wave.', fallback: 'Motion unavailable. Use the wave button.', comet: 'Swipe to throw a comet', gentle: 'Throw a comet to the right', message: 'Shooting-star message', send: 'Send shooting star', paused: 'The operator has paused this interaction.', closed: 'The sky is closed for interactions.', loading: 'Checking the interaction window…', failed: 'Live controls unavailable. Reconnect to check the window.', retry: 'Check again', sending: 'Sending to the shared sky…', sent: 'Sent. Look at the booth screen.', cooldown: 'Let the sky settle. Try again after the countdown.', limit: 'Today’s ten shared interactions are used. Return tomorrow (UTC).', offline: 'You are offline. Reconnect, then try again; gestures are not queued.', rejected: 'Not sent. The window or your cooldown may have changed. Try again shortly.', wait: 'Wait', seconds: 's' },
  es: { title: 'En el cielo compartido', shake: 'Enviar una onda de aurora', motion: 'Activar agitar el teléfono', motionReady: 'Movimiento activado. Agita dos veces para enviar una onda.', fallback: 'Movimiento no disponible. Usa el botón de aurora.', comet: 'Desliza para lanzar un cometa', gentle: 'Lanzar un cometa a la derecha', message: 'Mensaje de estrella fugaz', send: 'Enviar estrella fugaz', paused: 'El operador ha pausado esta interacción.', closed: 'El cielo está cerrado para interacciones.', loading: 'Comprobando las interacciones…', failed: 'Controles en vivo no disponibles. Reconecta para comprobarlos.', retry: 'Comprobar de nuevo', sending: 'Enviando al cielo compartido…', sent: 'Enviado. Mira la pantalla del puesto.', cooldown: 'Deja que el cielo descanse. Espera a que termine la cuenta.', limit: 'Ya usaste las diez interacciones de hoy. Vuelve mañana (UTC).', offline: 'Sin conexión. Reconecta e inténtalo de nuevo; los gestos no quedan en cola.', rejected: 'No se envió. La ventana o tu espera pueden haber cambiado. Inténtalo en unos segundos.', wait: 'Espera', seconds: 's' },
};
export default function Interactions({ language, config, status, retry, disabled = false, onBusyChange }: {
  language: Language; config: LiveConfig; status: 'loading' | 'live' | 'failed'; retry: () => void; disabled?: boolean; onBusyChange?: (busy: boolean) => void;
}) {
  const text = copy[language];
  const [message, setMessage] = useState<keyof typeof text>();
  const [key, setKey] = useState<MessageKey>('hello');
  const [motion, setMotion] = useState<'off' | 'ready' | 'unavailable'>('off');
  const [pending, setPending] = useState(false);
  const [now, setNow] = useState(Date.now);
  const [next, setNext] = useState({ any: 0, shake: 0, comet: 0, shootingStar: 0 });
  const [limitedDay, setLimitedDay] = useState('');
  const inFlight = useRef(false), mounted = useRef(true);
  const allowed = useRef({ shake: false, comet: false, shootingStar: false });
  const stopMotion = useRef<(() => void) | undefined>(undefined);
  const aggregate = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const request = useRef<(type: InteractionType, payload: Record<string, unknown>) => void>(() => {});
  const start = useRef<{ x: number; y: number; id: number } | undefined>(undefined);
  useEffect(() => {
    mounted.current = true;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => { mounted.current = false; clearInterval(timer); clearTimeout(aggregate.current); stopMotion.current?.(); };
  }, []);
  const open = status === 'live' && config.seasonOpen;
  const pauseReason = status === 'loading' ? text.loading : status === 'failed' ? text.failed : !config.seasonOpen ? text.closed : text.paused;
  const shakeEnabled = open && config.shake;
  useEffect(() => { allowed.current = { shake: shakeEnabled && !disabled, comet: open && config.comets && !disabled, shootingStar: open && config.shootingStars && !disabled }; }, [shakeEnabled, disabled, open, config.comets, config.shootingStars]);
  useEffect(() => {
    if (!shakeEnabled) { stopMotion.current?.(); stopMotion.current = undefined; }
  }, [shakeEnabled]);
  function wait(type: InteractionType) { return Math.max(0, Math.ceil((Math.max(next.any, next[type]) - now) / 1000)); }
  function blocked(type: InteractionType) {
    return disabled || pending || !open || !config[interactionFlag[type]] || limitedDay === utcDay(now) || wait(type) > 0;
  }
  async function send(type: InteractionType, payload: Record<string, unknown>) {
    if (inFlight.current || blocked(type)) return;
    if (!navigator.onLine) { setMessage('offline'); return; }
    inFlight.current = true; onBusyChange?.(true); setPending(true); setMessage('sending');
    // Coalesce a burst of sensor/manual shakes into one write pair. Never queue a trailing shake.
    try {
      if (type === 'shake') await new Promise<void>((resolve) => { aggregate.current = setTimeout(resolve, 900); });
      if (!mounted.current) return;
      if (!allowed.current[type]) throw new InteractionError('closed');
      if (!navigator.onLine) throw new InteractionError('offline');
      if (!firestore) throw new Error('unavailable');
      await sendInteraction(firestore, await anonymousUid(), type, payload);
      if (mounted.current) setNext((old) => ({ ...old, any: Date.now() + 2200, [type]: Date.now() + interactionCooldown[type] + 500 }));
      if (mounted.current) setMessage('sent');
    } catch (error) {
      const reason = error instanceof InteractionError ? error.reason : 'rejected';
      if (reason === 'limit' && mounted.current) setLimitedDay(utcDay(Date.now()));
      if ((reason === 'cooldown' || reason === 'rejected') && mounted.current) setNext((old) => ({ ...old, any: Date.now() + 2200, [type]: Date.now() + (error instanceof InteractionError ? error.retryAfter : 2200) }));
      if (mounted.current) setMessage(reason === 'closed' ? 'closed' : reason);
    } finally {
      inFlight.current = false; onBusyChange?.(false);
      if (mounted.current) { setPending(false); setNow(Date.now()); }
    }
  }
  useEffect(() => { request.current = (type, payload) => { void send(type, payload); }; });
  async function motionTap() {
    stopMotion.current?.();
    try {
      // requestPermission is invoked synchronously inside this tap, before any await/import.
      setMotion('ready');
      const permission = enableMotion(() => request.current('shake', {}), () => { if (mounted.current) setMotion('unavailable'); });
      const stop = await permission;
      if (mounted.current && allowed.current.shake) stopMotion.current = stop; else stop();
    } catch { if (mounted.current) setMotion('unavailable'); }
  }
  const label = (type: InteractionType, title: string) => wait(type) ? `${title} · ${text.wait} ${wait(type)} ${text.seconds}` : title;
  return <section className="interactions">
    <p className="eyebrow">04 / {text.title}</p>
    <h2>{text.title}</h2>
    {status !== 'live' ? <p role="status">{text[status === 'loading' ? 'loading' : 'failed']} {status === 'failed' && <button onClick={retry}>{text.retry}</button>}</p>
      : !config.seasonOpen && <p role="status">{text.closed}</p>}
    <div className="interaction-row">
      <h3>Aurora</h3>
      <button disabled={blocked('shake')} onClick={() => void send('shake', {})}>{label('shake', text.shake)}</button>
      {shakeEnabled ? <><button disabled={motion === 'ready' || pending} onClick={() => void motionTap()}>{text.motion}</button><p role="status">{motion === 'ready' ? text.motionReady : motion === 'off' ? (language === 'es' ? 'Usa el botón o activa el movimiento.' : 'Use the button, or enable motion.') : text.fallback}</p></>
        : <p>{pauseReason}</p>}
    </div>
    <div className="interaction-row">
      <h3>{language === 'es' ? 'Cometa' : 'Comet'}</h3>
      {config.comets && open ? <div className="comet-swipe" aria-label={text.comet} data-disabled={blocked('comet')}
        onPointerDown={(e) => { if (!e.isPrimary || e.button !== 0 || blocked('comet')) return; e.currentTarget.setPointerCapture(e.pointerId); start.current = { x: e.clientX, y: e.clientY, id: e.pointerId }; }}
        onPointerCancel={() => { start.current = undefined; }}
        onPointerUp={(e) => {
          const s = start.current; start.current = undefined;
          if (!s || s.id !== e.pointerId) return;
          const dx = e.clientX - s.x, dy = e.clientY - s.y, length = Math.hypot(dx, dy);
          if (length >= 24) void send('comet', { dx: dx / length, dy: dy / length });
        }}><svg viewBox="0 0 300 90" aria-hidden="true"><path d="M25 45h250m-18-12 18 12-18 12" fill="none" stroke="currentColor"/><circle cx="25" cy="45" r="5" fill="currentColor"/></svg><span>{text.comet}</span></div> : <p>{pauseReason}</p>}
      <button disabled={blocked('comet')} onClick={() => void send('comet', { dx: 1, dy: 0 })}>{label('comet', text.gentle)}</button>
    </div>
    <div className="interaction-row">
      <label>{text.message}<select value={key} disabled={blocked('shootingStar')} onChange={(e) => setKey(e.target.value as MessageKey)}>
        {messageKeys.map((k) => <option key={k} value={k}>{messageText(k, language)}</option>)}
      </select></label>
      <button disabled={blocked('shootingStar')} onClick={() => void send('shootingStar', { messageKey: key })}>{label('shootingStar', text.send)}</button>
      {(!config.shootingStars || !open) && <p>{pauseReason}</p>}
    </div>
    <p role="status" className="interaction-feedback">{limitedDay === utcDay(now) ? text.limit : message && message !== 'limit' ? text[message] : '\u00a0'}</p>
  </section>;
}

import { useEffect, useRef, useState } from 'react';
import { nameKeys, objectName, orbitFromSwipe, orbitFromVelocity, palette, GRAVITY, LAUNCH_RADIUS } from '@little-galaxy/shared';
import type { Language, Orbit } from '@little-galaxy/shared';
import { anonymousUid, firestore } from './firebase';
import { LaunchError, launchPlanet, ownActive } from './galaxy-data';
import { loadDraft, saveDraft } from './draft';
import { coreCopy } from './core-copy';
import { copy } from './copy';
import SessionLine from './SessionLine';

export default function Create({ language }: { language: Language }) {
  const text = coreCopy[language];
  const [draft, setDraft] = useState(loadDraft);
  const [message, setMessage] = useState<keyof typeof text | null>(null);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const start = useRef<{ x: number; y: number; t: number; pointer: number } | null>(null);
  const [trace, setTrace] = useState<[number, number] | null>(null);
  useEffect(() => { saveDraft(draft); }, [draft]);
  useEffect(() => {
    let alive = true;
    if (firestore) void anonymousUid().then((uid) => ownActive(firestore!, uid)).then((active) => {
      if (alive && active) setMessage(active.orbit.isComet ? 'comet' : 'restored');
    }).catch(() => { /* SessionLine supplies connection recovery. */ });
    return () => { alive = false; };
  }, []);
  async function launch(orbit: Orbit) {
    if (lock.current) return;
    if (!navigator.onLine) { setMessage('offline'); return; }
    lock.current = true; setBusy(true); setMessage('launching');
    const timeout = window.setTimeout(() => setMessage('saving'), 8000);
    try {
      if (!firestore) throw new Error('unconfigured');
      const uid = await anonymousUid();
      await launchPlanet(firestore, uid, draft, orbit);
      setMessage(orbit.isComet ? 'comet' : 'orbit');
    } catch (error) { setMessage(error instanceof LaunchError ? error.reason : 'rejected'); }
    finally { window.clearTimeout(timeout); lock.current = false; setBusy(false); }
  }
  return <section className="workshop">
    <div className="workshop-title"><p className="eyebrow">{text.desk}</p><h1>{text.create}</h1></div>
    <figure className="planet-specimen">
      <svg role="img" aria-label={objectName(draft.nameKey, language)} viewBox="0 0 320 280">
        <defs><radialGradient id="planet-light" cx="28%" cy="25%"><stop stopColor="#ffffff" stopOpacity=".5"/><stop offset=".65" stopColor="#ffffff" stopOpacity="0"/><stop offset="1" stopColor="#020914" stopOpacity=".85"/></radialGradient>
          <clipPath id="planet-edge"><circle cx="160" cy="140" r={draft.params.size * 140 + 35}/></clipPath></defs>
        <path d="M20 140h280M160 15v250" stroke="#60788e" strokeWidth=".5"/>
        <g clipPath="url(#planet-edge)"><circle cx="160" cy="140" r="134" fill={palette[draft.params.palette]}/>
          <path d="M40 100Q100 30 180 105T300 180L260 250Q150 100 40 220Z" fill="#104c97" opacity={draft.params.oceans}/>
          <circle cx="160" cy="140" r={draft.params.size * 140 + 35} fill="url(#planet-light)"/></g>
        <circle cx="160" cy="140" r={draft.params.size * 140 + 43} fill="none" stroke="#60788e" strokeDasharray="2 7"/>
      </svg><figcaption>{text.preview}</figcaption>
    </figure>
    <fieldset disabled={busy} className="planet-controls"><legend>{text.choose}</legend>
      <div className="surface-choices">{palette.map((colour, index) => <button key={colour} aria-label={`${text.choose} ${index + 1}`} aria-pressed={draft.params.palette === index} onClick={() => setDraft({ ...draft, params: { ...draft.params, palette: index } })}><span style={{ background: colour }}/><span>{String(index + 1).padStart(2, '0')}</span></button>)}</div>
      <label>{text.size}<output>{draft.params.size.toFixed(2)}</output><input type="range" min="0.2" max="0.7" step="0.01" value={draft.params.size} onChange={(e) => setDraft({ ...draft, params: { ...draft.params, size: Number(e.target.value) } })}/></label>
      <label>{text.oceans}<output>{Math.round(draft.params.oceans * 100)}%</output><input type="range" min="0" max="1" step="0.01" value={draft.params.oceans} onChange={(e) => setDraft({ ...draft, params: { ...draft.params, oceans: Number(e.target.value) } })}/></label>
      <label>{text.name}<select value={draft.nameKey} onChange={(e) => setDraft({ ...draft, nameKey: e.target.value as typeof draft.nameKey })}>{nameKeys.map((key) => <option key={key} value={key}>{objectName(key, language)}</option>)}</select></label>
    </fieldset>
    <div className="launch-desk"><p className="eyebrow">{text.swipe}</p><p className="launch-instruction">{text.instruction}</p>
      <div className="swipe-window" aria-label={text.swipe} data-busy={busy} onPointerDown={(e) => {
        if (busy || !e.isPrimary || e.button !== 0) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        start.current = { x: e.clientX, y: e.clientY, t: performance.now(), pointer: e.pointerId }; setTrace([0, 0]);
      }} onPointerMove={(e) => { const s = start.current; if (s?.pointer === e.pointerId) setTrace([e.clientX - s.x, e.clientY - s.y]); }}
      onPointerCancel={() => { start.current = null; setTrace(null); }} onPointerUp={(e) => {
        const s = start.current; start.current = null; setTrace(null);
        if (!s || s.pointer !== e.pointerId || busy) return;
        const dx = e.clientX - s.x, dy = e.clientY - s.y;
        if (Math.hypot(dx, dy) < 12) return;
        void launch(orbitFromSwipe(dx, dy, (performance.now() - s.t) / 1000, Date.now()));
      }}><svg viewBox="0 0 320 150" aria-hidden="true"><path d="M15 75h290M160 15v120" stroke="#60788e" strokeDasharray="3 6"/><circle cx="160" cy="75" r="17" fill={palette[draft.params.palette]}/>{trace && <path d={`M160 75l${trace[0]} ${trace[1]}`} stroke="#5fccf3" strokeWidth="3"/>}</svg></div>
      <p>{text.hint}</p><button disabled={busy} onClick={() => void launch(orbitFromVelocity(0, Math.sqrt(GRAVITY / LAUNCH_RADIUS), 0.08, Date.now()))}>{text.keyboard}</button>
      {message && <p className={`launch-feedback ${['orbit', 'comet', 'restored'].includes(message) ? 'confirmed' : 'notice'}`} role="status" aria-live="polite">{text[message]}</p>}
    </div><SessionLine text={copy[language]}/>
  </section>;
}

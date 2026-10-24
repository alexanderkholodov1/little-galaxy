import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import {
  objectName,
  orbitFromSwipe,
  orbitFromVelocity,
  palette,
  GRAVITY,
  LAUNCH_RADIUS,
  leastCrowdedHost,
  newName,
  presets,
  utcDay,
} from '@little-galaxy/shared';
import type { GalaxyObject, Language, ObjectParams, Orbit, RenderObject } from '@little-galaxy/shared';
import { anonymousUid, firestore } from './firebase';
import {
  availableHosts,
  editObject,
  LaunchError,
  launchPlanet,
  ownObjects,
  relaunchObject,
  renderObject,
} from './galaxy-data';
import { loadDraft, saveDraft } from './draft';
import { coreCopy } from './core-copy';
import { copy } from './copy';
import SessionLine from './SessionLine';
import ErrorBoundary from './ErrorBoundary';
import { richCopy } from './rich-copy';
import { useSound } from './use-sound';
import SoundControls from './SoundControls';
import Specimen from './Specimen';
import { useLiveConfig } from './use-live-config';
const Interactions = lazy(() => import('./Interactions'));
import { loadNameHistory, saveNameHistory } from './name-history';
import { useVersionWatcher } from './version-watcher';
const Preview = lazy(() => import('./ObjectPreview'));
function remember(mode: string, objectId?: string) {
  try {
    localStorage.setItem('galaxy.workshop.mode', mode);
    if (objectId) localStorage.setItem('galaxy.workshop.object', objectId);
  } catch {
    /* Storage optional. */
  }
}
function savedMode(key = 'galaxy.workshop.mode') {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export default function Create({ language }: { language: Language }) {
  const text = coreCopy[language],
    rich = richCopy[language];
  const live = useLiveConfig();
  const { updateAvailable, reload } = useVersionWatcher({ appVersion: live.config.appVersion });
  const launchesOpen = live.status === 'live' && live.config.seasonOpen && live.config.launches;
  const editsOpen = live.status === 'live' ? (live.config.seasonOpen && live.config.edits !== false) : true;
  const [draft, setDraft] = useState(loadDraft);
  const [workshopStep, setWorkshopStep] = useState<string>(() => {
    try { return localStorage.getItem('galaxy.workshop.step') ?? 'parameters'; } catch { return 'parameters'; }
  });
  const [hangarView, setHangarView] = useState<boolean>(() => {
    try { return localStorage.getItem('galaxy.workshop.hangar') === 'true'; } catch { return false; }
  });
  const [inspect3D, setInspect3D] = useState(() => {
    const saved = savedMode('galaxy.workshop.inspect3D');
    return saved === null ? savedMode('galaxy.workshop.step') === 'specimen' : saved === 'true';
  });
  const pointers = useRef(new Set<number>());
  const interactionBusy = useRef(false);
  const lastActivity = useRef(0);
  const markActivity = useCallback(() => { lastActivity.current = Date.now(); }, []);
  const [message, setMessage] = useState<keyof typeof text | null>(null);
  const [inventory, setInventory] = useState<(GalaxyObject & { id: string })[]>([]);
  const [inventoryState, setInventoryState] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [restoreAttempt, setRestoreAttempt] = useState(0);
  const [catalog, setCatalog] = useState<RenderObject[]>([]);
  const [editing, setEditing] = useState(false);
  const [editState, setEditState] = useState<'saved' | 'pending' | 'failed' | 'limited' | 'closed'>('saved');
  const [editSaving, setEditSaving] = useState(false);
  const exhaustedDay = useRef('');
  const [rolledNames, setRolledNames] = useState(loadNameHistory);
  const [specimen, setSpecimen] = useState('draft');
  const [departed, setDeparted] = useState<RenderObject[]>([]);
  const sound = useSound(1);
  const [pet, setPet] = useState<{ id: string; at: number }>();
  const updateSound = sound.update;

  useEffect(() => {
    try {
      localStorage.setItem('galaxy.workshop.inspect3D', String(inspect3D));
      localStorage.setItem('galaxy.workshop.step', workshopStep);
      localStorage.setItem('galaxy.workshop.hangar', String(hangarView));
    } catch { /* Storage optional. */ }
  }, [workshopStep, hangarView, inspect3D]);

  useEffect(() => {
    const onSave = () => {
      saveDraft(draft);
      try {
        localStorage.setItem('galaxy.workshop.inspect3D', String(inspect3D));
      localStorage.setItem('galaxy.workshop.step', workshopStep);
        localStorage.setItem('galaxy.workshop.hangar', String(hangarView));
      } catch { /* Storage optional. */ }
    };
    window.addEventListener('galaxy:save-state', onSave);
    window.addEventListener('beforeunload', onSave);
    return () => {
      window.removeEventListener('galaxy:save-state', onSave);
      window.removeEventListener('beforeunload', onSave);
    };
  }, [draft, workshopStep, hangarView, inspect3D]);
  useEffect(() => {
    updateSound([{ id: specimen, type: draft.type ?? 'planet', nameKey: draft.nameKey,
      params: draft.params, orbit: orbitFromVelocity(0, 2.58, 0, 0) }],
      [{ id: specimen, visible: true, distance: 0, focused: true }]);
  }, [draft, specimen, updateSound]);
  function petSpecimen() { setPet({ id: specimen, at: Date.now() }); sound.pet(specimen); }
  const [retry, setRetry] = useState(0);
  const baseline = useRef('');
  const touched = useRef(false);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const start = useRef<{ x: number; y: number; t: number; pointer: number } | null>(null);
  const [trace, setTrace] = useState<[number, number] | null>(null);
  useEffect(() => { saveNameHistory(rolledNames); }, [rolledNames]);
  useEffect(() => {
    saveDraft(draft);
  }, [draft]);
  useEffect(() => {
    let alive = true;
    if (firestore)
      void anonymousUid()
        .then(async (uid) => {
          const all = await ownObjects(firestore!, uid),
            hosts = await availableHosts(firestore!).catch(() => []);
          if (!alive) return;
          setInventory(all);
          setInventoryState('ready');
          setCatalog(hosts);
          const active = all.find((o) => o.status === 'active');
          if (active) {
            setMessage('restored');
            if (!touched.current && savedMode() !== 'design') {
              const saved = loadDraft(),
                next =
                  savedMode() === 'edit' &&
                  savedMode('galaxy.workshop.object') === active.id &&
                  saved.type === active.type
                    ? saved
                    : { type: active.type, nameKey: active.nameKey, params: active.params };
              baseline.current = JSON.stringify({
                type: active.type,
                nameKey: active.nameKey,
                params: active.params,
              });
              setDraft(next);
              setEditing(true);
              setSpecimen(active.id);
              remember('edit', active.id);
            }
          }
        })
        .catch(() => {
          if (alive) setInventoryState('failed');
        });
  return () => {
      alive = false;
    };
  }, [restoreAttempt]);
  useEffect(() => {
    if (
      !editing ||
      !editsOpen ||
      !firestore ||
      busy ||
      editSaving ||
      !live.config.seasonOpen ||
      exhaustedDay.current === utcDay(Date.now()) ||
      editState === 'failed' ||
      JSON.stringify(draft) === baseline.current
    )
      return;
    const timer = window.setTimeout(() => {
      if (lock.current) return;
      lock.current = true;
      setEditState('pending');
      setEditSaving(true);
      void anonymousUid()
        .then((uid) => editObject(firestore!, uid, draft))
        .then(() => {
          baseline.current = JSON.stringify(draft);
          setEditState('saved');
          setInventory((all) =>
            all.map((o) =>
              o.status === 'active' ? { ...o, nameKey: draft.nameKey, params: draft.params } : o,
            ),
          );
        })
        .catch((error) => {
          if (error instanceof LaunchError && error.reason === 'editLimit') {
            exhaustedDay.current = utcDay(Date.now());
            setEditState('limited');
          } else if (error instanceof LaunchError && error.reason === 'cooldown') {
            // A shared-sky gesture may just have used this identity's write clock.
            setEditState('pending');
            setRetry((value) => value + 1);
          } else if (error instanceof LaunchError && error.reason === 'closed') {
            setEditState('closed');
          } else setEditState('failed');
        })
        .finally(() => {
          lock.current = false;
          setEditSaving(false);
        });
    }, 2200);
    return () => window.clearTimeout(timer);
  }, [draft, editing, busy, editSaving, retry, editState, editsOpen, live.config.seasonOpen]);

  const recovery = useRef<(() => void) | undefined>(undefined);
  useEffect(() => {
    const defer = (event: Event) => {
      event.preventDefault(); recovery.current = (event as CustomEvent<() => void>).detail;
    };
    window.addEventListener('galaxy:before-reload', defer);
    return () => window.removeEventListener('galaxy:before-reload', defer);
  }, []);
  useEffect(() => {
    const interval = window.setInterval(() => {
      const idle = Date.now() - lastActivity.current >= 20_000;
      const dirty = editing && JSON.stringify(draft) !== baseline.current;
      if (idle && pointers.current.size === 0 && !start.current && !busy && !lock.current &&
          !interactionBusy.current && !editSaving && !dirty) {
        if (recovery.current) { const resume = recovery.current; recovery.current = undefined; resume(); }
        else if (updateAvailable) reload();
      }
    }, 1000);
    return () => window.clearInterval(interval);
  }, [updateAvailable, busy, editing, editSaving, draft, reload]);
  const restoredView = useRef(false);
  useEffect(() => {
    if (restoredView.current || inventoryState === 'loading') return;
    restoredView.current = true;
    const target = document.getElementById(`workshop-${workshopStep}`);
    if (workshopStep !== 'parameters') { target?.scrollIntoView?.(); target?.focus({ preventScroll: true }); }
  }, [inventoryState, workshopStep]);
  function selectStep(step: string) {
    markActivity(); setWorkshopStep(step); setHangarView(step === 'hangar');
    document.getElementById(`workshop-${step}`)?.scrollIntoView?.({ behavior: 'smooth' });
  }
  async function refresh(uid: string) {
    const all = await ownObjects(firestore!, uid);
    setInventory(all);
    return all;
  }
  async function launch(orbit: Orbit) {
    if (lock.current || !launchesOpen) return;
    if (!navigator.onLine) {
      setMessage('offline');
      return;
    }
    sound.pet(specimen);
    lock.current = true;
    setBusy(true);
    setMessage('launching');
    const timeout = window.setTimeout(() => setMessage('saving'), 8000);
    try {
      if (!firestore) throw new Error('unconfigured');
      const uid = await anonymousUid();
      const hostId =
        draft.type === 'star'
          ? 'central'
          : selectedHost;
      if (!hostId) throw new Error('No eligible host');
      const id = await launchPlanet(firestore, uid, draft, { ...orbit, hostId });
      setDeparted(inventory.filter((o) => o.status === 'active').map((o) => renderObject(o.id, o)));
      setSpecimen(id);
      setEditing(true);
      remember('edit', id);
      baseline.current = JSON.stringify(draft);
      void refresh(uid).catch(() => {});
      setEditState('saved');
      setMessage(orbit.isComet ? 'comet' : 'orbit');

    } catch (error) {
      setMessage(error instanceof LaunchError ? error.reason :
        error && typeof error === 'object' && 'code' in error && error.code === 'permission-denied' ? 'restricted' : 'rejected');
    } finally {
      window.clearTimeout(timeout);
      lock.current = false;
      setBusy(false);
    }
  }
  const kind = draft.type ?? 'planet';
  const p = draft.params as unknown as Record<string, number>;
  const controls =
    kind === 'planet'
      ? ['size', 'oceans', 'mountains', 'clouds', 'rings']
      : kind === 'star'
        ? ['size', 'temperature', 'corona']
        : ['size', 'craters'];
  const eligible = kind === 'moon'
    ? [...catalog.filter((o) => o.unclaimed), ...inventory].filter((o) => o.type === 'planet')
    : catalog.filter((o) => o.type === 'star');
  const hosts = [...new Map(eligible.map((o) => [o.id, o])).values()];
  const selectedHost = draft.hostId ?? (kind === 'moon' ? hosts[0]?.id : leastCrowdedHost(catalog));
  function updateDraft(next: typeof draft) {
    touched.current = true;
    markActivity();
    setWorkshopStep('parameters');
    setEditState((state) => state === 'limited' ? 'limited' : 'pending');
    setRolledNames((keys) => new Set([...keys, draft.nameKey, next.nameKey]));
    setDraft(next);
    sound.pet(specimen);
  }
  function change(field: string, value: number) {
    markActivity();
    setEditState('pending');
    updateDraft({ ...draft, params: { ...draft.params, [field]: value } as ObjectParams });
  }
  const active = inventory.find((o) => o.status === 'active');
  return (
    <section className="workshop" data-workshop-step={workshopStep} data-hangar-view={hangarView}
      onPointerDownCapture={(e) => { pointers.current.add(e.pointerId); markActivity(); }}
      onPointerUpCapture={(e) => { pointers.current.delete(e.pointerId); markActivity(); }}
      onPointerCancelCapture={(e) => { pointers.current.delete(e.pointerId); markActivity(); }}
      onKeyDownCapture={markActivity} onChangeCapture={markActivity} onClickCapture={markActivity}>
      {updateAvailable && (
        <p className="update-notice" role="status">
          {language === 'es' ? 'Nueva versión disponible. Se actualizará en reposo tras guardar tus cambios.' : 'New version available. Updates when idle after your changes are saved.'}
        </p>
      )}
      {active && <a className="memory-return" href={`/galaxy/o/${active.id}?lang=${language}`}>{language === 'es' ? 'Tu página permanente y postal' : 'Your permanent page and postcard'}</a>}
      <div className="workshop-title">
        <p className="eyebrow">{text.desk}</p>
        <h1>{text.create}</h1>
      </div>
      <nav aria-label={language === 'es' ? 'Pasos del taller' : 'Workshop steps'}>
        {(['parameters', 'specimen', 'launch', 'hangar'] as const).filter((step) => step !== 'launch' || !editing).map((step, i) =>
          <button key={step} aria-current={workshopStep === step ? 'step' : undefined} onClick={() => selectStep(step)}>
            {i + 1} / {step === 'parameters' ? rich.material : step === 'specimen' ? text.preview : step === 'launch' ? text.swipe : rich.hangar}
          </button>)}
      </nav>
      <figure id="workshop-specimen" tabIndex={-1} className="planet-specimen" aria-label={objectName(draft.nameKey, language)}>
        {inspect3D ? <ErrorBoundary fallback={<p className="scene-message">{text.unavailable}</p>}>
          <Suspense fallback={<p>{text.loading}</p>}>
            <Preview draft={draft} identity={specimen} departed={departed} pet={pet} onPet={petSpecimen} />
          </Suspense>
        </ErrorBoundary> : <Specimen draft={draft} pet={pet} onPet={petSpecimen} label={language === 'es' ? 'Acariciar tu objeto' : 'Pet your object'} />}
        <figcaption>{editing ? rich.editing : text.preview}</figcaption>
        {!inspect3D && <button onClick={() => { setInspect3D(true); setWorkshopStep('specimen'); markActivity(); }}>{rich.inspect3D}</button>}
      </figure>
      <div className="specimen-sound">
        <button onClick={petSpecimen}>{language === 'es' ? 'Acariciar tu objeto' : 'Pet your object'}</button>
        <SoundControls sound={sound} language={language}/>
      </div>
      <fieldset id="workshop-parameters" tabIndex={-1} disabled={busy || (editing && !editsOpen)} className="planet-controls">
        <legend>{rich.material}</legend>
        <div className="type-choices">
          {(['planet', 'star', 'moon'] as const).map((type) => (
            <button
              key={type}
              disabled={editing}
              aria-pressed={kind === type}
              onClick={() => updateDraft({ ...draft, type, params: presets[type][0], hostId: undefined })}
            >
              {rich[type]}
            </button>
          ))}
        </div>
        <div className="type-choices">
          {presets[kind].map((params, i) => (
            <button key={i} onClick={() => updateDraft({ ...draft, params })}>
              {rich.preset} {i + 1}
            </button>
          ))}
        </div>
        {controls.map((field) => (
          <label key={field}>
            {rich[field as keyof typeof rich]}
            <output>{p[field].toFixed(2)}</output>
            <input
              aria-label={String(rich[field as keyof typeof rich])}
              type="range"
              min={field === 'size' ? 0.2 : 0}
              max={field === 'size' ? 0.7 : 1}
              step=".01"
              value={p[field]}
              onChange={(e) => change(field, Number(e.target.value))}
            />
          </label>
        ))}
        {kind !== 'star' && <p>{kind === 'moon' ? rich.colour : rich.atmosphere}</p>}
        {kind !== 'star' && (
          <div className="surface-choices">
            {palette.map((colour, index) => (
              <button
                key={colour}
                aria-label={`${kind === 'moon' ? rich.colour : rich.atmosphere} ${index + 1}`}
                aria-pressed={p[kind === 'moon' ? 'colour' : 'atmosphere'] === index}
                onClick={() => change(kind === 'moon' ? 'colour' : 'atmosphere', index)}
              >
                <span style={{ background: colour }} />
                <span>{index + 1}</span>
              </button>
            ))}
          </div>
        )}
        <label>
          {text.name}
          <select value={draft.nameKey} onChange={(e) => updateDraft({ ...draft, nameKey: e.target.value })}>
            {[...new Set([...rolledNames, draft.nameKey])].map((key) => (
              <option key={key} value={key}>
                {objectName(key, language)}
              </option>
            ))}
          </select>
        </label>
        <button onClick={() => updateDraft({ ...draft, nameKey: newName() })}>{rich.newName}</button>
        {!editing && kind !== 'star' && (
          <label>
            {rich.host}
            <select
              aria-label={rich.host}
              value={selectedHost ?? ''}
              onChange={(e) => updateDraft({ ...draft, hostId: e.target.value })}
            >
              {kind === 'planet' && <option value="central">{rich.central}</option>}
              {hosts.map((o) => (
                <option value={o.id} key={o.id}>
                  {objectName(o.nameKey, language)}
                </option>
              ))}
            </select>
          </label>
        )}
        {!editing && kind === 'moon' && (
          <p className="notice">
            {rich.moonRule}
            {hosts.length === 0 && <strong> {rich.noHost}</strong>}
          </p>
        )}
        {editing && (
          <>
            <p role="status">
              {editState === 'closed' || !live.config.seasonOpen
                ? text.closed
                : !editsOpen
                  ? (language === 'es' ? 'Ediciones pausadas por el operador.' : 'Edits paused by operator.')
                  : editState === 'saved'
                    ? rich.saved
                    : editState === 'limited'
                      ? text.editLimit
                      : editState === 'failed'
                        ? rich.editFailed
                        : rich.pending}
            </p>
            {editState === 'failed' && (
              <button
                onClick={() => {
                  setEditState('pending');
                  setRetry((r) => r + 1);
                }}
              >
                {text.retry}
              </button>
            )}
            <button
              onClick={() => {
                setEditing(false);
                remember('design');
              }}
            >
              {rich.newObject}
            </button>
          </>
        )}
      </fieldset>
      {!editing && (
        <div id="workshop-launch" tabIndex={-1} className="launch-desk">
          {!launchesOpen && <p role="status">{language === 'es' ? 'Lanzamientos pausados o sin conexión. Tu diseño queda aquí.' : 'Launches paused or disconnected. Your design stays here.'}</p>}
          <p className="eyebrow">{text.swipe}</p>
          <p className="launch-instruction">{text.instruction}</p>
          <div
            className="swipe-window"
            aria-label={text.swipe}
            data-busy={busy}
            onPointerDown={(e) => {
              markActivity();
              setWorkshopStep('launch');
              if (!launchesOpen || (kind === 'moon' && hosts.length === 0) || busy || !e.isPrimary || e.button !== 0) return;
              e.currentTarget.setPointerCapture(e.pointerId);
              start.current = { x: e.clientX, y: e.clientY, t: performance.now(), pointer: e.pointerId };
              setTrace([0, 0]);
            }}
            onPointerMove={(e) => {
              const s = start.current;
              if (s?.pointer === e.pointerId) setTrace([e.clientX - s.x, e.clientY - s.y]);
            }}
            onPointerCancel={() => {
              start.current = null;
              setTrace(null);
            }}
            onPointerUp={(e) => {
              const s = start.current;
              start.current = null;
              setTrace(null);
              if (!s || s.pointer !== e.pointerId || busy) return;
              const dx = e.clientX - s.x,
                dy = e.clientY - s.y;
              if (Math.hypot(dx, dy) < 12) return;
              void launch(orbitFromSwipe(dx, dy, (performance.now() - s.t) / 1000, Date.now()));
            }}
          >
            <svg viewBox="0 0 320 150" aria-hidden="true">
              <path d="M15 75h290M160 15v120" stroke="#60788e" strokeDasharray="3 6" />
              <circle
                cx="160"
                cy="75"
                r="17"
                fill={palette[(draft.params as { palette?: number }).palette ?? 0]}
              />
              {trace && <path d={`M160 75l${trace[0]} ${trace[1]}`} stroke="#5fccf3" strokeWidth="3" />}
            </svg>
          </div>
          <p>{text.hint}</p>
          <button
            disabled={!launchesOpen || busy || (kind === 'moon' && hosts.length === 0)}
            onClick={() =>
              void launch(orbitFromVelocity(0, Math.sqrt(GRAVITY / LAUNCH_RADIUS), 0.08, Date.now()))
            }
          >
            {text.keyboard}
          </button>
        </div>
      )}
      <section id="workshop-hangar" tabIndex={-1} className="hangar" onClick={() => { markActivity(); setWorkshopStep('hangar'); setHangarView(true); }}>
        <p className="eyebrow">03 / {rich.hangar}</p>
        <h2>{rich.kept}</h2>
        {inventoryState === 'loading' ? (
          <p role="status">{text.loading}</p>
        ) : inventoryState === 'failed' ? (
          <p role="status">
            {rich.historyFailed}{' '}
            <button
              onClick={() => {
                setInventoryState('loading');
                setRestoreAttempt((v) => v + 1);
              }}
            >
              {text.retry}
            </button>
          </p>
        ) : inventory.filter((o) => o.status === 'hangar').length === 0 ? (
          <p>{rich.empty}</p>
        ) : (
          <ul>
            {inventory
              .filter((o) => o.status === 'hangar')
              .map((o) => (
                <li key={o.id}>
                  <span>
                    {objectName(o.nameKey, language)} <small>{rich[o.type]}</small>
                  </span>
                  <button
                    disabled={busy || !launchesOpen}
                    onClick={() => {
                      if (!firestore || lock.current || !launchesOpen) return;
                      lock.current = true;
                      setBusy(true);
                      void anonymousUid()
                        .then(async (uid) => {
                          await relaunchObject(firestore!, uid, o.id);
                          setDeparted(
                            inventory.filter((v) => v.status === 'active').map((v) => renderObject(v.id, v)),
                          );
                          setDraft({ type: o.type, nameKey: o.nameKey, params: o.params });
                          baseline.current = JSON.stringify({
                            type: o.type,
                            nameKey: o.nameKey,
                            params: o.params,
                          });
                          setSpecimen(o.id);
                          setEditState('saved');
                          setEditing(true);
                          remember('edit', o.id);
                          setMessage('restored');
                          await refresh(uid);
                        })
                        .catch((error) =>
                          setMessage(error instanceof LaunchError ? error.reason :
        error && typeof error === 'object' && 'code' in error && error.code === 'permission-denied' ? 'restricted' : 'rejected'),
                        )
                        .finally(() => {
                          lock.current = false;
                          setBusy(false);
                        });
                    }}
                  >
                    {rich.relaunch}
                  </button>
                </li>
              ))}
          </ul>
        )}
        <p>{rich.rocks}</p>
        {message && (
          <p role="status" className="launch-feedback">
            {text[message]}
          </p>
        )}
      </section>
      <Suspense fallback={<p>{text.loading}</p>}><Interactions language={language} config={live.config} status={live.status} retry={live.retry} disabled={busy || editSaving} onBusyChange={(value) => { interactionBusy.current = value; markActivity(); }} /></Suspense>
      <SessionLine text={copy[language]} />
    </section>
  );
}

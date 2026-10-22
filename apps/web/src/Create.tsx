import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import {
  nameKeys,
  objectName,
  orbitFromSwipe,
  orbitFromVelocity,
  palette,
  GRAVITY,
  LAUNCH_RADIUS,
  leastCrowdedHost,
  newName,
  presets,
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
  const [draft, setDraft] = useState(loadDraft);
  const [message, setMessage] = useState<keyof typeof text | null>(null);
  const [inventory, setInventory] = useState<(GalaxyObject & { id: string })[]>([]);
  const [inventoryState, setInventoryState] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [restoreAttempt, setRestoreAttempt] = useState(0);
  const [catalog, setCatalog] = useState<RenderObject[]>([]);
  const [editing, setEditing] = useState(false);
  const [editState, setEditState] = useState<'saved' | 'pending' | 'failed'>('saved');
  const [specimen, setSpecimen] = useState('draft');
  const [departed, setDeparted] = useState<RenderObject[]>([]);
  const [retry, setRetry] = useState(0);
  const baseline = useRef('');
  const touched = useRef(false);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const start = useRef<{ x: number; y: number; t: number; pointer: number } | null>(null);
  const [trace, setTrace] = useState<[number, number] | null>(null);
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
      !firestore ||
      busy ||
      editState === 'failed' ||
      JSON.stringify(draft) === baseline.current
    )
      return;
    const timer = window.setTimeout(() => {
      if (lock.current) return;
      lock.current = true;
      setEditState('pending');
      setBusy(true);
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
        .catch(() => setEditState('failed'))
        .finally(() => {
          lock.current = false;
          setBusy(false);
        });
    }, 2200);
    return () => window.clearTimeout(timer);
  }, [draft, editing, busy, retry, editState]);
  async function refresh(uid: string) {
    const all = await ownObjects(firestore!, uid);
    setInventory(all);
    return all;
  }
  async function launch(orbit: Orbit) {
    if (lock.current) return;
    if (!navigator.onLine) {
      setMessage('offline');
      return;
    }
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
          : (draft.hostId ??
            (draft.type === 'moon'
              ? [...inventory, ...catalog.filter((o) => o.unclaimed)].find((o) => o.type === 'planet')?.id
              : leastCrowdedHost(catalog)));
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
  const hosts =
    kind === 'moon'
      ? [...catalog.filter((o) => o.unclaimed), ...inventory.filter((o) => o.type === 'planet')].filter(
          (o, i, all) => o.type === 'planet' && all.findIndex((v) => v.id === o.id) === i,
        )
      : catalog.filter((o) => o.type === 'star');
  function updateDraft(next: typeof draft) {
    touched.current = true;
    setEditState('pending');
    setDraft(next);
  }
  function change(field: string, value: number) {
    setEditState('pending');
    updateDraft({ ...draft, params: { ...draft.params, [field]: value } as ObjectParams });
  }
  return (
    <section className="workshop">
      <div className="workshop-title">
        <p className="eyebrow">{text.desk}</p>
        <h1>{text.create}</h1>
      </div>
      <figure className="planet-specimen" aria-label={objectName(draft.nameKey, language)}>
        <ErrorBoundary fallback={<p className="scene-message">{text.unavailable}</p>}>
          <Suspense fallback={<p>{text.loading}</p>}>
            <Preview draft={draft} identity={specimen} departed={departed} />
          </Suspense>
        </ErrorBoundary>
        <figcaption>{editing ? rich.editing : text.preview}</figcaption>
      </figure>
      <fieldset disabled={busy} className="planet-controls">
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
            {[...new Set([...nameKeys.slice(0, 4), draft.nameKey])].map((key) => (
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
              value={draft.hostId ?? (kind === 'moon' ? (hosts[0]?.id ?? '') : leastCrowdedHost(catalog))}
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
              {editState === 'saved' ? rich.saved : editState === 'failed' ? rich.editFailed : rich.pending}
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
        <div className="launch-desk">
          <p className="eyebrow">{text.swipe}</p>
          <p className="launch-instruction">{text.instruction}</p>
          <div
            className="swipe-window"
            aria-label={text.swipe}
            data-busy={busy}
            onPointerDown={(e) => {
              if ((kind === 'moon' && hosts.length === 0) || busy || !e.isPrimary || e.button !== 0) return;
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
            disabled={busy || (kind === 'moon' && hosts.length === 0)}
            onClick={() =>
              void launch(orbitFromVelocity(0, Math.sqrt(GRAVITY / LAUNCH_RADIUS), 0.08, Date.now()))
            }
          >
            {text.keyboard}
          </button>
        </div>
      )}
      <section className="hangar">
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
                    disabled={busy}
                    onClick={() => {
                      if (!firestore || lock.current) return;
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
      <SessionLine text={copy[language]} />
    </section>
  );
}

import { lazy, Suspense, useState } from 'react';
import type { ComponentType } from 'react';
import ErrorBoundary from './ErrorBoundary';

type SceneProps = { unavailable: string; label: string };
const loadScene = () => import('./Scene');

export default function ReferenceSky({ unavailable, label, loading, retry, load = loadScene }: SceneProps & {
  loading: string;
  retry: string;
  load?: () => Promise<{ default: ComponentType<SceneProps> }>;
}) {
  const [attempt, setAttempt] = useState(0);
  // A new lazy type invokes the loader again; React caches rejections on the old type.
  const [Scene, setScene] = useState(() => lazy(load));
  return (
    <ErrorBoundary key={attempt} fallback={<div className="scene-message" role="status">
      <p>{unavailable}</p>
      <button onClick={() => {
        setScene(() => lazy(load));
        setAttempt((value) => value + 1);
      }}>{retry}</button>
    </div>}>
      <Suspense fallback={<p className="scene-message" role="status">{loading}</p>}>
        <Scene key={label} unavailable={unavailable} label={label} />
      </Suspense>
    </ErrorBoundary>
  );
}

export type ObjectSource = { id: string; data(): unknown };
/** Local fanout: the event archive's materialized objects also feed the portfolio snapshot. */
export function objectFeed() {
  let latest: ObjectSource[] | undefined;
  const listeners = new Set<(docs: ObjectSource[]) => void>();
  return {
    publish(docs: ObjectSource[]) { latest = docs; for (const next of listeners) next(docs); },
    subscribe(next: (docs: ObjectSource[]) => void) {
      listeners.add(next); if (latest) next(latest);
      return () => { listeners.delete(next); };
    },
  };
}

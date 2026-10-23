/** Lazy anonymous UID gate so data helpers stay importable in Node without Vite env. */
export type UidProvider = () => Promise<string>;

let provider: UidProvider | undefined;

/** Test override; production code leaves this unset and loads firebase lazily. */
export function setUidProvider(next: UidProvider | undefined) {
  provider = next;
}

export function waitForAnonymousUid(): Promise<string> {
  if (provider) return provider();
  return import('./firebase').then((m) => m.anonymousUid());
}

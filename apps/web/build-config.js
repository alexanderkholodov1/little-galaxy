export const firebaseEnvKeys = [
  'VITE_FIREBASE_API_KEY', 'VITE_FIREBASE_AUTH_DOMAIN', 'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET', 'VITE_FIREBASE_MESSAGING_SENDER_ID', 'VITE_FIREBASE_APP_ID',
];

// Every Vite build ships deployable assets, including builds using a custom mode.
export function assertProductionEnv(command, mode, env) {
  if (command !== 'build') return;
  if (env.VITE_USE_EMULATORS !== undefined) throw new Error(`Emulators are forbidden in a ${mode} build.`);
  const missing = firebaseEnvKeys.filter((key) => typeof env[key] !== 'string' || !env[key].trim());
  if (missing.length) throw new Error(`Missing Firebase build configuration: ${missing.join(', ')}`);
}

export function createVersionFile(pkg, env, git) {
  let commit = env.GITHUB_SHA || null;
  if (!commit) {
    try { commit = git().trim() || null; } catch { /* Archives may have no git metadata. */ }
  }
  return { version: pkg.version, commit, builtAt: new Date().toISOString() };
}

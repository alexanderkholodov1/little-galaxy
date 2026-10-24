import { spawn } from 'node:child_process';

function runFirebase(project: string, args: string[], failure: string) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn('pnpm', ['exec', 'firebase', ...args, '--project', project, '--non-interactive'],
      { stdio: 'inherit', cwd: new URL('../../../', import.meta.url) });
    child.once('error', () => reject(new Error(failure)));
    child.once('exit', (code) => code === 0 ? resolve() : reject(new Error(failure)));
  });
}

/** Uses the deploy CLI's identity to read the target project's registered apps. */
export function firebasePreflight(project: string) {
  return runFirebase(project, ['apps:list'], 'Firebase CLI preflight failed: cannot authenticate or read the target project; season untouched. See CLI output.');
}

export function firebaseDeploy(project: string) {
  return runFirebase(project, ['deploy', '--only', 'firestore:rules,firestore:indexes'], 'Firestore deployment failed. See CLI output.');
}

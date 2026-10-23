import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { defaultLanguage, supportedLanguages } from '@little-galaxy/shared';

export function startStand(version: string): string {
  // applicationDefault reads the file named by GOOGLE_APPLICATION_CREDENTIALS.
  // Do not accept inline key material, inspect that file, or log SDK errors/credentials.
  if (process.env.FIRESTORE_EMULATOR_HOST) {
    const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
    if (!projectId?.startsWith('demo-')) throw new Error('Emulator stand requires a demo- project ID.');
    initializeApp({ projectId });
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
    if (!projectId) throw new Error('Set FIREBASE_PROJECT_ID before starting the credentialed stand.');
    initializeApp({ credential: applicationDefault(), projectId });
  }
  return `Little Galaxy stand v${version} | languages: ${supportedLanguages.join(', ')} | default: ${defaultLanguage}`;
}

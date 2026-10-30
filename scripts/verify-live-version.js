import { appendFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { validateReleaseTag } from './release-version.js';

export const liveVersionURL = 'https://alexanderkholodov.web.app/little-galaxy/version.json';

export async function waitForLiveVersion(commit, {
  fetchVersion = fetch, sleep = delay, now = Date.now,
  timeoutMs = 480000, intervalMs = 5000, log = console.log,
  tag, versionURL = liveVersionURL, label = 'Production',
} = {}) {
  if (!/^[a-f0-9]{40}$/u.test(commit || '')) throw new Error('A full released commit SHA is required.');
  if (tag) validateReleaseTag(tag);
  const deadline = now() + timeoutMs;
  let last;
  do {
    try {
      const response = await fetchVersion(versionURL + '?released=' + commit + '&t=' + now(), {
        cache: 'no-store', headers: { 'Cache-Control': 'no-cache' },
        signal: AbortSignal.timeout(Math.max(1, Math.min(10000, deadline - now()))),
      });
      if (!response.ok) last = 'HTTP ' + response.status;
      else {
        const metadata = await response.json();
        if (metadata.commit === commit && (!tag || metadata.version === tag.slice(1))) {
          log(label + ' confirms ' + (tag ? tag + ' at ' : 'released commit ') + commit + '.');
          return;
        }
        last = 'served commit ' + String(metadata.commit ?? 'missing') + ', version ' + String(metadata.version ?? 'missing');
      }
    } catch (error) { last = error.message; }
    log('Waiting for ' + label + ': ' + last);
    const remaining = deadline - now();
    if (remaining <= 0) break;
    await sleep(Math.min(intervalMs, remaining));
  } while (now() < deadline);
  throw new Error('RELEASE NOT LIVE: ' + versionURL + ' did not report ' + commit + ' within ' + timeoutMs / 1000 + 's (' + last + '). Inspect the portfolio galaxy-release workflow and re-run the release after recovery.');
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  try {
    if (!process.env.RELEASE_TAG) throw new Error('RELEASE_TAG is required for production release confirmation.');
    await waitForLiveVersion(process.env.RELEASE_COMMIT, { tag: process.env.RELEASE_TAG });
    if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, 'Production confirmed ' + process.env.RELEASE_TAG + ' at commit ' + process.env.RELEASE_COMMIT + '.\n');
  } catch (error) {
    console.error('::error::' + error.message);
    if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, error.message + '\n');
    process.exitCode = 1;
  }
}

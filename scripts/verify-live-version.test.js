import { expect, it, vi } from 'vitest';
import { liveVersionURL, waitForLiveVersion } from './verify-live-version.js';

const commit = 'a'.repeat(40);
function fixture(responses) {
  let time = 0;
  const fetchVersion = vi.fn(async () => {
    const value = responses.shift() ?? { commit: 'old' };
    if (value instanceof Error) throw value;
    return { ok: true, json: async () => value };
  });
  return { fetchVersion, now: () => time, sleep: async ms => { time += ms; },
    timeoutMs: 20, intervalMs: 5, log: vi.fn() };
}
it('retries transport errors, missing metadata and stale commits before confirming the exact release', async () => {
  const options = fixture([new Error('offline'), {}, { commit: 'old' }, { commit }]);
  await expect(waitForLiveVersion(commit, options)).resolves.toBeUndefined();
  expect(options.fetchVersion).toHaveBeenCalledTimes(4);
  expect(options.fetchVersion).toHaveBeenCalledWith(expect.stringContaining(liveVersionURL + '?released=' + commit), expect.objectContaining({ cache: 'no-store', signal: expect.any(AbortSignal) }));
});
it('fails loudly within its deadline if dispatch never reaches production', async () => {
  const options = fixture([]);
  await expect(waitForLiveVersion(commit, options)).rejects.toThrow('RELEASE NOT LIVE:');
  expect(options.fetchVersion).toHaveBeenCalledTimes(4);
});
it('does not accept an HTTP error even if its JSON claims the released commit', async () => {
  const options = fixture([]);
  options.fetchVersion = vi.fn(async () => ({ ok: false, status: 503, json: async () => ({ commit }) }));
  await expect(waitForLiveVersion(commit, options)).rejects.toThrow('HTTP 503');
});
it('rejects a missing or abbreviated release SHA before sending requests', async () => {
  const options = fixture([]);
  await expect(waitForLiveVersion('abc', options)).rejects.toThrow('full released commit');
  expect(options.fetchVersion).not.toHaveBeenCalled();
});
it('requires the stamped release version as well as the exact commit when a tag is supplied', async () => {
  const options = fixture([{ commit, version: '1.0.0-alpha.1' }, { commit, version: '1.0.0-alpha.20' }]);
  await waitForLiveVersion(commit, { ...options, tag: 'v1.0.0-alpha.20' });
  expect(options.fetchVersion).toHaveBeenCalledTimes(2);
});

it('pins the candidate channel metadata before allowing the production gate',async()=>{
 const options=fixture([{commit:'old'},{commit,version:'1.0.0-alpha.20'}]);
 const versionURL='https://alexanderkholodov--release-v1.web.app/little-galaxy/version.json';
 await waitForLiveVersion(commit,{...options,tag:'v1.0.0-alpha.20',versionURL,label:'Release preview'});
 expect(options.fetchVersion.mock.calls.every(([url])=>url.startsWith(versionURL+'?released='))).toBe(true);
});

import {expect,it} from 'vitest';
import {chooseReleaseVersion,compareAlphaTags,validateReleaseTag,versionPrefix} from './release-version.js';
it('allocates the exact requested RC branch version and advances RCs without truncation or collision',()=>{
 const rc='v1.0.0-alpha.10.0-rc1';expect(validateReleaseTag(rc)).toBe(rc);
 expect(versionPrefix(rc+': complete game')).toBe(rc);
 expect(chooseReleaseVersion(['v1.0.0-alpha.9.7'],{branch:rc}).tag).toBe(rc);
 expect(chooseReleaseVersion([rc],{branch:rc}).tag).toBe('v1.0.0-alpha.10.0-rc2');
 expect(compareAlphaTags(rc,'v1.0.0-alpha.9.99')).toBeGreaterThan(0);
 expect(compareAlphaTags(rc,'v1.0.0-alpha.10.0-rc2')).toBeLessThan(0);
});

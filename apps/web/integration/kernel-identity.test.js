// @vitest-environment node
import {expect,it} from 'vitest';
import {PROTOTYPE_KERNEL,SUPERSEDED_KERNELS} from '@little-galaxy/shared';
import {kernelIdentity} from '../../../scripts/kernel-identity.mjs';
it('names the live kernel by its packaged simulation and replay protocol, so physics never changes under an old name',async()=>{
 expect(await kernelIdentity()).toBe(PROTOTYPE_KERNEL);
 expect(SUPERSEDED_KERNELS).not.toContain(PROTOTYPE_KERNEL);
});

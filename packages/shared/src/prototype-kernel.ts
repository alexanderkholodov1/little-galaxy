// The live simulation kernel (scripts/kernel-identity.mjs over the packaged simulation and replay protocol). New
// galaxies are created on it; release provisioning opens a fresh Open Galaxy when the selected one was created on an
// earlier live kernel (apps/stand/src/open-sandbox.ts). A test keeps this identity equal to the packaged files.
export const PROTOTYPE_KERNEL = 'proto4-e1eb32b30021d42b6389a7ae5e422bf47d4493a289d1a032a0b60bcff36e06a5';
// Earlier live kernels. A galaxy created on one keeps its identity and its accepted actions; the current kernel
// re-simulates it from its log, and states stored under the earlier identity are never used or published for it.
export const SUPERSEDED_KERNELS: readonly string[] = ['proto3-0c0adef90be59e2accdde89a69900af00642ff2163ba4d7c2b0b70e826a9f01a'];

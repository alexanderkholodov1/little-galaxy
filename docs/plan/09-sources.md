# Technical sources

These sources support engineering validation, not automatic product decisions. Recheck before
relying on changing limits or APIs. Last consulted during construction planning: 2026-10-09.

- [Firestore quotas](https://firebase.google.com/docs/firestore/quotas): document and free-operation limits.
- [Firestore atomic operations](https://firebase.google.com/docs/firestore/manage-data/transactions): transactions, batches and rules constraints.
- [R3F performance](https://r3f.docs.pmnd.rs/advanced/scaling-performance): detail, resource reuse and adaptive quality.
- [Three.js renderer overview](https://threejs.org/manual/pages/webgpurenderer): material and renderer compatibility.

Validate on target devices: motion permission, audio unlock, file sharing, WebGL recovery and
actual sustained frame times. Validate in the cloud: authorized domains, rules and preview access.
Prior cloud-state claims from October 5 have not been reverified on Hearth.

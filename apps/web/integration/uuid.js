// crypto.randomUUID exists only in secure contexts (HTTPS or localhost). Phones that open the local fair mode over
// http://<LAN IP> lack it, so install a version-4 UUID built from crypto.getRandomValues, which is always available.
const c = globalThis.crypto;
if (c && typeof c.randomUUID !== 'function') {
  c.randomUUID = () => {
    const b = c.getRandomValues(new Uint8Array(16));
    b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
    const h = [...b].map(x => x.toString(16).padStart(2, '0')).join('');
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
  };
}

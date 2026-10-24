/** Stable 16-way partition, mirrored in firestore.rules. UIDs are not public memory. */
export const SKY_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
export function skyBucket(uid: string): string {
  const index = SKY_ALPHABET.indexOf(uid[0]);
  if (index < 0) throw new Error('Unsupported sky owner');
  return (index % 16).toString(16);
}

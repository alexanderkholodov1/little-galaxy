// Mirrors the prototype's rude-word check (apps/web/js/ui/player.js): whole words, compared
// without accents or case. The booth TV shows chosen names, so setName refuses them as well.
const RUDE = [
  'culo', 'culos', 'puta', 'puto', 'putita', 'mierda', 'cabron', 'cabrona', 'pendejo', 'pendeja',
  'gilipollas', 'joder', 'coño', 'cojones', 'verga', 'zorra', 'maricon', 'fuck', 'fucker', 'shit',
  'shitty', 'bitch', 'cunt', 'ass', 'asshole', 'dick', 'cock', 'pussy', 'whore', 'slut', 'nigger',
];
const flat = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase();
const WORDS = new Set(RUDE.map(flat));
export function isRudeName(name: string) {
  return flat(name)
    .split(/[^\p{L}\p{N}]+/u)
    .some((word) => word && WORDS.has(word));
}

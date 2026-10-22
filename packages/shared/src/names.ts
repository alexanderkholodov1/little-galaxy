import type { Language } from './index.js';
// Paired lists: keys survive language changes and never contain visitor text.
export const adjectives = [
  ['Quiet', 'tranquilo'],
  ['Bright', 'brillante'],
  ['Gentle', 'suave'],
  ['Distant', 'lejano'],
  ['Silver', 'plateado'],
  ['Golden', 'dorado'],
  ['Amber', 'ámbar'],
  ['Blue', 'azul'],
  ['Velvet', 'aterciopelado'],
  ['Silent', 'silencioso'],
  ['Little', 'pequeño'],
  ['Ancient', 'antiguo'],
  ['Young', 'joven'],
  ['Warm', 'cálido'],
  ['Cool', 'fresco'],
  ['Clear', 'claro'],
  ['Hidden', 'oculto'],
  ['Soft', 'tenue'],
  ['Swift', 'veloz'],
  ['Patient', 'paciente'],
  ['Calm', 'sereno'],
  ['Wild', 'salvaje'],
  ['Round', 'singular'],
  ['Deep', 'profundo'],
  ['Tender', 'entrañable'],
  ['Radiant', 'radiante'],
  ['Misty', 'brumoso'],
  ['Icy', 'helado'],
  ['Sunny', 'estival'],
  ['Lunar', 'nocturno'],
  ['Stellar', 'estelar'],
  ['Cosmic', 'remoto'],
  ['Violet', 'violeta'],
  ['Copper', 'cobrizo'],
  ['Scarlet', 'escarlata'],
  ['Pale', 'pálido'],
  ['Endless', 'infinito'],
  ['Secret', 'secreto'],
  ['Wandering', 'errante'],
  ['Luminous', 'luminoso'],
] as const;
// Masculine nouns keep the Spanish adjective agreement consistent.
export const nouns = [
  ['Horizon', 'Horizonte'],
  ['Garden', 'Jardín'],
  ['Ocean', 'Océano'],
  ['River', 'Río'],
  ['Valley', 'Valle'],
  ['Comet', 'Cometa'],
  ['Sky', 'Cielo'],
  ['Sun', 'Sol'],
  ['Moonbeam', 'Rayo'],
  ['Meadow', 'Prado'],
  ['Forest', 'Bosque'],
  ['Desert', 'Desierto'],
  ['Mountain', 'Monte'],
  ['Lake', 'Lago'],
  ['Wind', 'Viento'],
  ['Echo', 'Eco'],
  ['Dream', 'Sueño'],
  ['Harbour', 'Puerto'],
  ['Island', 'Islote'],
  ['Crystal', 'Cristal'],
  ['Cloud', 'Nimbo'],
  ['Dawn', 'Amanecer'],
  ['Twilight', 'Crepúsculo'],
  ['Orbit', 'Sendero orbital'],
  ['Spark', 'Destello'],
  ['Pearl', 'Nácar'],
  ['Rainbow', 'Arcoíris'],
  ['Beacon', 'Faro'],
  ['Shelter', 'Refugio'],
  ['Whisper', 'Susurro'],
  ['Voyage', 'Viaje'],
  ['Nest', 'Nido'],
  ['Petal', 'Pétalo'],
  ['Field', 'Campo'],
  ['Shore', 'Litoral'],
  ['Glacier', 'Glaciar'],
  ['Summit', 'Pico'],
  ['Oasis', 'Oasis'],
  ['Portal', 'Portal'],
  ['Universe', 'Universo'],
] as const;
const legacyNames = {
  'quiet-aurora': { en: 'Quiet Aurora', es: 'Aurora tranquila' },
  'bright-tide': { en: 'Bright Tide', es: 'Marea brillante' },
  'gentle-horizon': { en: 'Gentle Horizon', es: 'Horizonte suave' },
  'distant-garden': { en: 'Distant Garden', es: 'Jardín lejano' },
};
export type NameKey = string;
export const names: Record<string, { en: string; es: string }> = { ...legacyNames };
for (let a = 0; a < 40; a++)
  for (let n = 0; n < 40; n++)
    names[`n${String(a).padStart(2, '0')}-${String(n).padStart(2, '0')}`] = {
      en: `${adjectives[a][0]} ${nouns[n][0]}`,
      es: `${nouns[n][1]} ${adjectives[a][1]}`,
    };
export const nameKeys = Object.keys(names);
export function objectName(key: NameKey, language: Language): string {
  return names[key]?.[language] ?? '—';
}
export function newName(random = Math.random): NameKey {
  return nameKeys[4 + Math.min(1599, Math.floor(random() * 1600))];
}

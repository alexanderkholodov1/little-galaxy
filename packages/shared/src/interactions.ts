import type { Language } from './index.js';
export const MAX_INTERACTIONS_PER_DAY = 10;
export const interactionCooldown = { shake: 10_000, comet: 10_000, shootingStar: 20_000 } as const;
export type InteractionType = keyof typeof interactionCooldown;
export const interactionClock = { shake: 'lastShakeAt', comet: 'lastCometAt', shootingStar: 'lastStarAt' } as const;
export const interactionFlag = { shake: 'shake', comet: 'comets', shootingStar: 'shootingStars' } as const;
export const messages = {
  hello: { en: 'Hello, galaxy!', es: '¡Hola, galaxia!' },
  together: { en: 'We shine together!', es: '¡Brillamos juntos!' },
  wonder: { en: 'Keep wondering!', es: '¡Sigue imaginando!' },
  wish: { en: 'Make a wish!', es: '¡Pide un deseo!' },
  orbit: { en: 'See you in orbit!', es: '¡Nos vemos en órbita!' },
  stardust: { en: 'Made of stardust!', es: '¡Hechos de polvo de estrellas!' },
  helloEarth: { en: 'Hello from Earth!', es: '¡Saludos desde la Tierra!' },
  explore: { en: 'Keep exploring!', es: '¡Sigue explorando!' },
  bright: { en: 'A little more light!', es: '¡Un poco más de luz!' },
  beyond: { en: 'To the next horizon!', es: '¡Hasta el próximo horizonte!' },
  dream: { en: 'Dream among the stars!', es: '¡Sueña entre las estrellas!' },
  thanks: { en: 'Thanks for sharing the sky!', es: '¡Gracias por compartir el cielo!' },
} as const;
export type MessageKey = keyof typeof messages;
export const messageKeys = Object.keys(messages) as MessageKey[];
export function messageText(key: MessageKey, language: Language) { return messages[key][language]; }
export function validInteraction(type: InteractionType, payload: Record<string, unknown>): boolean {
  const keys = Object.keys(payload);
  if (type === 'shake') return keys.length === 0;
  if (type === 'shootingStar') return keys.length === 1 && keys[0] === 'messageKey' && typeof payload.messageKey === 'string'
    && Object.hasOwn(messages, payload.messageKey);
  return keys.length === 2 && keys.every((k) => k === 'dx' || k === 'dy') && ['dx', 'dy'].every((k) => typeof payload[k] === 'number'
    && Number.isFinite(payload[k]) && Math.abs(payload[k] as number) <= 1)
    && Math.hypot(payload.dx as number, payload.dy as number) >= .1;
}
export const screenScenes = ['galaxy', 'bigQr', 'spotlight', 'cinematic', 'timelapse'] as const;
export type ScreenScene = typeof screenScenes[number];

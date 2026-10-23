import type { ScreenEvent } from './interaction-data';
export interface SkyEffect { id: string; type: 'wave' | 'comet' | 'shootingStar' | 'meteorShower'; at: number; strength: number; dx: number; dy: number; messageKey?: string }
/** Presentation is bounded independently of event volume; simultaneous crowd shakes share one wave. */
export function addEffects(current: SkyEffect[], events: ScreenEvent[], now: number): SkyEffect[] {
  const result = current.filter((e) => now - e.at < 6000).map((e) => ({ ...e }));
  for (const event of events) {
    if (event.type === 'shake') {
      const wave = result.find((e) => e.type === 'wave' && now - e.at < 1500);
      if (wave) wave.strength = Math.min(20, wave.strength + 1);
      else result.push({ id: event.id, type: 'wave', at: now, strength: 1, dx: 1, dy: 0 });
    } else if (['comet', 'shootingStar', 'meteorShower'].includes(event.type)) {
      result.push({ id: event.id, type: event.type as SkyEffect['type'], at: now, strength: 1,
        dx: event.type === 'comet' ? event.payload.dx as number : .8,
        dy: event.type === 'comet' ? event.payload.dy as number : .35,
        ...(event.type === 'shootingStar' ? { messageKey: event.payload.messageKey as string } : {}) });
    }
  }
  return result.slice(-48);
}

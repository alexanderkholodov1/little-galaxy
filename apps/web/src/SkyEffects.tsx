import { useEffect, useRef } from 'react';
import { messages } from '@little-galaxy/shared';
import type { Language, MessageKey } from '@little-galaxy/shared';
import type { SkyEffect } from './screen-effects';
export default function SkyEffects({ effects, language }: { effects: SkyEffect[]; language: Language }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const element = canvas.current;
    const context = element?.getContext('2d');
    if (!element || !context) return;
    // Bake the dust curtain once; each animation frame composites one texture rather than
    // allocating hundreds of gradients on the booth CPU.
    const curtain = document.createElement('canvas'); curtain.width = 1024; curtain.height = 256;
    const dust = curtain.getContext('2d');
    if (dust) {
      dust.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 120; i++) {
        const u = i / 119, x = u * 1024, y = 128 + Math.sin(u * 8) * 40, radius = 28 + Math.sin(u * Math.PI) * 20;
        const glow = dust.createRadialGradient(x, y, 0, x, y, radius);
        glow.addColorStop(0, 'rgba(95,204,243,.18)'); glow.addColorStop(.4, 'rgba(118,170,145,.12)');
        glow.addColorStop(1, 'rgba(95,204,243,0)');
        dust.fillStyle = glow; dust.fillRect(x - radius, y - radius, radius * 2, radius * 2);
      }
    }
    let frame = 0;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    function draw() {
      const width = element!.clientWidth, height = element!.clientHeight;
      if (element!.width !== width || element!.height !== height) { element!.width = width; element!.height = height; }
      context!.clearRect(0, 0, width, height);
      const now = Date.now();
      for (const effect of effects) {
        const age = (now - effect.at) / 1000;
        if (age < 0 || age > 6) continue;
        if (effect.type === 'wave') {
          const strength = Math.min(4, 1 + Math.log2(effect.strength)), progress = age / 6;
          const depth = height * (.25 + strength * .1);
          const y = (reduced ? .5 : progress * 1.6 - .3) * height;
          context!.globalAlpha = Math.sin(progress * Math.PI) * Math.min(1, .4 + strength * .16);
          context!.drawImage(curtain, 0, y - depth / 2, width, depth);
          context!.globalAlpha = 1;
          continue;
        }
        const count = effect.type === 'meteorShower' ? 12 : 1;
        for (let i = 0; i < count; i++) {
          const progress = (age - i * .16) / 3.4;
          if (progress < 0 || progress > 1) continue;
          const length = Math.hypot(effect.dx, effect.dy) || 1, dx = effect.dx / length, dy = effect.dy / length;
          const span = Math.hypot(width, height), travel = (reduced ? 0 : progress - .5) * span * 1.4;
          const x = width * (.5 + (i % 4 - 1.5) * .12) + dx * travel;
          const y = height * (.5 + (i % 3 - 1) * .15) + dy * travel;
          context!.globalAlpha = Math.sin(progress * Math.PI);
          const tail = Math.min(width * .18, 180);
          const gradient = context!.createLinearGradient(x - dx * tail, y - dy * tail, x, y);
          gradient.addColorStop(0, 'rgba(95,204,243,0)'); gradient.addColorStop(1, '#fff0c3');
          context!.strokeStyle = gradient; context!.lineWidth = effect.type === 'comet' ? 4 : 2;
          context!.beginPath(); context!.moveTo(x - dx * tail, y - dy * tail); context!.lineTo(x, y); context!.stroke();
          context!.fillStyle = '#fff0c3'; context!.beginPath(); context!.arc(x, y, 3, 0, Math.PI * 2); context!.fill();
          context!.globalAlpha = 1;
        }
      }
      frame = requestAnimationFrame(draw);
    }
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [effects]);
  const message = [...effects].reverse().find((e) => e.type === 'shootingStar');
  return <div className="sky-effects" data-effects={effects.map((e) => e.type).join(' ')} data-wave-strength={effects.find((e) => e.type === 'wave')?.strength ?? 0}>
    <canvas ref={canvas} aria-hidden="true"/>
    {message?.messageKey && Object.hasOwn(messages, message.messageKey) && <p className="star-message" role="status" key={message.id}>{messages[message.messageKey as MessageKey][language]}</p>}
  </div>;
}

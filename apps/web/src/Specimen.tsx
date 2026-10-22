import { useEffect, useRef } from 'react';
import { palette, petScale, planetDefaults } from '@little-galaxy/shared';
import type { MoonParams, PlanetParams, StarParams } from '@little-galaxy/shared';
import type { Draft } from './galaxy-data';
/** Immediate observing-log specimen; the full shader inspection is loaded on demand. */
export default function Specimen({ draft, pet, onPet, label }: {
  draft: Draft;
  pet?: { at: number };
  onPet?: () => void;
  label?: string;
}) {
  const shape = useRef<SVGGElement>(null);
  useEffect(() => {
    if (!pet) return;
    let frame = 0;
    const animate = () => {
      const elapsed = (Date.now() - pet.at) / 1000;
      const [x, y] = petScale(elapsed);
      shape.current?.setAttribute('transform', `translate(160 125) scale(${x} ${y}) translate(-160 -125)`);
      if (elapsed <= 1.5) frame = requestAnimationFrame(animate);
    };
    animate();
    return () => cancelAnimationFrame(frame);
  }, [pet]);
  const type = draft.type ?? 'planet';
  const p = type === 'planet' ? planetDefaults(draft.params as PlanetParams) : null;
  const star = type === 'star' ? draft.params as StarParams : null;
  const moon = type === 'moon' ? draft.params as MoonParams : null;
  const r = draft.params.size * 90;
  const colour = star ? `rgb(${255 - star.temperature * 140},${90 + star.temperature * 76},${26 + star.temperature * 229})` : palette[p?.palette ?? moon?.colour ?? 0];
  return <svg className="specimen-drawing" viewBox="0 0 320 250"
    role={onPet ? 'button' : undefined} tabIndex={onPet ? 0 : undefined}
    aria-label={label} aria-hidden={onPet ? undefined : true} onClick={onPet}
    onKeyDown={(event) => {
      if (onPet && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); onPet(); }
    }}>
    <defs>
      <radialGradient id="specimen-light" cx="30%" cy="25%"><stop stopColor="white" stopOpacity=".45"/><stop offset=".6" stopColor={colour}/><stop offset="1" stopColor="#07111f"/></radialGradient>
      <clipPath id="specimen-disc"><circle cx="160" cy="125" r={r}/></clipPath>
    </defs>
    <g ref={shape}>
    {star && <circle cx="160" cy="125" r={r * (1.2 + star.corona * .7)} fill={colour} opacity=".16"/>}
    {p && p.rings > 0 && <ellipse cx="160" cy="125" rx={r * 1.7} ry={r * .55} transform="rotate(-24 160 125)" fill="none" stroke={palette[p.atmosphere]} strokeWidth={r * .23} opacity={p.rings * .7}/>}
    <circle cx="160" cy="125" r={r} fill="url(#specimen-light)"/>
    <g clipPath="url(#specimen-disc)">
      {p && <>
        <path d={`M90 115 Q130 ${90 + p.mountains * 40} 157 126 T225 117 L220 170 Q160 150 95 180Z`} fill="#12567d" opacity={p.oceans}/>
        <path d="M105 105 Q145 82 205 117 M118 140 Q153 125 205 148" fill="none" stroke="#e8f2fa" strokeWidth="9" opacity={p.clouds * .65}/>
      </>}
      {moon && [0,1,2,3,4,5].map((i) => <circle key={i} cx={140 + Math.sin(i * 2.4) * r * .65} cy={115 + Math.cos(i * 2.4) * r * .65} r={r * (.08 + i * .015)} fill="#07111f" opacity={moon.craters * .65}/>)}
    </g>
    {p && p.rings > 0 && <path d={`M${160 - r * 1.55} ${125 + r * .68} Q${160 + r * .7} ${125 + r * .35} ${160 + r * 1.55} ${125 - r * .68}`} fill="none" stroke={palette[p.atmosphere]} strokeWidth={r * .21} opacity={p.rings * .8}/>}
    </g>
  </svg>;
}

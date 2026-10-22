import { useEffect, useMemo, useRef } from 'react';
import { cometTailPosition } from './comet-tail';
import { useFrame } from '@react-three/fiber';
import { Color, DynamicDrawUsage, InstancedBufferAttribute, Object3D, ShaderMaterial, Vector3 } from 'three';
import type { InstancedMesh } from 'three';
import { palette, planetDefaults, starPosition, worldPosition } from '@little-galaxy/shared';
import type { MoonParams, PlanetParams, RenderObject, StarParams } from '@little-galaxy/shared';
const vertex = `
uniform float cheap; uniform vec3 starPositions[32]; uniform vec3 starColours[32]; attribute float lightIndex;
attribute vec4 surface; attribute vec4 detail; attribute vec3 tint; attribute vec3 lamp; attribute vec3 lampColour;
varying vec3 vNormal; varying vec3 vLocal; varying vec3 vWorld; varying vec4 vSurface; varying vec4 vDetail; varying vec3 vTint; varying vec3 vLamp; varying vec3 vLampColour;
void main(){ float relief=surface.x<.5 && cheap<.5?sin(position.x*18.)*sin(position.y*21.)*sin(position.z*15.)*surface.z*.035:0.;vec4 world=modelMatrix*instanceMatrix*vec4(position*(1.+relief),1.); vNormal=normalize(mat3(modelMatrix*instanceMatrix)*normal); vLocal=position; vWorld=world.xyz; vSurface=surface; vDetail=detail; vTint=tint;vLamp=lightIndex>=0.?starPositions[int(lightIndex)]:lamp;vLampColour=lightIndex>=0.?starColours[int(lightIndex)]:lampColour;gl_Position=projectionMatrix*viewMatrix*world; }`;
const fragment = `
precision highp float;
uniform float clock; uniform float cheap; uniform float layer; uniform vec3 centralLight; uniform float lightStrength;
varying vec3 vNormal; varying vec3 vLocal; varying vec3 vWorld; varying vec4 vSurface; varying vec4 vDetail; varying vec3 vTint; varying vec3 vLamp; varying vec3 vLampColour;
float hash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
void main(){
 vec3 n=normalize(vNormal), view=normalize(cameraPosition-vWorld); float rim=pow(1.-abs(dot(n,view)),3.);
 float terrain=noise(vLocal*4.); if(cheap<.5) terrain+=noise(vLocal*13.)*.23;
 vec3 base=vTint;float alpha=1.;
 if(vSurface.x>.5 && vSurface.x<1.5){ float heat=vSurface.y; base=mix(vec3(1.,.25,.07),vec3(.35,.65,1.),heat)*(1.1+terrain*.5); }
 else if(vSurface.x>1.5){float crater=smoothstep(.32,.38,abs(sin(terrain*37.)));base*=mix(.9,.35+crater*.65,vSurface.y);}
 else {float land=smoothstep(vSurface.y-.03,vSurface.y+.03,terrain);base=mix(vec3(.025,.17,.36),vTint,land);base+=pow(terrain,4.)*vSurface.z*.7;
 float clouds=smoothstep(1.-vSurface.w*.55,1.,noise(vLocal*7.+vec3(clock*.035,0,0)));base=mix(base,vec3(.9),clouds*.8);}
 if(vSurface.x<.5 || vSurface.x>1.5){float sun=max(0.,dot(n,normalize(centralLight-vWorld)));float nearby=max(0.,dot(n,normalize(vLamp-vWorld)))/(1.+length(vLamp-vWorld)*.09);base*=.16+sun*.5;base+=vLampColour*nearby*lightStrength; vec3 air=vDetail.x<1.5?vec3(.25,.65,1.):vDetail.x<2.5?vec3(1.,.65,.25):vDetail.x<3.5?vec3(.35,1.,.65):vec3(.75,.5,1.);base+=air*rim*.65;}
 if(layer>.5 && layer<1.5){alpha=vDetail.y*(.3+.3*sin(length(vLocal.xy)*110.));base=vTint*.8;}
 if(layer>1.5 && layer<2.5){alpha=pow(rim,2.)*vDetail.z*.22;base=vTint;}
 if(layer>2.5){alpha=vDetail.w;base=vTint*(.45+terrain*.5);}
 gl_FragColor=vec4(base,alpha);
}`;
function temperature(t: number) {
  return new Color().setRGB(1 - t * 0.55, 0.35 + t * 0.3, 0.1 + t * 0.9);
}
interface Rock {
  object: RenderObject;
  at: number;
  position: [number, number, number];
}
/** Shared programs and two sphere geometries; no per-object React meshes or orbit polylines. */
export default function RichBodies({
  objects,
  preview = false,
  departed,
}: {
  objects: RenderObject[];
  preview?: boolean;
  departed?: RenderObject[];
}) {
  const near = useRef<InstancedMesh>(null),
    far = useRef<InstancedMesh>(null),
    rings = useRef<InstancedMesh>(null),
    corona = useRef<InstancedMesh>(null),
    debris = useRef<InstancedMesh>(null);
  const previous = useRef<RenderObject[]>([]),
    rocks = useRef<Rock[]>([]),
    births = useRef(new Map<string, number>());
  useEffect(() => {
    const now = Date.now(),
      ids = new Set(objects.map((o) => o.id));
    for (const o of previous.current)
      if (!preview && !ids.has(o.id))
        rocks.current.push({ object: o, at: now, position: preview ? [0, 0, 0] : worldPosition(o, now) });
    for (const o of objects) if (!previous.current.some((p) => p.id === o.id)) births.current.set(o.id, now);
    rocks.current = rocks.current.filter((r) => now - r.at < 120000 && !ids.has(r.object.id)).slice(-500);
    previous.current = objects;
  }, [objects, preview]);
  useEffect(() => {
    if (departed)
      for (const object of departed) rocks.current.push({ object, at: Date.now(), position: [0, 0, 0] });
  }, [departed]);
  const materials = useMemo(
    () =>
      [0, 0, 1, 2, 3].map(
        (layer, i) =>
          new ShaderMaterial({
            vertexShader: vertex,
            fragmentShader: fragment,
            uniforms: {
              starPositions: { value: Array.from({ length: 32 }, () => new Vector3()) },
              starColours: { value: Array.from({ length: 32 }, () => new Vector3(1, 1, 1)) },
              clock: { value: 0 },
              cheap: { value: i === 1 ? 1 : 0 },
              layer: { value: layer },
              centralLight: { value: new Vector3(preview ? -3 : 0, preview ? 4 : 0, preview ? 5 : 0) },
              lightStrength: { value: 0.55 },
            },
            transparent: layer > 0,
            depthWrite: layer === 0,
          }),
      ),
    [preview],
  );
  useEffect(() => () => materials.forEach((m) => m.dispose()), [materials]);
  const scratch = useMemo(() => new Object3D(), []);
  useEffect(() => {
    for (const ref of [near, far, rings, corona, debris])
      if (ref.current) {
        ref.current.instanceMatrix.setUsage(DynamicDrawUsage);
        for (const [name, width] of [
          ['surface', 4],
          ['detail', 4],
          ['tint', 3],
          ['lamp', 3],
          ['lampColour', 3],
          ['lightIndex', 1],
        ] as const)
          ref.current.geometry.setAttribute(
            name,
            new InstancedBufferAttribute(new Float32Array(8000 * width), width).setUsage(DynamicDrawUsage),
          );
      }
  }, []);
  useFrame(({ camera, clock }) => {
    const now = Date.now(),
      counts = [0, 0, 0, 0, 0],
      meshes = [near.current, far.current, rings.current, corona.current, debris.current];
    if (meshes.some((m) => !m)) return;
    const stars = objects.filter((o) => o.type === 'star');
    for (const material of materials) {
      material.uniforms.starPositions.value[0].set(preview ? -3 : 0, preview ? 4 : 0, preview ? 5 : 0);
      material.uniforms.starColours.value[0].set(1, 0.94, 0.76);
      stars.slice(0, 31).forEach((star, i) => {
        material.uniforms.starPositions.value[i + 1].set(...starPosition(star.id));
        const c = temperature((star.params as StarParams).temperature);
        material.uniforms.starColours.value[i + 1].set(c.r, c.g, c.b);
      });
    }
    function put(
      group: number,
      position: number[],
      scale: number,
      s: number[],
      d: number[],
      c: Color,
      light: number[],
      lc: Color,
      rotation = 0,
      lightIndex = 0,
    ) {
      const mesh = meshes[group]!,
        index = counts[group];
      if (index >= 8000) return;
      counts[group]++;
      scratch.position.set(position[0], position[1], position[2]);
      scratch.scale.setScalar(scale);
      scratch.rotation.set(0.15, 0, rotation);
      scratch.updateMatrix();
      mesh.setMatrixAt(index, scratch.matrix);
      for (const [name, values] of [
        ['surface', s],
        ['detail', d],
        ['tint', c.toArray()],
        ['lamp', light],
        ['lampColour', lc.toArray()],
        ['lightIndex', [lightIndex]],
      ] as const) {
        const a = mesh.geometry.getAttribute(name) as InstancedBufferAttribute;
        a.array.set(values, index * a.itemSize);
      }
    }
    for (const o of objects) {
      const pos = preview ? [0, 0, 0] : worldPosition(o, now),
        type = o.type ?? 'planet';
      const p = o.params,
        planet = type === 'planet' ? planetDefaults(p as PlanetParams) : null,
        star = type === 'star' ? (p as StarParams) : null,
        moon = type === 'moon' ? (p as MoonParams) : null;
      const colour = star
        ? temperature(star.temperature)
        : new Color(palette[planet?.palette ?? moon?.colour ?? 0]);
      const s = [
        star ? 1 : moon ? 2 : 0,
        star?.temperature ?? moon?.craters ?? planet?.oceans ?? 0,
        planet?.mountains ?? 0,
        planet?.clouds ?? 0,
      ];
      const d = [planet ? planet.atmosphere + 1 : 0, planet?.rings ?? 0, star?.corona ?? 0, 1];
      let light: [number, number, number] = preview ? [-3, 4, 5] : [0, 0, 0],
        lc = new Color('#fff0c3'),
        dist = Infinity,
        lightIndex = 0;
      for (const host of stars) {
        const hp = starPosition(host.id),
          r = Math.hypot(...hp.map((v, i) => v - pos[i]));
        if (r < dist && host.id !== o.id) {
          dist = r;
          light = hp;
          lc = temperature((host.params as StarParams).temperature);
          const index = stars.indexOf(host);
          lightIndex = index < 31 ? index + 1 : -1;
        }
      }
      const age = (now - (births.current.get(o.id) ?? now)) / 1000,
        assembly = Math.min(1, 0.1 + age / 1.2),
        radius = p.size * (preview ? 3 : 1) * assembly;
      if (age < 1.2) {
        for (let i = 0; i < 12; i++) {
          const angle = i * 2.399,
            spread = (1 - age / 1.2) * (preview ? 2 : 1);
          put(
            4,
            [
              pos[0] + Math.cos(angle) * spread,
              pos[1] + Math.sin(angle) * spread,
              pos[2] + Math.sin(i) * spread * 0.5,
            ],
            p.size * 0.16,
            [2, 0.5, 0, 0],
            [0, 0, 0, 1 - age / 1.2],
            colour,
            light,
            lc,
          );
        }
      }
      const group = preview || camera.position.distanceTo(new Vector3(...pos)) < 28 ? 0 : 1;
      put(group, pos, radius, s, d, colour, light, lc, clock.elapsedTime * 0.04, lightIndex);
      if (planet?.rings) put(2, pos, radius * 1.9, s, d, new Color(palette[planet.atmosphere]), light, lc);
      if (o.orbit.isComet && !preview) {
        for (let i = 1; i <= 3; i++)
          put(
            3,
            cometTailPosition(o, now, radius * i * 0.8),
            radius * (1 - i * 0.16),
            s,
            [0, 0, 0.45, 1],
            new Color('#d5b675'),
            light,
            lc,
          );
      }
      if (star?.corona) put(3, pos, radius * (1.2 + star.corona * 0.7), s, d, colour, light, lc);
    }
    rocks.current = rocks.current.filter((r) => now - r.at < 120000);
    for (const r of rocks.current) {
      const age = (now - r.at) / 1000,
        fade = 1 - age / 120,
        colour = new Color('#a49b87');
      for (let i = 0; i < 12; i++) {
        const angle = i * 2.399,
          spread = Math.min(1, age / 1.2) * (preview ? 2 : 1);
        put(
          4,
          [
            r.position[0] + Math.cos(angle) * spread,
            r.position[1] + Math.sin(angle) * spread,
            r.position[2] + Math.sin(i) * spread * 0.5,
          ],
          r.object.params.size * 0.18,
          [2, 0.5, 0, 0],
          [0, 0, 0, fade],
          colour,
          [0, 0, 0],
          colour,
          angle + age * 0.1,
        );
      }
    }
    meshes.forEach((mesh, i) => {
      if (!mesh) return;
      mesh.count = counts[i];
      mesh.instanceMatrix.needsUpdate = true;
      for (const name of ['surface', 'detail', 'tint', 'lamp', 'lampColour', 'lightIndex'])
        (mesh.geometry.getAttribute(name) as InstancedBufferAttribute).needsUpdate = true;
      materials[i].uniforms.clock.value = clock.elapsedTime;
    });
  });
  return (
    <>
      <instancedMesh
        ref={near}
        args={[undefined, undefined, 8000]}
        material={materials[0]}
        frustumCulled={false}
      >
        <sphereGeometry args={[1, 24, 16]} />
      </instancedMesh>
      <instancedMesh
        ref={far}
        args={[undefined, undefined, 8000]}
        material={materials[1]}
        frustumCulled={false}
      >
        <sphereGeometry args={[1, 8, 6]} />
      </instancedMesh>
      <instancedMesh
        ref={rings}
        args={[undefined, undefined, 8000]}
        material={materials[2]}
        frustumCulled={false}
      >
        <ringGeometry args={[0.65, 1, 48]} />
      </instancedMesh>
      <instancedMesh
        ref={corona}
        args={[undefined, undefined, 8000]}
        material={materials[3]}
        frustumCulled={false}
      >
        <sphereGeometry args={[1, 16, 12]} />
      </instancedMesh>
      <instancedMesh
        ref={debris}
        args={[undefined, undefined, 8000]}
        material={materials[4]}
        frustumCulled={false}
      >
        <icosahedronGeometry args={[1, 0]} />
      </instancedMesh>
    </>
  );
}

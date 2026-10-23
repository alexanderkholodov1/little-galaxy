import { useEffect, useMemo, useRef } from 'react';
import { BodyHistory, StarIndex, markLiveRange, RING_TILT } from './rich-runtime';
import { useFrame } from '@react-three/fiber';
import { Color, DynamicDrawUsage, InstancedBufferAttribute, DoubleSide, FrontSide, Object3D, ShaderMaterial, Vector3 } from 'three';
import type { InstancedMesh } from 'three';
import { palette, petScale, planetDefaults, positionAt, starPosition, worldPosition } from '@little-galaxy/shared';
import type { MoonParams, PlanetParams, RenderObject, StarParams } from '@little-galaxy/shared';
const vertex = `
uniform float cheap;
attribute vec4 surface; attribute vec4 detail; attribute vec3 tint; attribute vec3 lamp; attribute vec3 lampColour;
varying vec3 vNormal; varying vec3 vLocal; varying vec3 vWorld; varying vec4 vSurface; varying vec4 vDetail; varying vec3 vTint; varying vec3 vLamp; varying vec3 vLampColour;
void main(){ float relief=surface.x<.5 && cheap<.5?sin(position.x*18.)*sin(position.y*21.)*sin(position.z*15.)*surface.z*.035:0.;vec4 world=modelMatrix*instanceMatrix*vec4(position*(1.+relief),1.); vNormal=normalize(mat3(modelMatrix*instanceMatrix)*normal); vLocal=position; vWorld=world.xyz; vSurface=surface; vDetail=detail; vTint=tint;vLamp=lamp;vLampColour=lampColour;gl_Position=projectionMatrix*viewMatrix*world; }`;
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
type Point = [number, number, number];
function temperature(t: number): Point { return [1 - t * .55, .35 + t * .3, .1 + t * .9]; }
function body(o: RenderObject) {
  const type = o.type ?? 'planet';
  const planet = type === 'planet' ? planetDefaults(o.params as PlanetParams) : null;
  const star = type === 'star' ? o.params as StarParams : null;
  const moon = type === 'moon' ? o.params as MoonParams : null;
  const colour = new Color(palette[planet?.palette ?? moon?.colour ?? 0]);
  return {
    object: o, planet, star,
    position: [0, 0, 0] as Point,
    origin: starPosition(type === 'star' ? o.id : o.hostOrbit?.hostId ?? o.orbit.hostId),
    colour: star ? temperature(star.temperature) : colour.toArray() as Point,
    ringColour: new Color(palette[planet?.atmosphere ?? 0]).toArray() as Point,
    surface: [star ? 1 : moon ? 2 : 0, star?.temperature ?? moon?.craters ?? planet?.oceans ?? 0, planet?.mountains ?? 0, planet?.clouds ?? 0],
    detail: [planet ? planet.atmosphere + 1 : 0, planet?.rings ?? 0, star?.corona ?? 0, 1],
  };
}
function placeBody(b: ReturnType<typeof body>, preview: boolean, now: number, scratch: Point) {
  const o = b.object, pos = b.position;
  if (preview) { pos[0] = 0; pos[1] = 0; pos[2] = 0; }
  else if (b.star) { pos[0] = b.origin[0]; pos[1] = b.origin[1]; pos[2] = b.origin[2]; }
  else {
    positionAt(o.orbit, now, pos);
    if (o.hostOrbit) positionAt(o.hostOrbit, now, scratch);
    for (let i = 0; i < 3; i++) pos[i] = b.origin[i] + (o.hostOrbit ? scratch[i] + pos[i] * .2 : pos[i]);
  }
}
type Body = ReturnType<typeof body>;
interface Rock { body: Body; at: number; position: Point }
const attributes = [['surface', 4], ['detail', 4], ['tint', 3], ['lamp', 3], ['lampColour', 3]] as const;
const zero: Point = [0, 0, 0], central: Point = [1, .94, .76], rockColour: Point = [.37, .33, .25], tailColour: Point = [.67, .47, .18];
const fragmentSurface = [2, .5, 0, 0], fragmentDetail = [0, 0, 0, 1], tailDetail = [0, 0, .45, 1];
const angles = Array.from({ length: 12 }, (_, i) => ({ x: Math.cos(i * 2.399), y: Math.sin(i * 2.399), z: Math.sin(i) * .5, rotation: i * 2.399 }));
/** Five shared instance batches with pooled frame state and bounded uploads. */
export default function RichBodies({
  objects,
  preview = false,
  departed,
  pet,
  onPick,
  historicalAt, births,
}: {
  objects: RenderObject[];
  historicalAt?: number;
  births?: Map<string, number>;
  preview?: boolean;
  departed?: RenderObject[];
  pet?: { id: string; at: number };
  onPick?: (id: string) => void;
}) {
  const near = useRef<InstancedMesh>(null),
    far = useRef<InstancedMesh>(null),
    rings = useRef<InstancedMesh>(null),
    corona = useRef<InstancedMesh>(null),
    debris = useRef<InstancedMesh>(null);
  const instanceIds = useRef<string[][]>([[], [], [], [], []]);
  const history = useRef(new BodyHistory()), rocks = useRef<Rock[]>([]);
  const bodies = useMemo(() => objects.map(body), [objects]);
  const stars = useMemo(() => new StarIndex(bodies.filter((b) => b.star).map((b) => ({ id: b.object.id, position: b.origin, colour: b.colour }))), [bodies]);
  useEffect(() => {
    if (historicalAt !== undefined) return;
    const now = Date.now(), ids = new Set(objects.map((o) => o.id));
    const removed = history.current.diff(objects, now);
    if (!preview) for (const o of removed) rocks.current.push({ body: body(o), at: now, position: worldPosition(o, now) });
    rocks.current = rocks.current.filter((r) => now - r.at < 120000 && !ids.has(r.body.object.id)).slice(-500);
  }, [objects, preview, historicalAt]);
  useEffect(() => {
    if (historicalAt !== undefined) rocks.current = [];
    if (departed) for (const object of departed) rocks.current.push({ body: body(object), at: historicalAt !== undefined ? object.updatedAt ?? historicalAt : Date.now(), position: historicalAt !== undefined ? worldPosition(object, object.updatedAt ?? historicalAt) : [0, 0, 0] });
  }, [departed, historicalAt]);
  const materials = useMemo(
    () =>
      [0, 0, 1, 2, 3].map(
        (layer, i) =>
          new ShaderMaterial({
            vertexShader: vertex,
            fragmentShader: fragment,
            uniforms: {
              clock: { value: 0 },
              cheap: { value: i === 1 ? 1 : 0 },
              layer: { value: layer },
              centralLight: { value: new Vector3(preview ? -3 : 0, preview ? 4 : 0, preview ? 5 : 0) },
              lightStrength: { value: 0.55 },
            },
            side: layer === 1 ? DoubleSide : FrontSide,
            transparent: layer > 0,
            depthWrite: layer === 0,
          }),
      ),
    [preview],
  );
  useEffect(() => () => materials.forEach((m) => m.dispose()), [materials]);
  const poolRef = useRef<{
    currentId: string; petId?: string; stretch: Point;
    scratch: Object3D; parent: Point; fragment: Point; counts: Uint16Array; meshes: InstancedMesh[];
    ranges: { start: number; count: number }[][];
  } | null>(null);
  const materialsRef = useRef(materials);
  useEffect(() => { materialsRef.current = materials; }, [materials]);
  useEffect(() => {
    const pool = poolRef.current ??= {
      currentId: '', stretch: [1, 1, 1], scratch: new Object3D(), parent: [0, 0, 0], fragment: [0, 0, 0],
      counts: new Uint16Array(5), meshes: [],
      ranges: Array.from({ length: 5 }, () => Array.from({ length: 6 }, () => ({ start: 0, count: 0 }))),
    };
    pool.meshes = [near.current!, far.current!, rings.current!, corona.current!, debris.current!];
    for (const mesh of pool.meshes) {
      mesh.count = 0;
      mesh.instanceMatrix.setUsage(DynamicDrawUsage);
      for (const [name, width] of attributes) mesh.geometry.setAttribute(name, new InstancedBufferAttribute(new Float32Array(8000 * width), width).setUsage(DynamicDrawUsage));
    }
  }, []);
  const put = useMemo(() => (group: number, pos: Point, scale: number, s: number[], d: number[], colour: Point, light: Point, lc: Point, rotation = 0, alpha = 1) => {
    const pool = poolRef.current;
    if (!pool) return;
    const index = pool.counts[group], mesh = pool.meshes[group];
    if (index >= 8000 || !mesh) return;
    pool.counts[group]++;
    instanceIds.current[group][index] = pool.currentId;
    const scratch = pool.scratch;
    scratch.position.set(pos[0], pos[1], pos[2]); scratch.scale.setScalar(scale);
    if (pool.currentId && pool.currentId === pool.petId) scratch.scale.set(scale * pool.stretch[0], scale * pool.stretch[1], scale * pool.stretch[2]);
    scratch.rotation.set(group === 2 ? RING_TILT : .15, 0, group === 2 ? .38 : rotation);
    scratch.updateMatrix(); mesh.setMatrixAt(index, scratch.matrix);
    (mesh.geometry.getAttribute('surface') as InstancedBufferAttribute).setXYZW(index, s[0], s[1], s[2], s[3]);
    (mesh.geometry.getAttribute('detail') as InstancedBufferAttribute).setXYZW(index, d[0], d[1], d[2], alpha);
    (mesh.geometry.getAttribute('tint') as InstancedBufferAttribute).setXYZ(index, colour[0], colour[1], colour[2]);
    (mesh.geometry.getAttribute('lamp') as InstancedBufferAttribute).setXYZ(index, light[0], light[1], light[2]);
    (mesh.geometry.getAttribute('lampColour') as InstancedBufferAttribute).setXYZ(index, lc[0], lc[1], lc[2]);
  }, []);
  useFrame(({ camera, clock }) => {
    const pool = poolRef.current, materials = materialsRef.current;
    if (!pool) return;
    const now = historicalAt ?? Date.now();
    pool.counts.fill(0);
    pool.petId = pet?.id;
    if (pet) petScale((now - pet.at) / 1000, pool.stretch);
    if (!pool.meshes.length) return;
    history.current.prune(now);
    for (const b of bodies) {
      const o = b.object, pos = b.position;
      pool.currentId = o.id;
      placeBody(b, preview, now, pool.parent);
      const lamp = stars.nearest(pos, o.id), light = lamp?.position ?? (preview ? materials[0].uniforms.centralLight.value.toArray(pool.parent) : zero), lc = lamp?.colour ?? central;
      const birth = historicalAt !== undefined ? births?.get(o.id) : history.current.births.get(o.id), age = birth === undefined ? 2 : (now - birth) / 1000;
      const radius = o.params.size * (preview ? 3 : 1) * Math.min(1, .1 + age / 1.2);
      if (age < 1.2) for (const a of angles) {
        const spread = (1 - age / 1.2) * (preview ? 2 : 1);
        pool.fragment[0] = pos[0] + a.x * spread; pool.fragment[1] = pos[1] + a.y * spread; pool.fragment[2] = pos[2] + a.z * spread;
        put(4, pool.fragment, o.params.size * .16, fragmentSurface, fragmentDetail, b.colour, light, lc, 0, 1 - age / 1.2);
      }
      const distance = (camera.position.x - pos[0]) ** 2 + (camera.position.y - pos[1]) ** 2 + (camera.position.z - pos[2]) ** 2;
      put(preview || distance < 784 ? 0 : 1, pos, radius, b.surface, b.detail, b.colour, light, lc, (historicalAt !== undefined ? now / 1000 : clock.elapsedTime) * .04);
      if (b.planet?.rings) put(2, pos, radius * 1.9, b.surface, b.detail, b.ringColour, light, lc);
      if (o.orbit.isComet && !preview) {
        const dx = pos[0] - b.origin[0], dy = pos[1] - b.origin[1], dz = pos[2] - b.origin[2], length = Math.hypot(dx, dy, dz) || 1;
        for (let i = 1; i <= 3; i++) {
          const d = radius * i * .8 / length;
          pool.fragment[0] = pos[0] + dx * d; pool.fragment[1] = pos[1] + dy * d; pool.fragment[2] = pos[2] + dz * d;
          put(3, pool.fragment, radius * (1 - i * .16), b.surface, tailDetail, tailColour, light, lc);
        }
      }
      if (b.star?.corona) put(3, pos, radius * (1.2 + b.star.corona * .7), b.surface, b.detail, b.colour, light, lc);
    }
    pool.currentId = '';
    // Compact in place; no filter/temporary arrays in the frame loop.
    let live = 0;
    for (const r of rocks.current) {
      if (now - r.at >= 120000) continue;
      rocks.current[live++] = r;
      const age = (now - r.at) / 1000, spread = Math.min(1, age / 1.2) * (preview ? 2 : 1);
      for (const a of angles) {
        pool.fragment[0] = r.position[0] + a.x * spread; pool.fragment[1] = r.position[1] + a.y * spread; pool.fragment[2] = r.position[2] + a.z * spread;
        put(4, pool.fragment, r.body.object.params.size * .18, fragmentSurface, fragmentDetail, rockColour, zero, rockColour, a.rotation + age * .1, 1 - age / 120);
      }
    }
    rocks.current.length = live;
    for (let i = 0; i < pool.meshes.length; i++) {
      const mesh = pool.meshes[i], count = pool.counts[i];
      mesh.count = count;
      markLiveRange(mesh.instanceMatrix, count, pool.ranges[i][0]);
      for (let j = 0; j < attributes.length; j++) markLiveRange(mesh.geometry.getAttribute(attributes[j][0]), count, pool.ranges[i][j + 1]);
      materials[i].uniforms.clock.value = historicalAt !== undefined ? now / 1000 : clock.elapsedTime;
    }
  });
  return (
    <>
      <instancedMesh
        onClick={(event) => {
          const id = instanceIds.current[0][event.instanceId ?? -1];
          if (id && onPick) { event.stopPropagation(); onPick(id); }
        }}
        ref={near}
        args={[undefined, undefined, 8000]}
        material={materials[0]}
        frustumCulled={false}
      >
        <sphereGeometry args={[1, 24, 16]} />
      </instancedMesh>
      <instancedMesh
        onClick={(event) => {
          const id = instanceIds.current[1][event.instanceId ?? -1];
          if (id && onPick) { event.stopPropagation(); onPick(id); }
        }}
        ref={far}
        args={[undefined, undefined, 8000]}
        material={materials[1]}
        frustumCulled={false}
      >
        <sphereGeometry args={[1, 8, 6]} />
      </instancedMesh>
      <instancedMesh
        onClick={(event) => {
          const id = instanceIds.current[2][event.instanceId ?? -1];
          if (id && onPick) { event.stopPropagation(); onPick(id); }
        }}
        ref={rings}
        args={[undefined, undefined, 8000]}
        material={materials[2]}
        frustumCulled={false}
      >
        <ringGeometry args={[0.65, 1, 48]} />
      </instancedMesh>
      <instancedMesh
        onClick={(event) => {
          const id = instanceIds.current[3][event.instanceId ?? -1];
          if (id && onPick) { event.stopPropagation(); onPick(id); }
        }}
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

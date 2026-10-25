// bodies.js — los astros. Arcilla blanda iluminada por una fogata: cálida del lado del fuego,
// celeste del lado de la noche, con un borde de luz suave. Todo procedural, sin modelos.
// La superficie es de verdad 3D: montañas, cráteres y bultos desplazan la malla (se ven en la
// silueta) y además doblan la luz (relieve por derivadas, una sola evaluación por píxel).
import * as THREE from 'three';

const TAU = Math.PI * 2;
export const GALAXY_SCALE = 0.68;

/* ------------------------------------------------------------------ catálogo */
export const TYPES = ['planet','giant','star','binary','moon','asteroid','comet','nebula','pulsar','blackhole'];
export const TYPE_INFO = {
  planet:   {label:'Planeta',       noun:'planeta',          bench:4.6},
  giant:    {label:'Gigante',       noun:'gigante gaseoso',  bench:8.2},
  star:     {label:'Estrella',      noun:'estrella',         bench:6.4},
  binary:   {label:'Binaria',       noun:'estrella binaria', bench:6.6},
  moon:     {label:'Luna',          noun:'luna',             bench:3.4},
  asteroid: {label:'Asteroide',     noun:'asteroide',        bench:3.6},
  comet:    {label:'Cometa',        noun:'cometa',           bench:6.2},
  nebula:   {label:'Nebulosa',      noun:'nebulosa',         bench:6.8},
  pulsar:   {label:'Púlsar',        noun:'púlsar',           bench:6.4},
  blackhole:{label:'Agujero negro', noun:'agujero negro',    bench:7.2},
};

// paletas: [hondo, medio, alto]. Son familias tibias porque los astros son contenido y no cromo.
export const PALETTES = {
  planet: [
    {n:'Durazno', c:['#6b2c3a','#ff8a5b','#ffd2b0'], w:'#235a86'},
    {n:'Celeste', c:['#12354c','#3ba8d8','#c2ecfc'], w:'#2a6b73'},
    {n:'Menta',   c:['#173f45','#3fb39a','#c4f5e1'], w:'#1f5f86'},
    {n:'Miel',    c:['#5a3214','#e8a23c','#fff0c2'], w:'#246b6e'},
    {n:'Rosa',    c:['#5c1f4a','#e36f9f','#ffd0e4'], w:'#3f3a8a'},
  ],
  giant: [
    {n:'Caramelo', c:['#7a3a22','#f0a05e','#ffe6c6']},
    {n:'Cielo',    c:['#184059','#52bde0','#d6f4fc']},
    {n:'Coral',    c:['#7a2433','#ff7a6b','#ffd9c8']},
    {n:'Pistacho', c:['#2f4a35','#9fcf8c','#f2f7d8']},
  ],
  moon: [
    {n:'Ceniza',     c:['#3b3550','#8e86a3','#e6e0f0']},
    {n:'Arena',      c:['#4a3a33','#b59a85','#f1e2d2']},
    {n:'Rosa polvo', c:['#4a3040','#b48aa0','#f3dce6']},
  ],
  asteroid: [
    {n:'Piedra', c:['#2f2838','#7d7290','#d6cde3']},
    {n:'Óxido',  c:['#43221c','#a8603f','#f2c29b']},
    {n:'Jade',   c:['#1f3532','#5f9c8c','#cfeee3']},
    {n:'Hierro', c:['#26262e','#6b6a78','#c9c3b8']},
  ],
  comet: [
    {n:'Menta',      c:['#244040','#d8fff0','#7fe0c4']},
    {n:'Hielo celeste', c:['#183a48','#8ce0f5','#4dc9e6']},
    {n:'Brasa',      c:['#4a2a2a','#ffd2b0','#ff8a5b']},
  ],
  nebula: [
    {n:'Atardecer', c:['#ff8a5b','#e36f9f','#a99bff']},
    {n:'Aurora',    c:['#7fe0c4','#56ccf2','#fff1de']},
    {n:'Miel',      c:['#e8a23c','#ff8a5b','#ffe2a8']},
  ],
  binary: [
    {n:'Brasa y lila', c:['#ff8a5b','#cfd0ff']},
    {n:'Miel y rosa',  c:['#ffc46b','#ff8fb5']},
    {n:'Roja y crema', c:['#ff5a3a','#fff1de']},
  ],
  pulsar: [
    {n:'Celeste', c:['#56ccf2','#fff1de']},
    {n:'Menta',   c:['#7fe0c4','#fff1de']},
    {n:'Brasa',   c:['#ff8a5b','#fff1de']},
  ],
  blackhole: [
    {n:'Fogata', c:['#fff1de','#ff8a5b','#2f7fb0']},
    {n:'Aurora', c:['#fff1de','#7fe0c4','#56ccf2']},
    {n:'Miel',   c:['#fff4e0','#ffc46b','#e2603a']},
  ],
};

export function starColor(t){
  // rampa de temperatura: roja → brasa → miel → blanca → blanco-azulada (es física, no cromo)
  const stops = ['#ff5a3a','#ff8a5b','#ffd08a','#fff4e6','#d6dcff'];
  const x = Math.min(0.9999, Math.max(0, t)) * (stops.length-1);
  const i = Math.floor(x), f = x - i;
  return new THREE.Color(stops[i]).lerp(new THREE.Color(stops[i+1]), f);
}

export function defaultDesign(type, seed){
  const base = {type, size:.5, pal:0, cloud:.5, rings:false, storm:true, temp:.35, corona:.55,
    sea:.5, relief:.5, ice:.3, bands:.45, turb:.4, craters:.6, maria:.4, lumps:.6,
    tail:.65, density:.6, sep:.5, spinRate:.45, beam:.6, disk:.6,
    seed: seed ?? Math.floor(Math.random()*1000)};
  if(type==='giant') base.rings = true;
  if(type==='star') base.temp = .3;
  if(type==='binary') base.temp = .5;
  if(type==='asteroid'){ base.craters = .5; base.size = .45; }
  return base;
}
// diseños viejos (guardados antes de que las nubes fueran un dial) → forma actual
export function normDesign(d){
  const out = {...defaultDesign(d.type, d.seed), ...d};
  if(typeof d.clouds === 'boolean'){ out.cloud = d.clouds ? (typeof d.cloud === 'number' ? d.cloud : .5) : 0; }
  delete out.clouds;
  return out;
}

/* ------------------------------------------------------------------ ruido */
export const NOISE = /* glsl */`
  float vhash(vec3 p){
    p = fract(p*0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x*p.y*p.z*(p.x+p.y+p.z));
  }
  float vnoise(vec3 x){
    vec3 i = floor(x); vec3 f = fract(x);
    f = f*f*(3.0-2.0*f);
    return mix(mix(mix(vhash(i+vec3(0.,0.,0.)), vhash(i+vec3(1.,0.,0.)), f.x),
                   mix(vhash(i+vec3(0.,1.,0.)), vhash(i+vec3(1.,1.,0.)), f.x), f.y),
               mix(mix(vhash(i+vec3(0.,0.,1.)), vhash(i+vec3(1.,0.,1.)), f.x),
                   mix(vhash(i+vec3(0.,1.,1.)), vhash(i+vec3(1.,1.,1.)), f.x), f.y), f.z);
  }
  float fbm(vec3 p){
    float a = 0.5; float s = 0.0;
    for(int i=0;i<4;i++){ s += a*vnoise(p); p = p*2.03 + 11.5; a *= 0.5; }
    return s/0.9375;
  }
`;

/* altura del terreno sobre la esfera unidad: la misma función mueve la malla (vértices) y la luz (píxeles) */
const HEIGHT = /* glsl */`
  uniform float uKind, uSeed, uSea, uRelief, uLumps;
  float ridged(vec3 p){
    float s = 0.0, a = 0.5;
    for(int i=0;i<3;i++){ float n = 1.0 - abs(vnoise(p)*2.0 - 1.0); s += n*n*a; p = p*2.1 + 7.3; a *= 0.5; }
    return s/0.875;
  }
  float craters(vec3 p){
    vec3 i = floor(p); vec3 f = fract(p);
    float res = 0.0;
    for(int x=-1;x<=1;x++) for(int y=-1;y<=1;y++) for(int z=-1;z<=1;z++){
      vec3 g = vec3(float(x),float(y),float(z));
      vec3 o = vec3(vhash(i+g), vhash(i+g+17.1), vhash(i+g+31.7));
      vec3 d = g + o - f;
      float r = 0.16 + 0.3*vhash(i+g+5.3);
      float dist = length(d)/r;
      res += smoothstep(1.0, 0.1, dist) * -0.55 + smoothstep(0.72, 1.0, dist)*smoothstep(1.2, 1.0, dist)*0.7;
    }
    return res;
  }
  float seaLevel(){ return mix(0.30, 0.68, uSea); }
  // c = valor de continente/base, m = montañas o cráteres (para colorear)
  float heightOf(vec3 n, out float c, out float m){
    c = 0.0; m = 0.0;
    if(uKind < 0.5){                         // planeta: continentes + cordilleras
      c = fbm(n*1.7 + uSeed)*0.82 + fbm(n*3.4 - uSeed*1.3)*0.18;
      float sl = seaLevel();
      float land = smoothstep(sl, sl + 0.03, c);
      m = ridged(n*4.2 + uSeed*0.7);
      return land*((c - sl)*1.2 + m*uRelief*0.85);
    }
    if(uKind < 1.5) return 0.0;              // gigante: gas, sin relieve
    if(uKind < 2.5){                         // luna: cráteres
      c = fbm(n*2.1 + uSeed); m = craters(n*2.4 + uSeed);
      return m*uRelief*0.5 + c*0.4;
    }
    if(uKind < 3.5){ c = fbm(n*1.5 + uSeed); return c; }   // núcleo de cometa
    c = fbm(n*1.1 + uSeed); m = craters(n*2.2 + uSeed);    // asteroide: una papa con cráteres
    return c*(0.35 + uLumps*1.1) + fbm(n*3.2 - uSeed)*0.3 + m*uRelief*0.24;
  }
  // la malla solo se mueve con la parte lenta del relieve; el detalle fino (crestas, cráteres)
  // lo dibuja la luz. Si la malla siguiera el detalle fino, se arrugaría en triángulos doblados.
  float heightLow(vec3 n){
    if(uKind < 0.5){
      float c = fbm(n*1.7 + uSeed)*0.82 + fbm(n*3.4 - uSeed*1.3)*0.18;
      float sl = seaLevel();
      float land = smoothstep(sl - 0.03, sl + 0.12, c);
      float r = 1.0 - abs(vnoise(n*4.2 + uSeed*0.7)*2.0 - 1.0);
      return land*(max(c - sl, 0.0)*1.2 + r*r*uRelief*0.7);
    }
    if(uKind < 1.5) return 0.0;
    if(uKind < 2.5) return fbm(n*2.1 + uSeed)*0.4;
    if(uKind < 3.5) return fbm(n*1.5 + uSeed);
    return fbm(n*1.1 + uSeed)*(0.35 + uLumps*1.1) + vnoise(n*3.2 - uSeed)*0.3;
  }
`;

/* arcilla: un solo shader para planeta / gigante / luna / núcleo de cometa / asteroide */
const CLAY_V = /* glsl */`
  uniform float uDisp;
  varying vec3 vOP; varying vec3 vWP; varying vec3 vSN; varying vec3 vM0; varying vec3 vM1; varying vec3 vM2;
  ${NOISE}
  ${HEIGHT}
  void main(){
    vec3 n = normalize(position);
    float h = uDisp > 0.0 ? heightLow(n) : 0.0;
    vOP = n;
    vec4 wp = modelMatrix * vec4(position*(1.0 + h*uDisp), 1.0);
    vWP = wp.xyz;
    vSN = normalize(mat3(modelMatrix) * n);
    vM0 = modelMatrix[0].xyz; vM1 = modelMatrix[1].xyz; vM2 = modelMatrix[2].xyz;   // constantes por objeto
    gl_Position = projectionMatrix * viewMatrix * wp;
  }`;
const CLAY_F = /* glsl */`
  uniform vec3 uA, uB, uC, uW, uLight, uLightCol;
  uniform float uTime, uIce, uBands, uTurb, uMaria, uStorm, uAurora, uGlow, uDisp, uBump;
  varying vec3 vOP; varying vec3 vWP; varying vec3 vSN; varying vec3 vM0; varying vec3 vM1; varying vec3 vM2;
  ${NOISE}
  ${HEIGHT}
  vec3 surface(vec3 n, out float h, out float wet){
    float c, m;
    h = heightOf(n, c, m);
    wet = 0.0;
    if(uKind < 0.5){                       // planeta
      float sl = seaLevel();
      float land = smoothstep(sl, sl + 0.03, c);
      float depth = clamp((sl - c)/0.2, 0.0, 1.0);
      vec3 ocean = mix(mix(uW, uC, 0.28)*1.08, uW*0.55, depth);
      ocean *= 0.95 + vnoise(n*9.0 - uSeed)*0.1;
      float elev = clamp((c - sl)*2.4 + m*uRelief*0.9, 0.0, 1.0);
      vec3 ground = mix(uB, uC, smoothstep(0.3, 0.95, elev));
      // poca agua: dunas de desierto en los llanos
      float dry = 1.0 - smoothstep(0.12, 0.5, uSea);
      float dunes = sin(dot(n, vec3(0.8, 0.3, 0.5))*44.0 + fbm(n*5.0 + uSeed)*7.0);
      ground = mix(ground, mix(uB, uC, 0.5)*(0.9 + 0.12*dunes), dry*0.65*(1.0 - smoothstep(0.35, 0.8, m*uRelief)));
      ground *= 0.92 + vnoise(n*14.0 + uSeed)*0.16;
      vec3 col = mix(ocean, ground, land);
      col = mix(col, uC*1.05, smoothstep(0.014, 0.0, abs(c - sl))*0.35*step(0.05, uSea));
      // hielo: casquetes que crecen y nieve en las cumbres
      float cap = smoothstep(1.0 - uIce*0.62, 1.0 - uIce*0.62 + 0.05, abs(n.y) + (c - 0.5)*0.22) * step(0.02, uIce);
      float snow = land * smoothstep(0.95 - uIce*0.45, 1.05 - uIce*0.45, m*uRelief + (c - sl)*1.4) * step(0.04, uIce);
      float ice = max(cap, snow);
      wet = (1.0 - land)*(1.0 - ice);
      return mix(col, vec3(1.0, 0.97, 0.94), ice*0.92);
    } else if(uKind < 1.5){                // gigante: franjas y remolinos
      float lat = n.y;
      float turb = fbm(vec3(n.x*1.3, n.y*5.0, n.z*1.3) + vec3(uTime*0.035, 0.0, uSeed));
      float eddy = fbm(n*3.0 + vec3(turb*2.0, uTime*0.02, -uSeed));
      float freq = mix(5.0, 24.0, uBands);
      float b  = sin(lat*freq + turb*(1.5 + uTurb*5.0) + eddy*uTurb*3.0 + uSeed);
      float b2 = sin(lat*freq*2.15 - turb*(1.0 + uTurb*3.0) + uSeed*0.5);
      vec3 col = mix(uA, uB, smoothstep(-0.7, 0.7, b));
      col = mix(col, uC, smoothstep(0.5, 0.95, b2)*0.65);
      if(uStorm > 0.01){
        float lon = atan(n.z, n.x);
        vec2 sp = vec2(sin(lon - 0.9), (lat + 0.3)*2.6);
        float front = step(0.0, cos(lon - 0.9));
        float d = length(sp*vec2(1.0, 1.7));
        float st = smoothstep(0.42, 0.12, d) * front;
        float swirl = 0.5 + 0.5*sin(d*26.0 - uTime*1.2 + atan(sp.y, sp.x)*2.0);
        col = mix(col, mix(uC, vec3(1.0, 0.62, 0.48), 0.55) * (0.82 + swirl*0.3), st*uStorm);
      }
      return col;
    } else if(uKind < 2.5){                // luna: mares oscuros y cráteres
      vec3 col = mix(uA, uB, smoothstep(0.25, 0.75, c));
      float mar = smoothstep(0.58 - uMaria*0.22, 0.62 - uMaria*0.22, fbm(n*1.3 + uSeed + 5.0));
      col = mix(col, uA*0.85, mar*0.8);
      col *= 1.0 + m*uRelief*0.35;
      col = mix(col, uC, smoothstep(0.62, 0.8, fbm(n*5.0 + 3.0))*0.3);
      return col;
    } else if(uKind < 3.5){                // núcleo de cometa
      return mix(uA, uB, smoothstep(0.32, 0.72, c));
    }
    vec3 col = mix(uA, uB, smoothstep(0.3, 0.7, fbm(n*2.6 + uSeed)));   // asteroide
    col = mix(col, uC, smoothstep(0.72, 0.9, vnoise(n*16.0 + uSeed))*0.5);
    col *= 1.0 + m*uRelief*0.25;
    return col;
  }
  void main(){
    vec3 no = normalize(vOP);
    float h, wet;
    vec3 alb = surface(no, h, wet);
    vec3 sn = normalize(vSN);
    vec3 n = sn;
    if(uDisp > 0.0 && uBump > 0.0){
      // relieve: la pendiente del terreno dobla la normal. Diferencias finitas sobre la esfera,
      // por píxel (suave en cualquier resolución). El gradiente no depende de la base elegida,
      // así que cambiar de base cerca de los polos no deja costura.
      vec3 helper = abs(no.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
      vec3 t1 = normalize(cross(helper, no)), t2 = cross(no, t1);
      const float e = 0.0035;
      float cc, mm;
      float h1 = heightOf(normalize(no + t1*e), cc, mm);
      float h2 = heightOf(normalize(no + t2*e), cc, mm);
      vec3 nObj = normalize(no - ((h1 - h)*t1 + (h2 - h)*t2)*(uDisp*uBump/e));
      n = normalize(mat3(vM0, vM1, vM2) * nObj);
    }
    vec3 V = normalize(cameraPosition - vWP);
    vec3 L = normalize(uLight - vWP);
    float wrap = clamp((dot(n, L) + 0.3)/1.3, 0.0, 1.0);
    float lit = smoothstep(0.02, 0.85, wrap);
    vec3 night = vec3(0.09, 0.11, 0.17);
    vec3 col = alb * (night + uLightCol * lit * 1.1);
    // el mar refleja el fuego
    float spec = pow(max(dot(reflect(-L, sn), V), 0.0), 38.0) * wet * smoothstep(0.0, 0.4, dot(sn, L));
    col += uLightCol * spec * 0.6;
    float fres = pow(1.0 - max(dot(sn, V), 0.0), 2.6);
    vec3 rimCol = mix(vec3(0.34, 0.8, 0.95), vec3(1.0, 0.74, 0.58), lit);
    rimCol = mix(rimCol, vec3(0.5, 0.88, 0.77), clamp(uAurora, 0.0, 1.0));
    col += rimCol * fres * (0.42 + uAurora*0.9);
    col += vec3(1.0, 0.62, 0.45) * uGlow * 0.35;
    gl_FragColor = vec4(col, 1.0);
  }`;

const CLAY_KIND = {planet:0, giant:1, moon:2, comet:3, asteroid:4};
function clayMaterial(kind, pal, d){
  return new THREE.ShaderMaterial({
    uniforms:{
      uA:{value:new THREE.Color(pal[0])}, uB:{value:new THREE.Color(pal[1])}, uC:{value:new THREE.Color(pal[2])}, uW:{value:new THREE.Color(pal[3] || pal[0])},
      uLight:{value:new THREE.Vector3()}, uLightCol:{value:new THREE.Color('#ffd9bf')},
      uKind:{value:kind}, uSeed:{value:seedOf(d)}, uTime:{value:0},
      uSea:{value:d.sea}, uRelief:{value:kind===2 || kind===4 ? d.craters : d.relief}, uIce:{value:d.ice},
      uBands:{value:d.bands}, uTurb:{value:d.turb}, uMaria:{value:d.maria}, uLumps:{value:d.lumps},
      uStorm:{value:d.storm ? 1 : 0}, uDisp:{value:dispOf(kind, d)}, uBump:{value:kind===4 ? 1.0 : 1.3},
      uAurora:{value:0}, uGlow:{value:0},
    },
    vertexShader:CLAY_V, fragmentShader:CLAY_F,
  });
}
const seedOf = d => (d.seed % 97)*0.37;
function dispOf(kind, d){
  if(kind === 0) return 0.012 + d.relief*0.05;
  if(kind === 2) return 0.03 + d.craters*0.03;
  if(kind === 3) return 0.22;
  if(kind === 4) return 0.16 + d.lumps*0.22;
  return 0;
}

/* halo de atmósfera: esfera trasera con brillo de borde */
function atmoMaterial(color){
  return new THREE.ShaderMaterial({
    uniforms:{uCol:{value:new THREE.Color(color)}, uLight:{value:new THREE.Vector3()}, uK:{value:1}},
    vertexShader:`varying vec3 vN; varying vec3 vV; varying vec3 vWP; varying vec3 vWN;
      void main(){ vec4 wp = modelMatrix*vec4(position,1.0); vWP = wp.xyz; vWN = normalize(mat3(modelMatrix)*normal);
        vec4 mv = viewMatrix*wp; vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix*mv; }`,
    fragmentShader:`uniform vec3 uCol; uniform vec3 uLight; uniform float uK;
      varying vec3 vN; varying vec3 vV; varying vec3 vWP; varying vec3 vWN;
      void main(){
        float f = 1.0 - abs(dot(normalize(vN), normalize(vV)));
        float a = pow(smoothstep(0.0, 1.0, f), 1.6) * smoothstep(1.0, 0.82, f);
        float lit = 0.35 + 0.65*clamp(dot(normalize(vWN), normalize(uLight - vWP))*0.5+0.5, 0.0, 1.0);
        vec3 c = mix(vec3(0.6,0.55,1.0), uCol, lit);
        gl_FragColor = vec4(c, a*0.6*uK);
      }`,
    side:THREE.BackSide, transparent:true, depthWrite:false, blending:THREE.AdditiveBlending,
  });
}

function cloudMaterial(seed){
  return new THREE.ShaderMaterial({
    uniforms:{uSeed:{value:seed}, uTime:{value:0}, uLight:{value:new THREE.Vector3()}, uK:{value:1}, uAmt:{value:.5}},
    vertexShader:`varying vec3 vOP; varying vec3 vWN; varying vec3 vWP;
      void main(){ vOP = normalize(position); vec4 wp = modelMatrix*vec4(position,1.0); vWP = wp.xyz;
        vWN = normalize(mat3(modelMatrix)*normal); gl_Position = projectionMatrix*viewMatrix*wp; }`,
    fragmentShader:`uniform float uSeed, uTime, uK, uAmt; uniform vec3 uLight;
      varying vec3 vOP; varying vec3 vWN; varying vec3 vWP;
      ${NOISE}
      void main(){
        float n = fbm(vOP*2.4 + vec3(uTime*0.02, uSeed, -uTime*0.015));
        float a = smoothstep(0.7 - uAmt*0.3, 0.84 - uAmt*0.24, n);
        float lit = smoothstep(-0.2, 0.7, dot(normalize(vWN), normalize(uLight - vWP)));
        vec3 c = mix(vec3(0.55,0.5,0.85), vec3(1.0,0.96,0.9), lit);
        gl_FragColor = vec4(c, a*0.88*uK);
      }`,
    transparent:true, depthWrite:false,
  });
}

function ringMaterial(pal){
  return new THREE.ShaderMaterial({
    uniforms:{uA:{value:new THREE.Color(pal[1])}, uB:{value:new THREE.Color(pal[2])}, uLight:{value:new THREE.Vector3()}, uK:{value:1}},
    vertexShader:`varying float vR; varying vec3 vWP; varying vec3 vWN;
      void main(){ vR = uv.x; vec4 wp = modelMatrix*vec4(position,1.0); vWP = wp.xyz;
        vWN = normalize(mat3(modelMatrix)*vec3(0.0,0.0,1.0));
        gl_Position = projectionMatrix*viewMatrix*wp; }`,
    fragmentShader:`varying float vR; varying vec3 vWP; varying vec3 vWN; uniform vec3 uA, uB, uLight; uniform float uK;
      void main(){
        float band = 0.55 + 0.45*sin(vR*48.0)*sin(vR*13.0 + 2.0);
        float gap = smoothstep(0.02, 0.06, abs(vR - 0.62));
        float a = band * gap * smoothstep(0.0, 0.08, vR) * smoothstep(1.0, 0.84, vR);
        float lit = 0.45 + 0.55*abs(dot(normalize(vWN), normalize(uLight - vWP)));
        vec3 col = mix(uA, uB, 0.5 + 0.5*sin(vR*26.0)) * lit;
        gl_FragColor = vec4(col, a*0.85*uK);
      }`,
    transparent:true, side:THREE.DoubleSide, depthWrite:false,
  });
}

function ringGeometry(inner, outer, segs = 96){
  const g = new THREE.RingGeometry(inner, outer, segs, 1);
  const pos = g.attributes.position, uv = g.attributes.uv;
  for(let i=0;i<pos.count;i++){
    const l = Math.hypot(pos.getX(i), pos.getY(i));
    uv.setXY(i, (l-inner)/(outer-inner), 0.5);
  }
  return g;
}

/* ---------------------------------------------------- texturas de brillo (canvas) */
const TEX = {};
export function glowTex(){
  if(TEX.glow) return TEX.glow;
  const s = 256, cv = document.createElement('canvas'); cv.width = cv.height = s;
  const x = cv.getContext('2d');
  const g = x.createRadialGradient(s/2,s/2,0,s/2,s/2,s/2);
  g.addColorStop(0,'rgba(255,255,255,1)'); g.addColorStop(.18,'rgba(255,255,255,.62)');
  g.addColorStop(.45,'rgba(255,255,255,.16)'); g.addColorStop(1,'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0,0,s,s);
  return TEX.glow = new THREE.CanvasTexture(cv);
}
export function raysTex(){
  if(TEX.rays) return TEX.rays;
  const s = 256, cv = document.createElement('canvas'); cv.width = cv.height = s;
  const x = cv.getContext('2d');
  x.translate(s/2, s/2);
  for(let i=0;i<14;i++){
    const a = i/14*TAU + (i%2)*0.1, len = s*(0.32 + (i*7%5)/5*0.16), w = 0.07 + (i%3)*0.03;
    const g = x.createLinearGradient(0,0,Math.cos(a)*len, Math.sin(a)*len);
    g.addColorStop(0,'rgba(255,255,255,.55)'); g.addColorStop(1,'rgba(255,255,255,0)');
    x.fillStyle = g; x.beginPath(); x.moveTo(0,0);
    x.arc(0,0,len,a-w,a+w); x.closePath(); x.fill();
  }
  const g = x.createRadialGradient(0,0,0,0,0,s/2);
  g.addColorStop(0,'rgba(255,255,255,.4)'); g.addColorStop(1,'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(-s/2,-s/2,s,s);
  return TEX.rays = new THREE.CanvasTexture(cv);
}
// anillo fino (anillo de fotones) o ancho (disco lenteado), según dónde está el pico
function ringTex(key, peak, width){
  if(TEX[key]) return TEX[key];
  const s = 256, cv = document.createElement('canvas'); cv.width = cv.height = s;
  const x = cv.getContext('2d');
  const g = x.createRadialGradient(s/2,s/2,0,s/2,s/2,s/2);
  const a = Math.max(0, peak - width), b = Math.min(1, peak + width);
  g.addColorStop(0,'rgba(255,255,255,0)'); g.addColorStop(a,'rgba(255,255,255,0)');
  g.addColorStop(peak,'rgba(255,255,255,1)'); g.addColorStop(b,'rgba(255,255,255,0)'); g.addColorStop(1,'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0,0,s,s);
  return TEX[key] = new THREE.CanvasTexture(cv);
}
export function sprite(tex, color, opacity, scale){
  const m = new THREE.SpriteMaterial({map:tex, color:new THREE.Color(color), transparent:true,
    blending:THREE.AdditiveBlending, depthWrite:false, opacity, dithering:true});
  const s = new THREE.Sprite(m); s.scale.setScalar(scale);
  return s;
}

/* ------------------------------------------------------------ superficie de estrella */
function starMaterial(color){
  return new THREE.ShaderMaterial({
    uniforms:{uCol:{value:color.clone()}, uTime:{value:0}, uSeed:{value:Math.random()*10}},
    vertexShader:`varying vec3 vN; varying vec3 vV; varying vec3 vOP;
      void main(){ vOP = normalize(position); vec4 mv = modelViewMatrix*vec4(position,1.0);
        vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
    fragmentShader:`uniform vec3 uCol; uniform float uTime, uSeed; varying vec3 vN; varying vec3 vV; varying vec3 vOP;
      ${NOISE}
      void main(){
        float g = fbm(vOP*5.0 + vec3(uTime*0.18, -uTime*0.12, uSeed));
        float g2 = fbm(vOP*11.0 - vec3(uTime*0.3, uSeed, uTime*0.2));
        float mu = max(dot(normalize(vN), normalize(vV)), 0.0);
        vec3 hot = mix(uCol, vec3(1.0, 0.98, 0.94), 0.55);
        vec3 c = mix(uCol*0.8, hot, smoothstep(0.25, 0.75, g*0.7 + g2*0.3));
        c *= 0.72 + 0.38*pow(mu, 0.5);
        c += uCol * pow(1.0 - mu, 2.0) * 0.5;
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
}

/* ------------------------------------------------------------------ colas */
export function makeTail(colHead, colEnd, len, width){
  const geo = new THREE.CylinderGeometry(width*0.25, width, len, 20, 10, true);
  geo.translate(0, len/2, 0);
  const mat = new THREE.ShaderMaterial({
    uniforms:{uA:{value:new THREE.Color(colHead)}, uB:{value:new THREE.Color(colEnd)}, uTime:{value:0}, uK:{value:1}, uLen:{value:len}},
    vertexShader:`varying float vT; varying vec3 vN; varying vec3 vV; varying float vAng;
      uniform float uLen;
      void main(){ vT = position.y/uLen; vAng = atan(position.z, position.x);
        vec4 mv = modelViewMatrix*vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix*mv; }`,
    fragmentShader:`uniform vec3 uA, uB; uniform float uTime, uK; varying float vT; varying vec3 vN; varying vec3 vV; varying float vAng;
      ${NOISE}
      void main(){
        float edge = pow(abs(dot(normalize(vN), normalize(vV))), 1.4);
        float streak = 0.65 + 0.35*vnoise(vec3(vAng*3.0, vT*6.0 - uTime*1.6, 0.0));
        float a = pow(1.0 - vT, 1.6) * edge * streak * smoothstep(0.0, 0.06, vT);
        vec3 c = mix(uA, uB, smoothstep(0.0, 0.8, vT));
        gl_FragColor = vec4(c, a*0.75*uK);
      }`,
    transparent:true, depthWrite:false, blending:THREE.AdditiveBlending, side:THREE.DoubleSide,
  });
  const m = new THREE.Mesh(geo, mat);
  m.renderOrder = 2;
  return m;
}

/* ------------------------------------------------------------------ haz de púlsar */
function makeBeam(color, len, width){
  const geo = new THREE.CylinderGeometry(width, width*0.08, len, 24, 6, true);
  geo.translate(0, len/2, 0);
  const mat = new THREE.ShaderMaterial({
    uniforms:{uA:{value:new THREE.Color(color)}, uK:{value:1}, uLen:{value:len}, uTime:{value:0}},
    vertexShader:`varying float vT; varying vec3 vN; varying vec3 vV; uniform float uLen;
      void main(){ vT = position.y/uLen; vec4 mv = modelViewMatrix*vec4(position,1.0);
        vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
    fragmentShader:`uniform vec3 uA; uniform float uK, uTime; varying float vT; varying vec3 vN; varying vec3 vV;
      void main(){
        float edge = pow(abs(dot(normalize(vN), normalize(vV))), 1.8);
        float a = pow(1.0 - vT, 1.3) * edge * smoothstep(0.0, 0.05, vT);
        a *= 0.8 + 0.2*sin(vT*40.0 - uTime*12.0);
        vec3 c = mix(vec3(1.0, 0.97, 0.92), uA, smoothstep(0.0, 0.5, vT));
        gl_FragColor = vec4(c, a*0.7*uK);
      }`,
    transparent:true, depthWrite:false, blending:THREE.AdditiveBlending, side:THREE.DoubleSide,
  });
  const m = new THREE.Mesh(geo, mat);
  m.renderOrder = 2;
  return m;
}

/* ------------------------------------------------------------------ disco de acreción */
function diskMaterial(pal, seed){
  return new THREE.ShaderMaterial({
    uniforms:{uHot:{value:new THREE.Color(pal[0])}, uMid:{value:new THREE.Color(pal[1])}, uOut:{value:new THREE.Color(pal[2])},
      uTime:{value:0}, uK:{value:1}, uSeed:{value:seed}},
    vertexShader:`varying float vR; varying float vAng; varying float vDop;
      void main(){
        vR = uv.x; vAng = atan(position.y, position.x);
        vec4 wp = modelMatrix*vec4(position,1.0);
        vec3 tw = normalize(mat3(modelMatrix)*vec3(-position.y, position.x, 0.0));
        vDop = dot(tw, normalize(cameraPosition - wp.xyz));
        gl_Position = projectionMatrix*viewMatrix*wp; }`,
    fragmentShader:`uniform vec3 uHot, uMid, uOut; uniform float uTime, uK, uSeed;
      varying float vR; varying float vAng; varying float vDop;
      ${NOISE}
      void main(){
        float a2 = vAng - uTime*0.9/(0.35 + vR);
        float n = fbm(vec3(cos(a2)*2.2, sin(a2)*2.2, vR*7.0 + uSeed));
        float streak = 0.45 + 0.75*n;
        vec3 c = mix(uHot, uMid, smoothstep(0.02, 0.4, vR));
        c = mix(c, uOut, smoothstep(0.45, 1.0, vR));
        float a = smoothstep(0.0, 0.05, vR) * pow(1.0 - vR, 1.3) * streak;
        a *= 1.0 + 0.6*vDop;
        gl_FragColor = vec4(c, clamp(a, 0.0, 1.0)*0.9*uK);
      }`,
    transparent:true, depthWrite:false, blending:THREE.AdditiveBlending, side:THREE.DoubleSide,
  });
}

/* ------------------------------------------------------------------ nebulosa */
function makeNebula(pal, seed, N){
  const rnd = mulberry(seed*7 + 3);
  const pos = new Float32Array(N*3), col = new Float32Array(N*3), sz = new Float32Array(N), ph = new Float32Array(N);
  const cs = pal.map(c => new THREE.Color(c));
  const lobes = [[0,0,0,1],[0.55,0.12,0.2,0.7],[-0.5,-0.1,-0.3,0.65],[0.1,0.25,-0.55,0.5]];
  for(let i=0;i<N;i++){
    const l = lobes[Math.floor(rnd()*lobes.length)];
    const g = () => (rnd()+rnd()+rnd()-1.5)/1.5;
    const r = l[3];
    pos[i*3]   = l[0] + g()*r*0.9;
    pos[i*3+1] = l[1] + g()*r*0.42;
    pos[i*3+2] = l[2] + g()*r*0.9;
    const t = Math.min(1, Math.hypot(pos[i*3], pos[i*3+1]*2, pos[i*3+2]) / 1.2);
    const c = t < .5 ? cs[0].clone().lerp(cs[1], t*2) : cs[1].clone().lerp(cs[2], (t-.5)*2);
    col[i*3] = c.r; col[i*3+1] = c.g; col[i*3+2] = c.b;
    sz[i] = 0.35 + rnd()*rnd()*1.6;
    ph[i] = rnd()*TAU;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos,3));
  geo.setAttribute('aCol', new THREE.BufferAttribute(col,3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(sz,1));
  geo.setAttribute('aPh', new THREE.BufferAttribute(ph,1));
  const mat = new THREE.ShaderMaterial({
    uniforms:{uTime:{value:0}, uScale:{value:1}, uProj:{value:800}, uK:{value:1}, uDensity:{value:.6}},
    vertexShader:`attribute vec3 aCol; attribute float aSize; attribute float aPh;
      uniform float uTime, uScale, uProj, uDensity; varying vec3 vCol; varying float vA;
      void main(){
        vec3 p = position;
        float r = length(p.xz);
        float ang = uTime*0.12/(0.4 + r);
        float c = cos(ang), s = sin(ang);
        p.xz = mat2(c, -s, s, c)*p.xz;
        p.y += sin(uTime*0.4 + aPh)*0.03;
        vec4 mv = modelViewMatrix*vec4(p, 1.0);
        gl_Position = projectionMatrix*mv;
        gl_PointSize = clamp(aSize * uScale * 0.22 * uProj / -mv.z, 1.0, 120.0);
        vCol = aCol; vA = (0.55 + 0.45*sin(uTime*0.8 + aPh)) * uDensity;
      }`,
    fragmentShader:`varying vec3 vCol; varying float vA; uniform float uK;
      void main(){ vec2 c = gl_PointCoord - 0.5; float d = length(c);
        float a = smoothstep(0.5, 0.0, d); a *= a;
        gl_FragColor = vec4(vCol, a*vA*0.3*uK); }`,
    transparent:true, depthWrite:false, blending:THREE.AdditiveBlending,
  });
  const pts = new THREE.Points(geo, mat);
  pts.renderOrder = 3;
  return pts;
}

export function mulberry(a){
  return function(){ a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

/* ======================================================================= Body
   root (posición) → deform (aplastar/estirar sin rotar) → spin (giro) → partes */
const _m1 = new THREE.Matrix4(), _m2 = new THREE.Matrix4(), _m3 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion();
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _up = new THREE.Vector3(0,1,0);
const ease = (k, dt) => 1 - Math.exp(-dt*k);
// diales de superficie que se animan hacia su meta (uniform ← clave del diseño)
const LIVE_KEYS = [['uSea','sea'],['uIce','ice'],['uBands','bands'],['uTurb','turb'],['uMaria','maria'],['uLumps','lumps']];

export class Body {
  constructor(design, {lod = 'high'} = {}){
    this.lod = lod;
    this.root = new THREE.Group();
    this.deform = new THREE.Group(); this.deform.matrixAutoUpdate = false;
    this.spin = new THREE.Group();
    this.root.add(this.deform); this.deform.add(this.spin);
    this.sq = {x:0, v:0, axis:new THREE.Vector3(0,1,0)};
    this.scaleNow = 0.001; this.scaleGoal = 1;
    this.t = Math.random()*20;
    this.glow = 0;
    this.cometK = 0; this.cometOn = false;
    this.vel = null;
    this.build(normDesign(design));
  }

  get type(){ return this.d.type; }

  build(d){
    // limpiar todo lo que no sea la estructura root → deform → spin
    for(const ch of [...this.spin.children]){ this.spin.remove(ch); disposeTree(ch); }
    for(const ch of [...this.deform.children]) if(ch !== this.spin){ this.deform.remove(ch); disposeTree(ch); }
    for(const ch of [...this.root.children]) if(ch !== this.deform){ this.root.remove(ch); disposeTree(ch); }
    this.spin.scale.set(1, 1, 1);
    this.extTail = null; this.cometK = 0;
    const wasComet = this.cometOn; this.cometOn = false;
    this.d = {...d};
    this.parts = {};
    this.uLights = [];   // uniforms uLight a actualizar
    this.uTimes = [];
    const P = this.parts;
    const type = d.type;
    if(type in CLAY_KIND){
      const pals = PALETTES[type], pe = pals[d.pal % pals.length] || pals[0], pal = [...pe.c, pe.w || pe.c[0]];
      const kind = CLAY_KIND[type];
      const hi = this.lod === 'high';
      const seg = hi ? (type==='moon' || type==='comet' ? 56 : type==='asteroid' ? 72 : 80) : (type==='asteroid' ? 40 : 32);
      const mat = clayMaterial(kind, pal, d);
      if(!hi) mat.uniforms.uBump.value = 0;   // en la galaxia el astro mide pocos píxeles: basta la normal suave
      P.core = new THREE.Mesh(new THREE.SphereGeometry(1, seg, Math.round(seg*0.72)), mat);
      if(type==='giant') P.core.scale.y = 0.93;
      if(type==='comet') P.core.scale.set(1, 0.82, 0.9);
      if(type==='asteroid'){ const r = mulberry(d.seed + 5); P.core.scale.set(1.1 + r()*0.3, 0.78 + r()*0.12, 0.92 + r()*0.1); }
      this.spin.add(P.core);
      this.uLights.push(mat.uniforms.uLight); this.uTimes.push(mat.uniforms.uTime);
      P.mat = mat; P.kind = kind;
      P.palGoal = pal.map(c => new THREE.Color(c));
      if(type==='planet' || type==='giant'){
        P.atmo = new THREE.Mesh(new THREE.SphereGeometry(1.12, hi ? 40 : 24, hi ? 30 : 16), atmoMaterial(pal[2]));
        this.deform.add(P.atmo);
        this.uLights.push(P.atmo.material.uniforms.uLight);
      }
      if(type==='planet'){
        const cm = cloudMaterial((d.seed%31)*0.7);
        P.clouds = new THREE.Mesh(new THREE.SphereGeometry(1.075, hi ? 48 : 28, hi ? 36 : 20), cm);
        this.spin.add(P.clouds);
        this.uLights.push(cm.uniforms.uLight); this.uTimes.push(cm.uniforms.uTime);
        P.cloudK = d.cloud > 0.02 ? 1 : 0; cm.uniforms.uK.value = P.cloudK; cm.uniforms.uAmt.value = d.cloud;
        P.clouds.visible = P.cloudK > 0;
      }
      if(type==='planet' || type==='giant'){
        const rm = ringMaterial(pal);
        P.rings = new THREE.Mesh(ringGeometry(1.45, type==='giant'?2.35:2.05), rm);
        P.ringPivot = new THREE.Group();
        P.ringPivot.rotation.set(Math.PI/2 - 0.38, 0, 0.22);
        P.ringPivot.add(P.rings);
        this.deform.add(P.ringPivot);
        this.uLights.push(rm.uniforms.uLight);
        P.ringK = d.rings ? 1 : 0; P.ringPivot.scale.setScalar(P.ringK || 0.001); P.ringPivot.visible = d.rings;
      }
      if(type==='comet'){
        P.coma = sprite(glowTex(), pal[1], .55, 4.2);
        this.deform.add(P.coma);
        P.tailPivot = new THREE.Group();
        P.ion = makeTail('#fff1de', d.meteor ? '#7fe0c4' : pal[2], 9, 1.1);
        P.dust = makeTail(pal[1], '#ff8a5b', 7, 1.6);
        P.dust.rotation.z = 0.22;
        P.tailPivot.add(P.ion, P.dust);
        this.root.add(P.tailPivot);
        this.uTimes.push(P.ion.material.uniforms.uTime, P.dust.material.uniforms.uTime);
      }
      this.baseR = type==='asteroid' ? 1.25 : 1;
    } else if(type==='star'){
      const c = starColor(d.temp);
      P.core = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 36), starMaterial(c));
      this.spin.add(P.core);
      this.uTimes.push(P.core.material.uniforms.uTime);
      P.glow = sprite(glowTex(), c, .6, 4.4);
      P.rays = sprite(raysTex(), c, .45, 4 + d.corona*3.5);
      this.deform.add(P.glow, P.rays);
      this.baseR = 1;
    } else if(type==='binary'){
      const pal = (PALETTES.binary[d.pal % PALETTES.binary.length] || PALETTES.binary[0]).c;
      P.pair = [];
      for(let i=0;i<2;i++){
        const c = new THREE.Color(pal[i]);
        const g = new THREE.Group();
        const core = new THREE.Mesh(new THREE.SphereGeometry(i ? 0.48 : 0.62, 40, 30), starMaterial(c));
        const glow = sprite(glowTex(), c, .6, i ? 2.4 : 2.9);
        g.add(core, glow);
        this.spin.add(g);
        this.uTimes.push(core.material.uniforms.uTime);
        P.pair.push({g, core, glow, c});
      }
      P.halo = sprite(glowTex(), new THREE.Color(pal[0]).lerp(new THREE.Color(pal[1]), .5), .22, 7.5);
      this.deform.add(P.halo);
      this.baseR = 1.2;
    } else if(type==='nebula'){
      const pal = (PALETTES.nebula[d.pal % PALETTES.nebula.length] || PALETTES.nebula[0]).c;
      P.cloud = makeNebula(pal, d.seed, 420);
      P.cloud.scale.setScalar(2.2);
      this.spin.add(P.cloud);
      this.uTimes.push(P.cloud.material.uniforms.uTime);
      P.seedStar = sprite(glowTex(), '#fff1de', .9, 1.1);
      this.spin.add(P.seedStar);
      this.baseR = 2.0;
    } else if(type==='pulsar'){
      // estrella de neutrones: chiquita, muy brillante, con dos haces que barren como un faro
      const pal = (PALETTES.pulsar[d.pal % PALETTES.pulsar.length] || PALETTES.pulsar[0]).c;
      const c = new THREE.Color(pal[0]);
      P.core = new THREE.Mesh(new THREE.SphereGeometry(0.42, 40, 30), starMaterial(c.clone().lerp(new THREE.Color(pal[1]), .5)));
      this.uTimes.push(P.core.material.uniforms.uTime);
      P.axis = new THREE.Group();
      P.mag = new THREE.Group(); P.mag.rotation.z = 0.5;
      P.beams = [makeBeam(pal[0], 4.2, 0.55), makeBeam(pal[0], 4.2, 0.55)];
      P.beams[1].rotation.z = Math.PI;
      P.mag.add(...P.beams);
      P.axis.add(P.mag);
      this.spin.add(P.core, P.axis);
      for(const b of P.beams) this.uTimes.push(b.material.uniforms.uTime);
      P.glow = sprite(glowTex(), c, .6, 2.6);
      P.halo = sprite(ringTex('pulse', .3, .14), c, .0, 3.2);
      this.deform.add(P.glow, P.halo);
      P.c = c;
      this.baseR = 0.9;
    } else if(type==='blackhole'){
      // horizonte negro, anillo de fotones y un disco de acreción que gira más rápido por dentro
      const pal = (PALETTES.blackhole[d.pal % PALETTES.blackhole.length] || PALETTES.blackhole[0]).c;
      P.core = new THREE.Mesh(new THREE.SphereGeometry(0.5, 40, 30), new THREE.MeshBasicMaterial({color:'#060309'}));
      P.tilt = new THREE.Group(); P.tilt.rotation.set(-Math.PI/2 + 0.32, 0, 0.12);
      P.disk = new THREE.Mesh(ringGeometry(0.62, 2.4, 160), diskMaterial(pal, (d.seed%41)*0.3));
      P.tilt.add(P.disk);
      this.spin.add(P.core, P.tilt);
      this.uTimes.push(P.disk.material.uniforms.uTime);
      P.photon = sprite(ringTex('photon', .42, .07), pal[0], .95, 1.36);
      P.lens = sprite(ringTex('lens', .34, .16), pal[1], .35, 3.0);
      P.glow = sprite(glowTex(), pal[1], .18, 6);
      this.deform.add(P.glow, P.lens, P.photon);
      this.baseR = 1.4;
    }
    this.applyLive(true);
    if(wasComet) this.setComet(true);
  }

  // tamaño, colores, perillas: sin reconstruir; todo se anima hacia la meta
  setDesign(raw){
    const d = normDesign(raw);
    const prev = this.d;
    const clay = d.type in CLAY_KIND;
    const structural = d.type !== prev.type || (!clay && (d.pal !== prev.pal || d.seed !== prev.seed));
    if(structural){ this.build(d); return 'rebuild'; }
    this.d = {...d};
    this.applyLive(false);
    return d.pal !== prev.pal ? 'palette' : 'live';
  }

  sizeFor(d){
    const s = d.size;
    switch(d.type){
      case 'planet':   return 0.62 + s*0.62;
      case 'giant':    return 1.05 + s*0.75;
      case 'star':     return 0.78 + s*0.7;
      case 'binary':   return 0.8 + s*0.5;
      case 'moon':     return 0.42 + s*0.5;
      case 'asteroid': return 0.3 + s*0.42;
      case 'comet':    return 0.3 + s*0.26;
      case 'nebula':   return 0.8 + s*0.55;
      case 'pulsar':   return 0.75 + s*0.6;
      case 'blackhole':return 0.75 + s*0.6;
    }
    return 1;
  }

  applyLive(immediate){
    const d = this.d, P = this.parts;
    this.sizeGoal = this.sizeFor(d);
    if(immediate) this.sizeNow = this.sizeGoal;
    if(P.mat){
      const u = P.mat.uniforms;
      const pals = PALETTES[d.type], pe = pals[d.pal % pals.length] || pals[0], pal = [...pe.c, pe.w || pe.c[0]];
      P.palGoal.forEach((c, i) => c.set(pal[i]));
      P.liveGoal = {uSea:d.sea, uIce:d.ice, uBands:d.bands, uTurb:d.turb, uMaria:d.maria, uLumps:d.lumps,
        uRelief: P.kind===2 || P.kind===4 ? d.craters : d.relief, uDisp: dispOf(P.kind, d), uStorm: d.storm ? 1 : 0};
      u.uSeed.value = seedOf(d);
      if(immediate){
        for(const k in P.liveGoal) u[k].value = P.liveGoal[k];
        u.uA.value.copy(P.palGoal[0]); u.uB.value.copy(P.palGoal[1]); u.uC.value.copy(P.palGoal[2]); u.uW.value.copy(P.palGoal[3]);
      }
      if(d.type==='asteroid'){ const r = mulberry(d.seed + 5); P.core.scale.set(1.1 + r()*0.3, 0.78 + r()*0.12, 0.92 + r()*0.1); }
      if(P.atmo && !immediate) P.atmo.material.uniforms.uCol.value.set(pal[2]);
      if(P.rings && !immediate){ P.rings.material.uniforms.uA.value.set(pal[1]); P.rings.material.uniforms.uB.value.set(pal[2]); }
    }
    if(d.type==='star'){
      const c = starColor(d.temp);
      P.colGoal = c;
      P.coronaGoal = d.corona;
      if(immediate){ P.core.material.uniforms.uCol.value.copy(c); P.glow.material.color.copy(c); P.rays.material.color.copy(c); }
    }
    if(d.type==='binary'){ P.sepGoal = 1.1 + d.sep*1.6; if(immediate) P.sep = P.sepGoal; }
    if(d.type==='comet'){ P.tailGoal = 0.35 + d.tail*0.9; if(immediate) P.tailNow = P.tailGoal; }
    if(d.type==='nebula'){ P.densGoal = 0.3 + d.density*0.9; if(immediate) P.cloud.material.uniforms.uDensity.value = P.densGoal; }
    if(d.type==='pulsar'){
      P.rateGoal = 0.8 + d.spinRate*9; P.beamGoal = 0.35 + d.beam*0.9;
      if(immediate){ P.rate = P.rateGoal; P.beamNow = P.beamGoal; }
    }
    if(d.type==='blackhole'){ P.diskGoal = 0.25 + d.disk*0.85; if(immediate) P.diskNow = P.diskGoal; }
  }

  // radio visual (para encuadre y para tocar)
  get visR(){ return (this.sizeNow||1) * this.baseR * this.root.scale.x; }

  // golpecito: aplastar a lo largo de un eje (mundo) y rebotar
  squash(amount = .3, axis){
    this.sq.axis.copy(axis || _up).normalize();
    this.sq.v += amount * 8;
  }
  pulseGlow(k = 1){ this.glow = Math.max(this.glow, k); }

  setComet(on){
    if(this.cometOn === on) return;
    this.cometOn = on;
    const noTail = ['comet','nebula','blackhole'];
    if(on && !this.extTail && !noTail.includes(this.d.type)){
      const g = new THREE.Group();
      const ion = makeTail('#fff1de', '#7fe0c4', 7, 0.9), dust = makeTail('#ffd2b0', '#ff8a5b', 5.5, 1.2);
      dust.rotation.z = 0.2;
      g.add(ion, dust);
      this.root.add(g);
      this.extTail = g;
      this.uTimes.push(ion.material.uniforms.uTime, dust.material.uniforms.uTime);
      this.extTailParts = [ion, dust];
    }
  }

  // ctx: {dt, light (Vector3 mundo), sun (Vector3), cam (Vector3), mode, rm (movimiento reducido), aurora}
  update(ctx){
    const dt = ctx.dt, P = this.parts, d = this.d;
    this.t += dt;
    // tamaño con resorte suave
    this.sizeNow += (this.sizeGoal - this.sizeNow) * ease(4.5, dt);
    this.scaleNow += (this.scaleGoal - this.scaleNow) * ease(this.scaleGoal > this.scaleNow ? 5 : 7, dt);
    const s = this.sizeNow * this.scaleNow;
    this.spin.scale.setScalar(s);
    if(P.atmo) P.atmo.scale.setScalar(s);
    if(P.mat){
      // la superficie cambia de forma suave, nunca de golpe
      const u = P.mat.uniforms, k = ease(6, dt);
      for(const key in P.liveGoal) u[key].value += (P.liveGoal[key] - u[key].value)*k;
      u.uA.value.lerp(P.palGoal[0], k); u.uB.value.lerp(P.palGoal[1], k); u.uC.value.lerp(P.palGoal[2], k); u.uW.value.lerp(P.palGoal[3], k);
    }
    if(P.ringPivot){
      const goal = d.rings ? 1 : 0;
      P.ringK += (goal - P.ringK) * ease(4.5, dt);
      const k = P.ringK;
      P.ringPivot.scale.setScalar(Math.max(0.001, s * (0.6 + 0.4*k) * (k>0.01?1:0.001)));
      P.rings.material.uniforms.uK.value = k;
      P.ringPivot.visible = k > 0.01;
      P.rings.rotation.z += dt*0.05;
    }
    if(P.clouds){
      const goal = d.cloud > 0.02 ? 1 : 0;
      P.cloudK += (goal - P.cloudK) * ease(4, dt);
      const cu = P.clouds.material.uniforms;
      cu.uK.value = P.cloudK;
      cu.uAmt.value += (d.cloud - cu.uAmt.value)*ease(5, dt);
      P.clouds.visible = P.cloudK > 0.01;
      P.clouds.rotation.y += dt*0.06;
    }
    if(d.type==='star'){
      const u = P.core.material.uniforms.uCol.value;
      u.lerp(P.colGoal, ease(5, dt));
      P.glow.material.color.copy(u); P.rays.material.color.copy(u);
      P.coronaNow = (P.coronaNow ?? P.coronaGoal) + (P.coronaGoal - (P.coronaNow ?? P.coronaGoal))*ease(5, dt);
      const br = ctx.rm ? 1 : 1 + Math.sin(this.t*1.3)*0.04;
      P.glow.scale.setScalar(s*4.4*br);
      P.rays.scale.setScalar(s*(3.4 + P.coronaNow*4.2)*br);
      P.rays.material.opacity = 0.18 + P.coronaNow*0.5;
      if(!ctx.rm) P.rays.material.rotation += dt*0.05;
    }
    if(d.type==='binary'){
      P.sep += (P.sepGoal - P.sep) * ease(4, dt);
      const w = ctx.rm ? 0.25 : 0.9, a = this.t*w;
      const r1 = P.sep*0.42, r2 = P.sep*0.58;
      P.pair[0].g.position.set(Math.cos(a)*r1, 0, Math.sin(a)*r1);
      P.pair[1].g.position.set(-Math.cos(a)*r2, 0, -Math.sin(a)*r2);
      P.halo.scale.setScalar(s*(3.6 + P.sep*1.5));
    }
    if(d.type==='comet'){
      P.tailNow += (P.tailGoal - P.tailNow) * ease(4, dt);
      P.coma.scale.setScalar(s*3.6);
    }
    if(d.type==='nebula'){
      const u = P.cloud.material.uniforms;
      u.uDensity.value += (P.densGoal - u.uDensity.value) * ease(4, dt);
      u.uScale.value = s*2.2*this.root.scale.x; u.uProj.value = ctx.proj || 800;
      P.seedStar.scale.setScalar(s*0.9);
      P.seedStar.material.opacity = 0.6 + Math.sin(this.t*2.1)*0.3;
    }
    if(d.type==='pulsar'){
      P.rate += (P.rateGoal - P.rate)*ease(2.5, dt);
      P.beamNow += (P.beamGoal - P.beamNow)*ease(4, dt);
      P.axis.rotation.y += P.rate*dt*(ctx.rm ? 0.15 : 1);
      for(const b of P.beams) b.scale.set(1, P.beamNow, 1);
      // destello cuando un haz apunta a la cámara: el faro te mira
      let f = 0;
      if(ctx.cam){
        P.mag.getWorldQuaternion(_q2);
        _v.set(0, 1, 0).applyQuaternion(_q2);
        _v2.copy(ctx.cam).sub(this.root.position).normalize();
        f = Math.pow(Math.abs(_v.dot(_v2)), 10);
      }
      P.glow.scale.setScalar(s*(2.2 + f*2.6));
      P.glow.material.opacity = 0.4 + f*0.6;
      P.halo.scale.setScalar(s*(2.6 + f*1.8));
      P.halo.material.opacity = f*0.75;
    }
    if(d.type==='blackhole'){
      P.diskNow += (P.diskGoal - P.diskNow)*ease(4, dt);
      P.disk.material.uniforms.uK.value = P.diskNow;
      P.disk.scale.setScalar(0.82 + P.diskNow*0.3);
      P.photon.scale.setScalar(s*1.36);
      P.lens.scale.setScalar(s*(2.5 + P.diskNow*0.9));
      P.lens.material.opacity = 0.15 + P.diskNow*0.3;
      P.glow.scale.setScalar(s*(4 + P.diskNow*3));
    }
    // giro propio
    const spinRate = {moon:0.08, giant:0.28, nebula:0.02, asteroid:0.35, blackhole:0.05}[d.type] ?? 0.16;
    if(!this.manualSpin){
      this.spin.rotation.y += spinRate*dt*(ctx.rm ? 0.4 : 1);
      if(d.type==='asteroid' && !ctx.rm) this.spin.rotation.x += spinRate*0.4*dt;
    }
    // tiempo y luz
    for(const u of this.uTimes) u.value = this.t;
    for(const u of this.uLights) u.value.copy(ctx.light);
    if(P.mat){ P.mat.uniforms.uAurora.value = ctx.aurora || 0; }
    this.glow *= Math.exp(-dt*1.6);
    if(P.mat) P.mat.uniforms.uGlow.value = this.glow;

    // colas: lejos del fuego (o hacia atrás de la marcha, si es un meteoro)
    const tailDir = _v.copy(this.root.position).sub(ctx.sun);
    if(d.meteor && this.vel) tailDir.set(-this.vel[0], -this.vel[1], -this.vel[2]);
    if(ctx.mode === 'bench' || tailDir.lengthSq() < 1e-4) tailDir.set(0.85, 0.25, -0.6);
    tailDir.normalize();
    const rDist = Math.max(2, this.root.position.distanceTo(ctx.sun));
    const near = ctx.mode === 'bench' ? 1 : d.meteor ? 1.2 : Math.min(1.4, 6/rDist + 0.35);
    if(P.tailPivot){
      P.tailPivot.quaternion.setFromUnitVectors(_up, tailDir);
      const L = P.tailNow * near * this.scaleNow;
      P.tailPivot.scale.set(s*0.9 + 0.2, Math.max(0.001, L), s*0.9 + 0.2);
    }
    if(this.extTail){
      this.cometK += ((this.cometOn ? 1 : 0) - this.cometK) * ease(1.5, dt);
      this.extTail.quaternion.setFromUnitVectors(_up, tailDir);
      this.extTail.scale.set(s*0.8, Math.max(0.001, this.cometK*near*0.7), s*0.8);
      for(const t of this.extTailParts) t.material.uniforms.uK.value = this.cometK;
      this.extTail.visible = this.cometK > 0.01;
    }

    // aplastar y estirar (resorte de gelatina), sin rotar el contenido
    const sq = this.sq;
    if(ctx.rm){ sq.x = 0; sq.v = 0; }
    sq.v += (-70*sq.x - 6.2*sq.v) * dt;
    sq.x += sq.v * dt;
    const k = Math.max(-0.45, Math.min(0.6, sq.x));
    _q.setFromUnitVectors(_up, sq.axis);
    _m1.makeRotationFromQuaternion(_q);
    _m3.copy(_m1).transpose();
    _m2.makeScale(1 - k*0.5, 1 + k, 1 - k*0.5);
    this.deform.matrix.copy(_m1).multiply(_m2).multiply(_m3);
    this.deform.matrixWorldNeedsUpdate = true;
  }

  dispose(){ disposeTree(this.root); }
}

export function disposeTree(o){
  o.traverse(ch => {
    if(ch.geometry) ch.geometry.dispose();
    if(ch.material){ (Array.isArray(ch.material) ? ch.material : [ch.material]).forEach(m => m.dispose()); }
  });
}

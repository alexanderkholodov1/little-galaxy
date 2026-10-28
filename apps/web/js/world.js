// world.js — un solo mundo 3D: la galaxia, el banco del taller y la plataforma de lanzamiento
// viven en la misma escena. Pasar de una pantalla a otra es mover la cámara, nunca cortar.
import * as THREE from 'three';
import {distantMarker} from '../integration/distant-marker.js';
import {galaxyFrame, paintedDistance} from '../integration/galaxy-frame.js';
import {restoreCoordinates} from '../integration/replay-coordinates.js';
import {Sim, predict, elements, propagate} from './sim/index.js';
import {Body, GALAXY_SCALE, TYPE_INFO, glowTex, raysTex, sprite, NOISE, mulberry} from './bodies.js';

THREE.ColorManagement.enabled = false;

const TAU = Math.PI * 2;
export const BENCH = new THREE.Vector3(0, 7.5, 36);
// R6: ya no hay plataforma fija. El punto de lanzamiento es el punto del plano galáctico que está bajo
// este lugar de la pantalla (un poco abajo del centro, para que la trayectoria se vea por encima).
const ANCHOR_SCREEN = {x:0.5, y:0.64};
const LAUNCH_RMIN = 3.4;      // nunca se lanza desde dentro del fuego
const LIFT = 0.0;             // altura de lanzamiento sobre el plano (las órbitas quedan planas, R6)
const KEY_LIGHT = BENCH.clone().add(new THREE.Vector3(-3.4, 3.6, 4.4));
const SUN = new THREE.Vector3(0, 0, 0);
const TRAIL_K = 200;          // muestras por estela
const TRAIL_EVERY = 0.11;     // s de simulación entre muestras
const MAX_BODIES = 128;      // entradas a la vez (estelas y mallas); la simulación admite hasta MAX_BODIES − TOY_MAX astros
const BRASA = new THREE.Color('#ff8a5b'), LAVANDA = new THREE.Color('#a99bff'), CELESTE = new THREE.Color('#56ccf2'), CREMA = new THREE.Color('#fff1de'), MENTA = new THREE.Color('#7fe0c4');
const PAD_SCALE = 1.05;       // en la plataforma tu astro se ve más grande; al volar se encoge a la escala de la galaxia
const TOY_MAX = 12;           // juguetes (lanzar por lanzar) vivos a la vez

// smootherstep: arranca y frena sin tirón (aceleración nula en los extremos)
const ease = t => t*t*t*(t*(t*6 - 15) + 10);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const angDiff = (a, b) => { let d = (b - a) % TAU; if(d > Math.PI) d -= TAU; if(d < -Math.PI) d += TAU; return d; };

export function createWorld(canvas, opts = {}){
  let RM = !!opts.rm;               // R16: 'movimiento' se cambia en vivo (setMotion)
  const rmU = [];                  // uniformes que dependen de RM: [uniforme, valor con calma, valor completo]
  const rmUni = (calm, full) => { const u = {value:RM ? calm : full}; rmU.push([u, calm, full]); return u; };
  const renderer = new THREE.WebGLRenderer({canvas, antialias:true, powerPreference:'high-performance'});
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.setClearColor('#0d1018', 1);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 1200);
  const sim = new (opts.Simulation ?? Sim)({seed: opts.seed ?? 1});
  const toySim = new Sim({seed:1});
  const listeners = {};let homeAuto=true;
  const emit = (ev, ...a) => {if(ev==='camera-user')homeAuto=false;(listeners[ev] || []).forEach(fn => fn(...a));};
  const W = {renderer, scene, camera, sim, entries:[], mode:'home', t:0, px:1, rm:RM, fps:60, owner:'local'};
  sim.budget.galaxyBodies = MAX_BODIES - TOY_MAX - 2;
  let dprCap = Math.min(window.devicePixelRatio || 1, 1.75);

  /* ------------------------------------------------------------ el fondo: profundidad sin superficie (R1)
     Antes era una esfera de 700 con textura (BackSide): de lejos se leía como cúpula, con costura y polos.
     Ahora no hay superficie: el color del fondo y la banda de polvo se calculan por dirección de mirada
     (una vez, en un cubemap; se muestrea con tramado, así que no hay costura, ni polo, ni escalones), y
     las estrellas son cuatro capas de puntos a distancias distintas que acompañan a la cámara con distinto
     retraso: al acercarse o alejarse, las cercanas se abren y las lejanas quedan quietas, como en el infinito. */
  const pxU = {value:1};
  const projU = {value:800};   // píxeles por unidad de mundo a distancia 1 (tamaños de partícula en unidades reales)
  const timeU = {value:0};
  const BAND_N = new THREE.Vector3(0.42, 0.78, -0.46).normalize();    // la banda cruza el cielo inclinada: nunca es un horizonte
  const BAND_WARM = new THREE.Vector3(0, 0, 1).cross(BAND_N).normalize();
  const SKY = {base:'#0d1018', warm:'#ff8a5b', cool:'#56ccf2', rose:'#f4a261'};   // M6 (R2): tinta, brasa, celeste, miel (sin lavanda)
  const skyRT = new THREE.WebGLCubeRenderTarget(512, {generateMipmaps:false, minFilter:THREE.LinearFilter, magFilter:THREE.LinearFilter});
  function paintSky(colors = SKY){
    Object.assign(SKY, colors);
    const gen = new THREE.Scene();
    const mat = new THREE.ShaderMaterial({
      side:THREE.BackSide, depthTest:false, depthWrite:false,
      uniforms:{uBandN:{value:BAND_N}, uWarmDir:{value:BAND_WARM}, uBase:{value:new THREE.Color(SKY.base)},
        uWarm:{value:new THREE.Color(SKY.warm)}, uCool:{value:new THREE.Color(SKY.cool)}, uRose:{value:new THREE.Color(SKY.rose)}},
      vertexShader:`varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader:`uniform vec3 uBandN, uWarmDir, uBase, uWarm, uCool, uRose; varying vec3 vDir;
        ${NOISE}
        void main(){
          vec3 d = normalize(vDir);
          float n1 = fbm(d*2.4 + 3.1), n2 = fbm(d*7.0 + 1.7);
          float lat = dot(d, uBandN) + (n1 - 0.5)*0.07;
          // la banda: ancha y difusa, con grumos, y una veta oscura de polvo que la recorre
          float band = exp(-lat*lat/0.05);
          float core = exp(-lat*lat/0.012);
          float clump = smoothstep(0.3, 0.8, n1*0.6 + n2*0.4);
          float lane = exp(-pow((lat - 0.02 + (n2 - 0.5)*0.05)/0.035, 2.0))*smoothstep(0.35, 0.65, n1);
          float side = dot(d, uWarmDir);
          vec3 tint = mix(uCool, uWarm, smoothstep(-0.55, 0.55, side));
          vec3 c = uBase;
          c += tint*(band*(0.035 + 0.085*clump) + core*0.05*clump)*(1.0 - 0.7*lane);
          // nubes muy tenues lejos de la banda: el oscuro tiene cuerpo, sin degradado de arriba a abajo
          c += uRose*0.022*smoothstep(0.5, 0.85, fbm(d*1.6 + 7.0))*(1.0 - band);
          gl_FragColor = vec4(c, 1.0);
        }`,
    });
    const box = new THREE.Mesh(new THREE.SphereGeometry(5, 64, 32), mat);
    gen.add(box);
    const cc = new THREE.CubeCamera(0.5, 20, skyRT);
    cc.update(renderer, gen);
    box.geometry.dispose(); mat.dispose();
  }
  paintSky();
  {
    // un triángulo que cubre la pantalla; cada píxel mira el cubemap en su dirección
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
    const mat = new THREE.ShaderMaterial({
      depthTest:false, depthWrite:false,
      uniforms:{uSky:{value:skyRT.texture}, uInvProj:{value:camera.projectionMatrixInverse}, uCamRot:{value:new THREE.Matrix3()}},
      vertexShader:`uniform mat4 uInvProj; uniform mat3 uCamRot; varying vec3 vDir;
        void main(){ vec4 v = uInvProj*vec4(position.xy, 1.0, 1.0); vDir = uCamRot*(v.xyz/v.w); gl_Position = vec4(position.xy, 0.0, 1.0); }`,
      fragmentShader:`uniform samplerCube uSky; varying vec3 vDir;
        float h2(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233)))*43758.5453); }
        void main(){ vec3 c = textureCube(uSky, normalize(vDir)).rgb;
          c += (h2(gl_FragCoord.xy) + h2(gl_FragCoord.yx + 17.0) - 1.0)/255.0;   // tramado triangular: sin escalones
          gl_FragColor = vec4(c, 1.0); }`,
    });
    const sky = new THREE.Mesh(geo, mat);
    sky.frustumCulled = false; sky.renderOrder = -20;
    sky.onBeforeRender = () => mat.uniforms.uCamRot.value.setFromMatrix4(camera.matrixWorld);
    scene.add(sky);
    W.sky = sky;
  }

  /* ------------------------------------------------------------ estrellas: cuatro capas con paralaje (titilan) */
  W.starLayers = [];
  {
    const LAYERS = [   // R: distancia · par: cuánto se queda atrás cuando la cámara se mueve (0 = infinito)
      {R:900, par:0,    N:1500, s0:0.8, s1:1.5, big:0.03, a:0.6},
      {R:520, par:0.02, N:900,  s0:1.0, s1:1.9, big:0.06, a:0.75},
      {R:300, par:0.07, N:460,  s0:1.1, s1:2.3, big:0.1,  a:0.85},
      {R:170, par:0.18, N:200,  s0:1.3, s1:2.6, big:0.16, a:0.95},
    ];
    const rnd = mulberry(7);
    const pal = [CREMA, CREMA, CREMA, CELESTE, new THREE.Color('#ffb48c')];
    const _d = new THREE.Vector3();
    for(const L of LAYERS){
      const pos = new Float32Array(L.N*3), col = new Float32Array(L.N*3), sz = new Float32Array(L.N), ph = new Float32Array(L.N);
      for(let i=0;i<L.N;i++){
        // dirección uniforme en la esfera (sin polos), con más estrellas cerca de la banda
        let tries = 0;
        do { const u = rnd()*2 - 1, th = rnd()*TAU, s = Math.sqrt(1 - u*u); _d.set(Math.cos(th)*s, u, Math.sin(th)*s); }
        while(rnd() > 0.35 + 0.65*Math.exp(-Math.pow(_d.dot(BAND_N), 2)/0.04) && ++tries < 8);
        const r = L.R*(0.85 + rnd()*0.3);
        pos[i*3] = _d.x*r; pos[i*3+1] = _d.y*r; pos[i*3+2] = _d.z*r;
        const c = pal[Math.floor(rnd()*pal.length)]; col[i*3] = c.r; col[i*3+1] = c.g; col[i*3+2] = c.b;
        sz[i] = rnd() < L.big ? L.s1 + rnd()*1.4 : L.s0 + rnd()*(L.s1 - L.s0); ph[i] = rnd()*TAU;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('aCol', new THREE.BufferAttribute(col, 3));
      geo.setAttribute('aSize', new THREE.BufferAttribute(sz, 1));
      geo.setAttribute('aPh', new THREE.BufferAttribute(ph, 1));
      const mat = new THREE.ShaderMaterial({
        uniforms:{uTime:timeU, uPx:pxU, uTw:rmUni(0, 1), uRef:{value:L.R}, uA:{value:L.a}},
        vertexShader:`attribute vec3 aCol; attribute float aSize; attribute float aPh; uniform float uTime, uPx, uTw, uRef, uA;
          varying vec3 vCol; varying float vA;
          void main(){ vec4 mv = modelViewMatrix*vec4(position,1.0); gl_Position = projectionMatrix*mv;
            float tw = 0.6 + 0.4*sin(uTime*(0.8 + fract(aPh)*1.6) + aPh*7.0);
            float k = clamp(uRef/-mv.z, 0.7, 1.6);            // tamaño con la distancia: las capas cercanas crecen al acercarse
            vA = mix(0.85, tw, uTw)*uA*min(1.0, k); vCol = aCol; gl_PointSize = max(1.0, aSize*k*uPx); }`,
        fragmentShader:`varying vec3 vCol; varying float vA;
          void main(){ float d = length(gl_PointCoord-0.5); float a = smoothstep(0.5, 0.0, d);
            gl_FragColor = vec4(vCol, a*vA); }`,
        transparent:true, depthWrite:false, blending:THREE.AdditiveBlending,
      });
      const pts = new THREE.Points(geo, mat);
      pts.renderOrder = -5; pts.frustumCulled = false;
      pts.userData.par = L.par;
      scene.add(pts);
      W.starLayers.push(pts);
    }
  }

  /* ------------------------------------------------------------ galaxias lejanas: manchitas tenues en el infinito */
  {
    const make = (kind, seed) => {
      const cv = document.createElement('canvas'); cv.width = cv.height = 128;
      const x = cv.getContext('2d'), rnd = mulberry(seed);
      const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
      g.addColorStop(0, 'rgba(255,241,222,0.9)'); g.addColorStop(0.12, 'rgba(255,220,190,0.45)');
      g.addColorStop(0.45, 'rgba(255,200,170,0.1)'); g.addColorStop(1, 'rgba(255,200,170,0)');
      x.fillStyle = g; x.fillRect(0, 0, 128, 128);
      if(kind === 'spiral'){
        for(let i=0;i<900;i++){
          const arm = i % 2, t = rnd(), th = arm*Math.PI + t*5.2 + (rnd() - 0.5)*0.5, r = 6 + t*50;
          const a = (1 - t)*0.22*rnd();
          x.fillStyle = `rgba(255,236,214,${a.toFixed(3)})`;
          x.beginPath(); x.arc(64 + Math.cos(th)*r, 64 + Math.sin(th)*r, 1 + rnd()*2.2, 0, TAU); x.fill();
        }
      }
      const t = new THREE.CanvasTexture(cv);
      return t;
    };
    const texs = [make('spiral', 3), make('spiral', 8), make('elliptical', 5)];
    const rnd = mulberry(23);
    const far = new THREE.Group();
    const tints = ['#fff1de', '#ffd2b8', '#bde7f7'];
    const _d = new THREE.Vector3();
    for(let i=0;i<9;i++){
      const u = rnd()*2 - 1, th = rnd()*TAU, s = Math.sqrt(1 - u*u);
      _d.set(Math.cos(th)*s, u, Math.sin(th)*s);
      const m = new THREE.SpriteMaterial({map:texs[i % 3], color:tints[i % 3], transparent:true, opacity:0.22 + rnd()*0.25,
        blending:THREE.AdditiveBlending, depthWrite:false, rotation:rnd()*TAU});
      const sp = new THREE.Sprite(m);
      const w = 12 + rnd()*20;
      sp.scale.set(w, w*(0.35 + rnd()*0.6), 1);   // inclinadas: unas de frente, otras de canto
      sp.position.copy(_d).multiplyScalar(820);
      far.add(sp);
    }
    far.renderOrder = -12;
    far.userData.par = 0;
    scene.add(far);
    W.farGalaxies = far;
  }
  // las capas acompañan a la cámara: par = 0 viaja con ella (infinito); par > 0 se queda un poco atrás (paralaje)
  function placeSkyLayers(){
    for(const o of W.starLayers) o.position.copy(camera.position).multiplyScalar(1 - o.userData.par);
    W.farGalaxies.position.copy(camera.position);
  }

  /* ------------------------------------------------------------ polvo del disco galáctico */
  {
    const N = 3200, rnd = mulberry(11);
    const pos = new Float32Array(N*3), col = new Float32Array(N*3), sz = new Float32Array(N);
    const warm = new THREE.Color('#ffb48c');
    for(let i=0;i<N;i++){
      const arm = i % 2;
      const r = 2.3 + Math.pow(rnd(), 0.85) * 19;
      const g = () => (rnd()+rnd()+rnd()-1.5);
      const th = arm*Math.PI + Math.log(r)*2.3 + g()*0.42*(1.2 - r/26);
      const y = g()*0.22*(1 + r*0.04);
      pos[i*3] = Math.cos(th)*r; pos[i*3+1] = y; pos[i*3+2] = Math.sin(th)*r;
      const t = clamp((r - 2)/16, 0, 1);
      const c = warm.clone().lerp(CELESTE, Math.pow(t, 0.8));
      if(rnd() < .12) c.lerp(CREMA, .7);
      col[i*3]=c.r; col[i*3+1]=c.g; col[i*3+2]=c.b;
      sz[i] = 0.5 + rnd()*rnd()*2.4;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos,3));
    geo.setAttribute('aCol', new THREE.BufferAttribute(col,3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sz,1));
    const mat = new THREE.ShaderMaterial({
      uniforms:{uTime:timeU, uProj:projU, uRot:rmUni(0, 1)},
      vertexShader:`attribute vec3 aCol; attribute float aSize; uniform float uTime, uProj, uRot; varying vec3 vCol; varying float vA;
        void main(){
          vec3 p = position; float r = length(p.xz);
          float a = uRot*uTime*0.05/sqrt(r/7.0);
          float c = cos(a), s = sin(a); p.xz = mat2(c, s, -s, c)*p.xz;
          vec4 mv = modelViewMatrix*vec4(p,1.0); gl_Position = projectionMatrix*mv;
          gl_PointSize = clamp(aSize*0.065*uProj/-mv.z, 0.8, 14.0);
          vCol = aCol; vA = 0.5*smoothstep(22.0, 12.0, r);
        }`,
      fragmentShader:`varying vec3 vCol; varying float vA;
        void main(){ float d = length(gl_PointCoord-0.5); float a = smoothstep(0.5, 0.05, d);
          gl_FragColor = vec4(vCol, a*vA); }`,
      transparent:true, depthWrite:false, blending:THREE.AdditiveBlending,
    });
    W.dust = new THREE.Points(geo, mat);
    scene.add(W.dust);
  }

  /* ------------------------------------------------------------ el Fogón (estrella central) */
  const fire = new THREE.Group();
  {
    const core = new THREE.Mesh(new THREE.SphereGeometry(1.25, 48, 36), new THREE.ShaderMaterial({
      uniforms:{uTime:timeU},
      vertexShader:`varying vec3 vN; varying vec3 vV; varying vec3 vOP;
        void main(){ vOP = normalize(position); vec4 mv = modelViewMatrix*vec4(position,1.0);
          vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
      fragmentShader:`uniform float uTime; varying vec3 vN; varying vec3 vV; varying vec3 vOP;
        ${NOISE}
        void main(){
          float g = fbm(vOP*3.6 + vec3(uTime*0.22, -uTime*0.16, 1.0));
          float g2 = fbm(vOP*9.0 - vec3(uTime*0.35, 0.0, uTime*0.25));
          float mu = max(dot(normalize(vN), normalize(vV)), 0.0);
          vec3 ember = vec3(1.0, 0.54, 0.36), honey = vec3(1.0, 0.86, 0.62), cream = vec3(1.0, 0.95, 0.87);
          vec3 c = mix(ember, honey, smoothstep(0.3, 0.7, g*0.65 + g2*0.35));
          c = mix(c, cream, pow(mu, 3.0)*0.55);
          c += ember*pow(1.0-mu, 2.0)*0.6;
          gl_FragColor = vec4(c, 1.0);
        }`,
    }));
    fire.add(core);
    const g1 = sprite(glowTex(), '#ff9a66', .95, 8.5);
    const g2 = sprite(glowTex(), '#ff8a5b', .22, 30);
    const g3 = sprite(glowTex(), '#ffb48c', .10, 58);
    const rays = sprite(raysTex(), '#ffb48c', .38, 14);
    fire.add(g1, g2, g3, rays);
    W.fire = {group:fire, core, g1, g2, rays, sq:{x:0, v:0}};
    scene.add(fire);
  }

  /* ------------------------------------------------------------ brasas que suben del fuego */
  {
    const N = 220, rnd = mulberry(5);
    const dir = new Float32Array(N*3), ph = new Float32Array(N), sp = new Float32Array(N);
    for(let i=0;i<N;i++){
      const u = rnd()*2-1, th = rnd()*TAU, s = Math.sqrt(1-u*u);
      dir[i*3] = Math.cos(th)*s; dir[i*3+1] = Math.abs(u)*0.6 + 0.2; dir[i*3+2] = Math.sin(th)*s;
      ph[i] = rnd(); sp[i] = 0.05 + rnd()*0.08;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(dir,3));
    geo.setAttribute('aPh', new THREE.BufferAttribute(ph,1));
    geo.setAttribute('aSp', new THREE.BufferAttribute(sp,1));
    const mat = new THREE.ShaderMaterial({
      uniforms:{uTime:timeU, uProj:projU, uOn:rmUni(0, 1)},
      vertexShader:`attribute float aPh; attribute float aSp; uniform float uTime, uProj, uOn; varying float vA; varying float vT;
        void main(){
          float t = fract(aPh + uTime*aSp);
          vec3 d = normalize(position);
          float sw = t*3.0 + aPh*6.28;
          vec3 p = d*(1.3 + t*3.8) + vec3(sin(sw)*0.4, t*t*3.2, cos(sw)*0.4);
          vec4 mv = modelViewMatrix*vec4(p,1.0); gl_Position = projectionMatrix*mv;
          gl_PointSize = clamp((1.0 - t)*0.2*uProj/-mv.z, 0.0, 12.0);
          vA = sin(3.14159*t) * (0.6 + 0.4*sin(uTime*9.0 + aPh*40.0)) * uOn; vT = t;
        }`,
      fragmentShader:`varying float vA; varying float vT;
        void main(){ float d = length(gl_PointCoord-0.5); float a = smoothstep(0.5, 0.0, d);
          vec3 c = mix(vec3(1.0, 0.95, 0.85), vec3(1.0, 0.55, 0.35), vT);
          gl_FragColor = vec4(c, a*vA*0.9); }`,
      transparent:true, depthWrite:false, blending:THREE.AdditiveBlending,
    });
    W.embers = new THREE.Points(geo, mat);
    scene.add(W.embers);
  }

  /* ------------------------------------------------------------ estelas (una sola llamada) */
  const trailGeo = new THREE.BufferGeometry();
  const trailPos = new Float32Array(MAX_BODIES*(TRAIL_K)*2*3);
  const trailCol = new Float32Array(MAX_BODIES*(TRAIL_K)*2*4);
  trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPos,3).setUsage(THREE.DynamicDrawUsage));
  trailGeo.setAttribute('aCol', new THREE.BufferAttribute(trailCol,4).setUsage(THREE.DynamicDrawUsage));
  const trails = new THREE.LineSegments(trailGeo, new THREE.ShaderMaterial({
    vertexShader:`attribute vec4 aCol; varying vec4 vCol;
      void main(){ vCol = aCol; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader:`varying vec4 vCol; void main(){ gl_FragColor = vCol; }`,
    transparent:true, depthWrite:false, blending:THREE.AdditiveBlending,
  }));
  trails.frustumCulled = false;
  scene.add(trails);

  /* ------------------------------------------------------------ banco del taller */
  const bench = new THREE.Group();
  bench.position.copy(BENCH);
  {
    const wheel = new THREE.Mesh(new THREE.RingGeometry(1.7, 1.78, 96), new THREE.MeshBasicMaterial({
      color:CELESTE, transparent:true, opacity:.28, blending:THREE.AdditiveBlending, depthWrite:false, side:THREE.DoubleSide}));
    wheel.rotation.x = -Math.PI/2; wheel.position.y = -1.9;
    const wheel2 = new THREE.Mesh(new THREE.RingGeometry(2.3, 2.33, 96), new THREE.MeshBasicMaterial({
      color:BRASA, transparent:true, opacity:.22, blending:THREE.AdditiveBlending, depthWrite:false, side:THREE.DoubleSide}));
    wheel2.rotation.x = -Math.PI/2; wheel2.position.y = -1.9;
    const back = sprite(glowTex(), '#1e6896', .26, 9);
    back.position.set(0, 0, -3);
    bench.add(wheel, wheel2, back);
    for(const o of [wheel, wheel2, back]) o.userData.op = o.material.opacity;
    W.benchDeco = {wheel, wheel2, back};
  }
  scene.add(bench);

  /* ------------------------------------------------------------ punto de lanzamiento + tirachinas
     El anillo marca en el plano el lugar exacto desde el que saldrá el astro (bajo la mirada del jugador). */
  const anchorGoal = new THREE.Vector3(7, 0, 0), anchor = new THREE.Vector3(7, 0, 0);
  const pad = new THREE.Group();
  pad.position.copy(anchor);
  {
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.2, 1.34, 72), new THREE.MeshBasicMaterial({
      color:BRASA, transparent:true, opacity:.8, blending:THREE.AdditiveBlending, depthWrite:false, side:THREE.DoubleSide}));
    ring.rotation.x = -Math.PI/2;
    const ring2 = new THREE.Mesh(new THREE.RingGeometry(1.62, 1.68, 72), new THREE.MeshBasicMaterial({
      color:CREMA, transparent:true, opacity:.25, blending:THREE.AdditiveBlending, depthWrite:false, side:THREE.DoubleSide}));
    ring2.rotation.x = -Math.PI/2;
    const glow = sprite(glowTex(), '#ff8a5b', .3, 5.5);
    pad.add(ring, ring2, glow);
    W.padDeco = {ring, ring2, glow};
  }
  pad.visible = false;
  scene.add(pad);
  const bandGeo = new THREE.BufferGeometry();
  bandGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3*3), 3));
  const band = new THREE.Line(bandGeo, new THREE.LineBasicMaterial({color:BRASA, transparent:true, opacity:.95}));
  band.visible = false; band.frustumCulled = false;
  scene.add(band);

  const PATH_N = 520;
  const pathGeo = new THREE.BufferGeometry();
  pathGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(PATH_N*3), 3).setUsage(THREE.DynamicDrawUsage));
  pathGeo.setAttribute('aI', new THREE.BufferAttribute(new Float32Array(PATH_N), 1).setUsage(THREE.DynamicDrawUsage));
  const pathMat = new THREE.ShaderMaterial({
    uniforms:{uPx:pxU, uN:{value:1}, uOut:{value:0}, uTime:timeU},
    vertexShader:`attribute float aI; uniform float uPx, uN, uOut, uTime; varying float vA; varying float vT;
      void main(){ vT = aI/max(uN,1.0); vec4 mv = modelViewMatrix*vec4(position,1.0); gl_Position = projectionMatrix*mv;
        float march = 0.5 + 0.5*sin(aI*0.9 - uTime*6.0);
        gl_PointSize = (2.2 + march*1.6)*uPx;
        vA = (1.0 - vT*0.75) * (0.55 + 0.45*march); }`,
    fragmentShader:`varying float vA; varying float vT; uniform float uOut;
      void main(){ float d = length(gl_PointCoord-0.5); float a = smoothstep(0.5, 0.1, d);
        // colores de estado (IDENTITY): órbita crema→celeste · se escapa: brasa · cae: lavanda · órbita larga que vuelve: menta
        vec3 c = mix(vec3(1.0,0.945,0.87), vec3(0.34,0.8,0.95), vT);
        if(uOut > 2.5) c = mix(c, vec3(0.5,0.88,0.77), smoothstep(0.2, 0.8, vT));
        else if(uOut > 1.5) c = mix(vec3(0.85,0.8,1.0), vec3(0.66,0.6,1.0), vT);
        else if(uOut > 0.5) c = mix(c, vec3(1.0,0.54,0.36), smoothstep(0.35, 0.9, vT));
        gl_FragColor = vec4(c, a*vA); }`,
    transparent:true, depthWrite:false, blending:THREE.AdditiveBlending,
  });
  const path = new THREE.Points(pathGeo, pathMat);
  path.visible = false; path.frustumCulled = false;
  scene.add(path);

  /* ------------------------------------------------------------ chispas (pool) */
  const BURST_N = 180;
  const burst = {pos:new Float32Array(BURST_N*3), vel:new Float32Array(BURST_N*3), life:new Float32Array(BURST_N),
    col:new Float32Array(BURST_N*3), next:0};
  const burstGeo = new THREE.BufferGeometry();
  burstGeo.setAttribute('position', new THREE.BufferAttribute(burst.pos,3).setUsage(THREE.DynamicDrawUsage));
  burstGeo.setAttribute('aLife', new THREE.BufferAttribute(burst.life,1).setUsage(THREE.DynamicDrawUsage));
  burstGeo.setAttribute('aCol', new THREE.BufferAttribute(burst.col,3).setUsage(THREE.DynamicDrawUsage));
  const burstPts = new THREE.Points(burstGeo, new THREE.ShaderMaterial({
    uniforms:{uProj:projU},
    vertexShader:`attribute float aLife; attribute vec3 aCol; uniform float uProj; varying float vA; varying vec3 vCol;
      void main(){ vec4 mv = modelViewMatrix*vec4(position,1.0); gl_Position = projectionMatrix*mv;
        gl_PointSize = clamp(aLife*0.3*uProj/-mv.z, 0.0, 24.0); vA = aLife; vCol = aCol; }`,
    fragmentShader:`varying float vA; varying vec3 vCol;
      void main(){ float d = length(gl_PointCoord-0.5); gl_FragColor = vec4(vCol, smoothstep(0.5,0.0,d)*vA); }`,
    transparent:true, depthWrite:false, blending:THREE.AdditiveBlending,
  }));
  burstPts.frustumCulled = false;
  scene.add(burstPts);
  function sparks(at, color, n = 26, speed = 2.2){
    if(RM) n = Math.ceil(n/3);
    const c = new THREE.Color(color);
    for(let k=0;k<n;k++){
      const i = burst.next; burst.next = (burst.next + 1) % BURST_N;
      const u = Math.random()*2-1, th = Math.random()*TAU, s = Math.sqrt(1-u*u), v = speed*(0.4 + Math.random()*0.8);
      burst.pos[i*3] = at.x; burst.pos[i*3+1] = at.y; burst.pos[i*3+2] = at.z;
      burst.vel[i*3] = Math.cos(th)*s*v; burst.vel[i*3+1] = u*v; burst.vel[i*3+2] = Math.sin(th)*s*v;
      burst.life[i] = 1; burst.col[i*3] = c.r; burst.col[i*3+1] = c.g; burst.col[i*3+2] = c.b;
    }
  }

  /* ------------------------------------------------------------ aurora: partículas 3D
     Tres cintas de chispas que corren a lo largo de caminos 3D. Cada cinta serpentea alrededor
     del fuego, sube y baja cruzando el disco (pasa por delante y por detrás de los astros) y
     levanta una cortina: base brasa, cuerpo menta, copa celeste. Las chispas fluyen de verdad
     (se ve el movimiento) y la ola crece de un extremo al otro antes de apagarse. */
  const AUR_N = RM ? 4800 : 9000;
  const aurU = {uTime:timeU, uProj:projU, uProg:{value:0}, uAmp:{value:0}, uRM:rmUni(1, 0)};
  {
    const rnd = mulberry(99);
    const u = new Float32Array(AUR_N), v = new Float32Array(AUR_N), r = new Float32Array(AUR_N), rib = new Float32Array(AUR_N);
    for(let i=0;i<AUR_N;i++){ u[i] = rnd(); v[i] = Math.pow(rnd(), 1.15); r[i] = rnd(); rib[i] = i % 3; }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(AUR_N*3), 3));
    geo.setAttribute('aU', new THREE.BufferAttribute(u,1));
    geo.setAttribute('aV', new THREE.BufferAttribute(v,1));
    geo.setAttribute('aR', new THREE.BufferAttribute(r,1));
    geo.setAttribute('aRib', new THREE.BufferAttribute(rib,1));
    const mat = new THREE.ShaderMaterial({
      uniforms:aurU,
      vertexShader:`attribute float aU; attribute float aV; attribute float aR; attribute float aRib;
        uniform float uTime, uProj, uProg, uAmp, uRM; varying float vA; varying vec3 vCol;
        void main(){
          float ph = aRib*2.094;
          float t = uTime;
          // rayos: las chispas se apilan en columnas verticales que viajan a lo largo de la cinta
          float col = floor(aU*150.0);
          float u0 = (col + 0.5 + (aR - 0.5)*0.3)/150.0;
          float u = uRM > 0.5 ? u0 : fract(u0 + t*(0.022 + aRib*0.005));
          // línea central de la cinta: arco que rodea el fuego y cruza el plano del disco
          float th = ph + (uRM > 0.5 ? 0.0 : uProg*1.1) + u*3.7;
          float rad = 7.2 + aRib*3.1 + 2.0*sin(u*6.5 + ph + t*0.13);
          float yc = 2.3*sin(u*5.2 + ph*1.7 + t*0.11) - 0.3;
          vec3 radial = vec3(cos(th), 0.0, sin(th));
          vec3 up = normalize(vec3(0.0, 1.0, 0.0) - radial*0.16);   // casi vertical: se ve de frente tanto del lado cercano como del lejano
          // la cortina: pliegues que ondulan como tela
          float hgt = 3.6 + 1.7*sin(u*10.0 + ph + t*0.27);
          float fold = sin(u*46.0 + t*0.9 + aRib)*0.32 + sin(u*16.0 - t*0.55 + aV*1.5)*0.55;
          vec3 p = radial*(rad + fold) + vec3(0.0, yc, 0.0) + up*(aV*hgt);
          p += vec3(sin(aR*91.0 + t*1.3), cos(aR*57.0 + t*1.1), sin(aR*23.0 - t))*0.07;
          vec4 mv = modelViewMatrix*vec4(p, 1.0);
          gl_Position = projectionMatrix*mv;
          bool spark = aR > 0.95;
          gl_PointSize = clamp((spark ? 0.38 : 0.16 + aR*0.19)*uProj/-mv.z, 2.0, spark ? 15.0 : 10.0);
          // la ola: crece de un extremo de la cinta al otro
          float head = uRM > 0.5 ? 2.0 : uProg*2.3;
          float win = smoothstep(head, head - 0.24, u) * smoothstep(0.0, 0.07, u) * smoothstep(1.0, 0.9, u);
          float tw = 0.55 + 0.45*sin(t*(2.0 + aR*3.0) + aR*40.0);
          // el borde de abajo brilla más (como en una aurora de verdad) y la copa se desvanece
          float hem = 1.0 + 0.5*smoothstep(0.1, 0.0, aV);
          float ray = 0.35 + 0.65*pow(0.5 + 0.5*sin(col*1.71 + aRib*3.0 + t*(0.6 + fract(col*0.37))), 2.0);
          vA = uAmp * win * (1.0 - aV*aV) * tw * hem * ray;
          vec3 base = vec3(1.0, 0.5, 0.36), body = vec3(0.42, 0.9, 0.74), crown = vec3(0.34, 0.8, 0.95);
          vCol = aV < 0.14 ? mix(base, body, aV/0.14) : mix(body, crown, smoothstep(0.2, 0.85, aV));
          if(spark){ vCol = vec3(1.0, 0.95, 0.87); vA *= 1.3; }
        }`,
      fragmentShader:`varying float vA; varying vec3 vCol;
        void main(){ float d = length(gl_PointCoord-0.5); float a = smoothstep(0.5, 0.22, d);   // núcleo sólido: un punto de 2 px se ve
          gl_FragColor = vec4(vCol, a*vA*0.82); }`,
      transparent:true, depthWrite:false, blending:THREE.AdditiveBlending,
    });
    W.aurora = new THREE.Points(geo, mat);
    W.aurora.frustumCulled = false; W.aurora.visible = false;
    scene.add(W.aurora);
  }
  let aurora = null;
  function startAurora(){
    if(aurora) return false;
    aurora = {t:0, dur: RM ? 9 : 12};
    W.aurora.visible = true;
    return true;
  }

  /* ================================================================ cámara */
  const rig = {
    target:new THREE.Vector3(), az:0.55, el:0.55, dist:40,
    goal:{target:new THREE.Vector3(), az:0.55, el:0.55, dist:40},
    shift:{x:0, y:0}, shiftGoal:{x:0, y:0},
    vAz:0, vEl:0, flight:null, idle:0, follow:null,
    lim:{elMin:0.08, elMax:1.45, dMin:5, dMax:110},
  };
  function camFromRig(target, az, el, dist, out){
    out.set(target.x + dist*Math.cos(el)*Math.sin(az), target.y + dist*Math.sin(el), target.z + dist*Math.cos(el)*Math.cos(az));
    return out;
  }
  const vfov = () => camera.fov*Math.PI/180;
  function fitDist(R){
    const a = camera.aspect, tv = Math.tan(vfov()/2), th = tv*a;
    const halfH = R + 1.5;
    return Math.max(R/th, halfH/tv) * 1.04 + R*0.15;
  }
  function views(){
    const portrait = camera.aspect < 0.9;
    const elHome = portrait ? 0.86 : 0.6;
    const benchType = W.benchBody ? W.benchBody.d.type : 'planet';
    const bd = (TYPE_INFO[benchType] || TYPE_INFO.planet).bench * (portrait ? 1.85 : 1.4);
    const fr = homeFrame(portrait ? 11 : 17.5);
    const home = {target:fr.target, az:0.42, el:elHome, dist:fitDist(fr.R, elHome), shift:{x:0, y: portrait ? 0.07 : 0.03}};
    W.homeDist = home.dist; rig.lim.dMax = Math.max(rig.lim.dMax, home.dist*1.25);
    return {
      home,
      workshop:{target:BENCH.clone(), az:0, el:0.16, dist:bd, shift: portrait ? {x:0, y:0.15} : {x:0.16, y:0.02}},
      // R6: se lanza desde la vista que el jugador tenía de la galaxia (la última), no desde una vista fija
      launch: galaxyView ? {...galaxyView, target:galaxyView.target.clone(), shift:{...galaxyView.shift}} : home,
    };
  }
  // la última vista de la galaxia que eligió el jugador (al irse al taller se recuerda)
  let galaxyView = null;
  // Include travellers as well as systems; the camera follows the complete visible galaxy.
  function homeFrame(base){
    const frame=galaxyFrame(sim.bodies,base);
    const disc=base*1.08;
    return {target:new THREE.Vector3(...frame.centre),R:Math.min(frame.radius,disc)};
  }
  // Stored orbits can sit far outside the painted spiral. Draw them inside it; the record stays as it is.
  function paintSkyPoint(out){
    const base=camera.aspect<0.9?11:17.5;
    const frame=galaxyFrame(sim.bodies,base);
    const disc=base;
    if(!(frame.radius>disc*1.08))return out;
    const centre=frame.centre,dx=out[0]-centre[0],dy=out[1]-centre[1],dz=out[2]-centre[2];
    const distance=Math.hypot(dx,dy,dz);
    const shown=paintedDistance(distance,frame.radius/1.08,disc);
    const k=distance>0?shown/distance:1;
    out[0]=centre[0]+dx*k;out[1]=centre[1]+dy*k;out[2]=centre[2]+dz*k;
    return out;
  }
  function rememberView(){
    galaxyView = {target:rig.goal.target.clone(), az:rig.goal.az, el:rig.goal.el, dist:rig.goal.dist, shift:{...rig.shiftGoal}};
  }
  function flyTo(v, dur = 2.2){
    const from = {target:rig.target.clone(), az:rig.az, el:rig.el, dist:rig.dist};
    if(RM) dur = Math.min(dur, 0.4);
    rig.flight = {from, to:{target:v.target.clone(), az:v.az, el:v.el, dist:v.dist}, t:0, dur};
    rig.goal.target.copy(v.target); rig.goal.az = v.az; rig.goal.el = v.el; rig.goal.dist = v.dist;
    rig.shiftGoal = {...v.shift};
    rig.vAz = rig.vEl = 0;
    rig.follow = null; rig.keep = null;
  }
  function snapTo(v){
    rig.target.copy(v.target); rig.az = v.az; rig.el = v.el; rig.dist = v.dist;
    rig.goal.target.copy(v.target); rig.goal.az = v.az; rig.goal.el = v.el; rig.goal.dist = v.dist;
    rig.shift = {...v.shift}; rig.shiftGoal = {...v.shift}; rig.flight = null;
  }
  const _cam = new THREE.Vector3(), _kp = new THREE.Vector3();
  function updateRig(dt){
    rig.idle += dt;
    if(rig.flight){
      const f = rig.flight; f.t += dt;
      const k = clamp(f.t/f.dur, 0, 1), e = ease(k);
      rig.target.lerpVectors(f.from.target, f.to.target, e);
      rig.az = f.from.az + angDiff(f.from.az, f.to.az)*e;
      rig.el = f.from.el + (f.to.el - f.from.el)*e;
      // anticipación: la grúa se aleja un poco antes de llegar
      rig.dist = (f.from.dist + (f.to.dist - f.from.dist)*e) * (1 + (RM ? 0 : 0.14)*Math.sin(Math.PI*k));
      if(k >= 1){ rig.flight = null; rig.goal.az = rig.az; }
    } else {
      if(rig.follow){
        const fp = rig.follow.root.position;
        rig.goal.target.lerp(fp, 1 - Math.exp(-dt*3));
      }
      // recién lanzado: durante 2 s la cámara lo mantiene en cuadro (sin centrarlo), después devuelve el control
      if(rig.keep){
        rig.keep.t -= dt;
        const s = project(rig.keep.body.root.position);
        const mx = Math.abs(s.x/W.vw - 0.5), my = Math.abs(s.y/W.vh - 0.5);
        if(s.behind || mx > 0.34 || my > 0.32){
          _kp.copy(rig.keep.body.root.position); _kp.y = 0;
          rig.goal.target.lerp(_kp, 1 - Math.exp(-dt*0.9));
          rig.goal.dist = Math.min(rig.lim.dMax, rig.keep.d0*1.45, rig.goal.dist*(1 + dt*0.18));
        }
        if(rig.keep.t <= 0) rig.keep = null;
      }
      // inercia del arrastre: se desliza un buen rato, como sobre hielo
      if(Math.abs(rig.vAz) > 1e-4 || Math.abs(rig.vEl) > 1e-4){
        rig.goal.az += rig.vAz*dt; rig.goal.el = clamp(rig.goal.el + rig.vEl*dt, rig.lim.elMin, rig.lim.elMax);
        rig.vAz *= Math.exp(-dt*1.9); rig.vEl *= Math.exp(-dt*2.4);
      }
      // deriva ociosa: la galaxia nunca se queda quieta (entra de a poco, sin tirón)
      if(!RM && W.mode === 'home' && !drag) rig.goal.az += dt*0.026*clamp((rig.idle - 2.5)/3, 0, 1);
      // la cámara persigue su meta con retardo blando (antes 8: se sentía rígida)
      const k = 1 - Math.exp(-dt*4.2);
      rig.target.lerp(rig.goal.target, k);
      rig.az += angDiff(rig.az, rig.goal.az)*k;
      rig.el += (rig.goal.el - rig.el)*k;
      rig.dist += (rig.goal.dist - rig.dist)*k;
    }
    const ks = 1 - Math.exp(-dt*(RM ? 12 : 3.2));
    rig.shift.x += (rig.shiftGoal.x - rig.shift.x)*ks;
    rig.shift.y += (rig.shiftGoal.y - rig.shift.y)*ks;
    // respiración pasiva + paralaje del puntero/inclinación
    const breathe = RM ? 0 : Math.sin(W.t*0.21)*0.012;
    const par = RM ? {x:0,y:0} : W.parallax;
    camFromRig(rig.target, rig.az + par.x*0.035, rig.el + breathe + par.y*0.02, rig.dist, _cam);
    camera.position.copy(_cam);
    const far=Math.max(1200,rig.dist+galaxyFrame(sim.bodies).radius*2);
    if(camera.far!==far){camera.far=far;camera.updateProjectionMatrix();}
    camera.lookAt(rig.target);
    const w = W.vw, h = W.vh;
    camera.setViewOffset(w, h, rig.shift.x*w, rig.shift.y*h, w, h);
  }
  W.parallax = {x:0, y:0};

  /* ================================================================ entradas (astros)
     Una entrada es lo que se ve (malla, estela, nombre); su física es un cuerpo de la simulación con el
     mismo id. Nunca se borra un astro de otro para hacer lugar: si la galaxia está llena, el lanzamiento
     se rechaza con el diseño guardado (solo los juguetes de "lanzar por lanzar" se apagan solos). */
  function makeEntry(sb, {design, name, mine = false, born = Date.now(), maker, toy = false, life = 0, scale0}){
    const body = new Body(design, {lod:'low'});
    const scale = toy && design.meteor ? GALAXY_SCALE*0.5 : GALAXY_SCALE;
    body.root.scale.setScalar(scale0 || scale);
    body.scaleNow = 1;
    const e = {id:sb.id, body, sb, design:{...body.d}, name, mine, born, maker, toy, scaleGoal:scale,
      dieAt: toy && life ? W.t + life : 0, dying:0,
      trail:{buf:new Float32Array(TRAIL_K*3), n:0, head:0, acc:0}};
    if(sb.comet) body.setComet(true);   // R8: la simulación decide quién puede ser cometa
    body.root.position.set(...sb.p);
    scene.add(body.root);
    if(!toy){e.marker=sprite(glowTex(),['star','binary','pulsar'].includes(design.type)?'#ffb48c':'#bde7f7',1,1);e.marker.visible=false;scene.add(e.marker);}
    W.entries.push(e);
    return e;
  }
  // launch: un lanzamiento de jugador (pasa por los presupuestos y queda en el registro de acciones)
  // maker: quién lo lanzó ({name, anon}); su nombre flota tenue sobre el astro (R3)
  function addEntry({design, p, v, name, mine = false, born = Date.now(), comet = false, maker, toy = false, life = 0, scale0, group, launch = false}){
    const spec = {type:design.type, meteor:!!design.meteor, toy, group, p, v, comet};
    let sb;
    if(launch && !toy){ const r = sim.launch(spec, {owner:W.owner, now:Date.now()}); if(!r.ok) return null; sb = r.body; }
    else sb = toy && W.shared ? toySim.add(spec) : sim.add(spec);
    const e = makeEntry(sb, {design, name, mine, born, maker, toy, life, scale0});
    if(toy){
      const toys = W.entries.filter(x => x.toy && !x.dying);
      if(toys.length > TOY_MAX) retire(toys[0]);
    }
    if(W.entries.length > MAX_BODIES){ const old = W.entries.find(x => x.toy); if(old) removeEntry(old); }
    return e;
  }
  function removeEntry(e){
    if(e.marker){scene.remove(e.marker);e.marker.material.dispose();}
    scene.remove(e.body.root); e.body.dispose(); (e.toy && W.shared ? toySim : sim).remove(e.sb);
    W.entries = W.entries.filter(x => x !== e);
    if(W.lastLaunched === e) W.lastLaunched = null;
  }
  // un juguete que se va: se encoge con una lluvia de chispas y desaparece
  function retire(e){
    if(e.dying) return;
    e.dying = 0.001;
    e.body.scaleGoal = 0.001;
    sparks(e.body.root.position, '#7fe0c4', 12, 1.0);
  }
  const entryOf = sb => sb && W.entries.find(x => x.sb === sb);
  const posOf = sb => sb === sim.central ? SUN.clone() : new THREE.Vector3(...sb.p);
  // R12: cada golpe se ve distinto según quién recibe (efecto elegido por la simulación)
  const FX = {
    frost:  {c:['#7fe0c4', '#fff1de'], n:22, s:1.0, sq:.22},
    chips:  {c:['#d6cde3', '#fff1de'], n:14, s:1.5, sq:.25},
    crater: {c:['#fff1de', '#ffd2b0'], n:10, s:0.8, sq:.3},
    storm:  {c:['#ff8a5b', '#56ccf2'], n:26, s:1.3, sq:.45},
    squash: {c:['#fff1de', '#ffb48c'], n:12, s:0.9, sq:.38},
    sparkle:{c:['#fff1de', '#7fe0c4'], n:10, s:0.9, sq:.15},
    pass:   {c:['#56ccf2', '#bde7f7'], n:8,  s:0.5, sq:0},
  };
  function reframe(d){
    // la simulación corrió su marco (entró o salió un compacto): la cámara lo absorbe y se desliza de vuelta
    const v = new THREE.Vector3(...d);
    rig.target.add(v);
    if(rig.flight) rig.flight.from.target.add(v);
    if(galaxyView) galaxyView.target.add(v);
    anchor.add(v); anchorGoal.add(v);
    for(const e of W.entries){ const b = e.trail.buf; for(let i = 0; i < e.trail.n; i++){ const j = ((e.trail.head - 1 - i) % TRAIL_K + TRAIL_K) % TRAIL_K; b[j*3] += v.x; b[j*3+1] += v.y; b[j*3+2] += v.z; } }
    for(const list of skyState.snaps.values()) for(const s of list) if(s.k < skyState.k){ s.p[0] += v.x; s.p[1] += v.y; s.p[2] += v.z; }
    for(let i = 0; i < BURST_N; i++) if(burst.life[i] > 0){ burst.pos[i*3] += v.x; burst.pos[i*3+1] += v.y; burst.pos[i*3+2] += v.z; }
  }
  sim.on((type, sb, extra) => {
    if(type === 'reframe'){ reframe(extra.d); return; }
    const e = entryOf(sb);
    if(type === 'binary' || type === 'system' || type === 'kiss'){
      // compactos: el Fogón no es una entrada (es el fuego)
      const o = extra.other ? entryOf(extra.other) : null;
      const at = posOf(sb);
      sparks(at, type === 'system' ? '#7fe0c4' : '#fff1de', type === 'system' ? 40 : 26, 1.6);
      if(extra.other) sparks(posOf(extra.other), '#ffb48c', 18, 1.2);
      if(e) e.body.squash(.35); if(o) o.body.squash(.35);
      if(extra.other === sim.central || sb === sim.central) W.fire.sq.v += 2;
      emit(type, e || {fire:true, sb}, {...extra, other:o || (extra.other === sim.central ? {fire:true} : null)});
      return;
    }
    if(!e) return;
    if(type === 'comet'){
      e.body.setComet(true);
      if(extra.first) sparks(e.body.root.position, '#fff1de', 30, 1.6);
    }
    if(type === 'puff'){
      const by = extra.by, at = posOf(by);
      if(by === sim.central) W.fire.sq.v += 3;
      else { const be = entryOf(by); if(be) be.body.squash(.3); }
      if(extra.effect === 'accrete'){ for(let k = 0; k < 3; k++) sparks(at, k === 1 ? '#56ccf2' : '#ff8a5b', 14, 1.4 + k*0.5); }
      sparks(e.body.root.position, extra.effect === 'beam' ? '#bde7f7' : '#ff8a5b', 40, 2.8);
      e.body.squash(.45, e.body.root.position.clone().sub(at).normalize());
      if(sb.comet) e.body.setComet(true);
    }
    // vuelve de lejos siendo lo que es (una estrella, un agujero negro): un destello al dar la vuelta
    if(type === 'return' && extra.first) sparks(e.body.root.position, '#fff1de', 22, 1.2);
    if(type === 'capture') sparks(e.body.root.position, '#7fe0c4', 24, 1.1);
    if(type === 'assist'){ const n = entryOf(extra.nebula); sparks(e.body.root.position, '#a99bff', 18, 0.7); if(n) n.body.pulseGlow(.8); }
    if(type === 'sling') sparks(e.body.root.position, '#bde7f7', 16, 1.6);
    if(type === 'impact'){
      const o = entryOf(extra.other);
      const fx = FX[extra.effect] || FX.squash;
      const at = e.body.root.position.clone().lerp(o ? o.body.root.position : e.body.root.position, 0.5);
      sparks(at, fx.c[0], fx.n, fx.s); sparks(at, fx.c[1], Math.ceil(fx.n/2), fx.s*0.6);
      const tgt = entryOf(extra.target), hit = entryOf(extra.hitter);
      if(fx.sq){ if(tgt) tgt.body.squash(fx.sq); if(hit) hit.body.squash(.3); }
      if(extra.effect === 'pass' && tgt) tgt.body.pulseGlow(.5);
      emit('impact', e, {...extra, other:o});
      return;
    }
    emit(type, e, extra);
  });
  // la órbita de un astro respecto de su sistema (para su ficha y para la tarjeta de resultado)
  function orbitOf(e){
    const sb = e.sb;
    if(sb.mode === 'n'){
      // un compacto: su pareja si es binaria; si no, el centro de su propio sistema (o un viajero)
      const own = sim.systems.find(x => x.prim.includes(sb.id));
      if(own && own.prim.length === 2){
        const o = sim.byId(own.prim.find(id => id !== sb.id)), oe = entryOf(o);
        const el = elements([sb.p[0] - o.p[0], sb.p[1] - o.p[1], sb.p[2] - o.p[2]], [sb.v[0] - o.v[0], sb.v[1] - o.v[1], sb.v[2] - o.v[2]], 15*(sb.m + o.m));
        return {el, r:Math.hypot(sb.p[0] - o.p[0], sb.p[2] - o.p[2]), mode:'n', partner:oe ? oe.name : null, partnerFire:o === sim.central};
      }
      if(own && own.founded) return {el:{e:0, period:Infinity, inc:0}, r:0, mode:'n', own:true, members:sim.membersOf(own.id).filter(b => !b.toy).length};
    }
    const s = sb.mode === 'rail' ? sim.sysById.get(sb.host) : sim.hostAt(sb.p, sb.mode === 'n' ? sb : null);
    if(!s || !s.p) return {el:elements(sb.p, sb.v), r:Math.hypot(...sb.p)};
    const rel = [sb.p[0] - s.p[0], sb.p[1] - s.p[1], sb.p[2] - s.p[2]], rv = [sb.v[0] - s.v[0], sb.v[1] - s.v[1], sb.v[2] - s.v[2]];
    return {el:elements(rel, rv, s.mu + (sb.mode === 'n' ? 15*sb.m : 0)), r:Math.hypot(...rel), mode:sb.mode, host:s.id};
  }

  /* ---------------------------------------------------------------- sistemas: el mapa crece (R5) */
  W.extent = 17.5;
  let followSys = null;
  function updateExtent(dt){
    let ext = 17.5;
    for(const s of sim.systems) if(s.founded) ext = Math.max(ext, Math.hypot(s.p[0], s.p[2]) + 17.5);
    W.extent += (ext - W.extent)*(1 - Math.exp(-dt*0.6));
    rig.lim.dMax = Math.max(110, W.extent*4.5, (W.homeDist || 0)*1.25);
    if(followSys){
      const s = sim.sysById.get(followSys);
      if(s) rig.goal.target.lerp(_kp.set(s.p[0], 0, s.p[2]), 1 - Math.exp(-dt*2)); else followSys = null;
    }
  }
  function systemsInfo(){
    return sim.systems.filter(s => s.founded).map(s => {
      const prim = s.prim.map(id => sim.byId(id));
      return {id:s.id, p:[...s.p], members:sim.membersOf(s.id).filter(b => !b.toy).length, fire:prim.includes(sim.central),
        names:prim.map(b => entryOf(b)).filter(Boolean).map(x => x.name), kinds:prim.map(b => b.kind)};
    });
  }
  function flyToSystem(id){
    const s = sim.sysById.get(id); if(!s) return;
    const v = views().home;
    flyTo({...v, target:new THREE.Vector3(s.p[0], 0, s.p[2]), dist:fitDist(portraitR(), v.el)}, RM ? 0.4 : 2);
    setTimeout(() => { followSys = id; }, RM ? 400 : 2000);
  }
  const portraitR = () => camera.aspect < 0.9 ? 11 : 17.5;

  /* ---------------------------------------------------------------- guardar y cargar la galaxia */
  const SKY_HZ = 120, SKY_DELAY = 16, SKY_JUMP = 90;
  const skyState = {k:-1, clock:null, r:null, snaps:new Map()}, _sky = [0, 0, 0], _orb = {p:[0, 0, 0], v:[0, 0, 0]};
  const skyNow = () => performance.now()/1000;
  const skyClock = () => W.replay?skyState.k:skyState.clock ? skyState.clock.tick + (skyNow() - skyState.clock.at)*SKY_HZ : skyState.k;
  function noteSkyState(k){
    // a short rewind (a late launch re-simulated) keeps drawing what was shown until the sky passes it again
    if(!W.replay && k <= skyState.k && skyState.k - k <= SKY_JUMP) return false;
    const jump = skyState.k < 0 || (W.replay && k<skyState.k) || Math.abs(k - skyState.k) > SKY_JUMP, want = skyClock();
    skyState.clock = jump || Math.abs(k - want) > 60 ? {tick:k, at:skyNow()} : {tick:want + (k - want)*0.1, at:skyNow()};
    if(jump) skyState.r = null;
    skyState.k = k;
    if(jump) skyState.snaps.clear();
    for(const b of sim.bodies){
      let list = skyState.snaps.get(b.id);
      if(!list) skyState.snaps.set(b.id, list = []);
      list.push({k, p:[...b.p], v:[...b.v]});
      if(list.length > 3) list.shift();
    }
    for(const id of [...skyState.snaps.keys()]) if(!sim.byId(id)) skyState.snaps.delete(id);
    return jump;
  }
  // the drawn sky time advances with each frame's own (display-paced) step and leans gently toward the sky clock
  function skyTick(dtRaw){
    if(W.replay){skyState.r=skyState.k;return;}
    const want = skyClock() - SKY_DELAY;
    skyState.r = skyState.r === null || Math.abs(want - skyState.r) > 30 ? want : skyState.r + dtRaw*SKY_HZ + (want - skyState.r)*0.04;
  }
  function skyPos(sb, out){
    const list = W.shared && skyState.r !== null && skyState.snaps.get(sb.id);
    if(!list || !list.length){ out[0] = sb.p[0]; out[1] = sb.p[1]; out[2] = sb.p[2]; return paintSkyPoint(out); }
    const r = skyState.r;
    let i = list.length - 1;
    while(i > 0 && list[i].k > r) i--;
    const a = list[i], b = list[i + 1];
    if(r <= a.k){ out[0] = a.p[0]; out[1] = a.p[1]; out[2] = a.p[2]; return paintSkyPoint(out); }
    if(!b){
      // past the newest state: coast along its velocity for at most a quarter second
      const t = Math.min(r - a.k, 30)/SKY_HZ;
      for(let j = 0; j < 3; j++) out[j] = a.p[j] + a.v[j]*t;
      return paintSkyPoint(out);
    }
    const h = (b.k - a.k)/SKY_HZ, u = (r - a.k)/(b.k - a.k), u2 = u*u, u3 = u2*u;
    const h00 = 2*u3 - 3*u2 + 1, h10 = u3 - 2*u2 + u, h01 = -2*u3 + 3*u2, h11 = u3 - u2;
    for(let j = 0; j < 3; j++) out[j] = h00*a.p[j] + h10*h*a.v[j] + h01*b.p[j] + h11*h*b.v[j];
    return paintSkyPoint(out);
  }
  // a whole trail from the orbit itself: the path this body flew in the last seconds (never before its launch)
  function orbitTrail(e){
    const sb = e.sb, tr = e.trail;
    const s = sb.mode === 'rail' ? sim.sysById.get(sb.host) : sim.hostAt(sb.p, sb.mode === 'n' ? sb : null);
    const hp = s && s.p ? s.p : [0, 0, 0], hv = s && s.v ? s.v : [0, 0, 0];
    const mu = s && s.p ? s.mu + (sb.mode === 'n' ? 15*sb.m : 0) : 15;
    const r0 = [sb.p[0] - hp[0], sb.p[1] - hp[1], sb.p[2] - hp[2]], v0 = [sb.v[0] - hv[0], sb.v[1] - hv[1], sb.v[2] - hv[2]];
    const age = e.born ? Math.max(0, (Date.now() - e.born)/1000) : Infinity;
    const n = Math.min(TRAIL_K, Math.floor(age/TRAIL_EVERY) + 1);
    tr.n = 0; tr.head = 0; tr.acc = 0;
    if(n < 2 || !(mu > 0) || ![...r0, ...v0].every(Number.isFinite) || Math.hypot(...r0) < 1e-6) return;
    for(let i = 0; i < n; i++){
      const o = propagate(r0, v0, mu, -(n - 1 - i)*TRAIL_EVERY, _orb);
      if(![...o.p].every(Number.isFinite)){ tr.n = 0; return; }
      const painted=paintSkyPoint([hp[0]+o.p[0],hp[1]+o.p[1],hp[2]+o.p[2]]);
      tr.buf[i*3] = painted[0]; tr.buf[i*3+1] = painted[1]; tr.buf[i*3+2] = painted[2];
    }
    tr.head = n % TRAIL_K; tr.n = n;
  }
  function applySharedState(state, norm, owner){
    const ids = new Set(state.entries.map(e=>e.id));
    for(const e of [...W.entries]) if(!e.toy && !ids.has(e.id)) removeEntry(e);
    sim.restore(state.sim);restoreCoordinates(sim,state.sim);
    W.sharedHomes = new Map(state.homes);
    for(const m of state.entries){
      let e = W.entries.find(e=>!e.toy && e.id===m.id);
      const design = norm(m.design);
      if(!e){ e = makeEntry(sim.byId(m.id), {...m, design, mine:m.owner===owner}); }
      else {
        e.sb = sim.byId(m.id);
        if(JSON.stringify(e.design)!==JSON.stringify(design)){ e.body.setDesign(design); e.design=design; }
      }
      e.logical=m.logical; e.home=m.home;
    }
    const firstSky = skyState.k < 0;
    const jump=noteSkyState(state.sim.steps);
    if(jump) for(const e of W.entries) if(!e.toy) orbitTrail(e);
    if((firstSky || (W.replay && jump && homeAuto)) && W.mode === 'home' && !rig.follow) flyTo(views().home,firstSky?0:(RM?0:0.25));
    else if(homeAuto && W.mode==='home' && !rig.follow && !rig.keep){
      const view=views().home;
      if(view.dist>rig.goal.dist*1.03 || view.target.distanceTo(rig.goal.target)>view.dist*.05)flyTo(view,RM?0:0.25);
    }
    return W.entries.filter(e=>!e.toy);
  }
  function completeSharedLaunch(entry,res){
    if(W.benchBody){scene.remove(W.benchBody.root); W.benchBody.dispose();}
    W.benchBody=null; W.benchState='gone'; W.lastLaunched=entry;
    sparks(entry.body.root.position, '#ff8a5b', 34, 3.2);
    emit('launch', {...res,entry,entries:[entry],toy:false});
  }
  function failSharedLaunch(){W.benchState='pad'; settleBack=.3; emit('shared-denied');}
  function serialize(){
    const snap = sim.snapshot();
    const toyIds = new Set(W.entries.filter(e => e.toy).map(e => e.id));
    snap.bodies = snap.bodies.filter(b => !toyIds.has(b.id));
    snap.contacts = snap.contacts.filter(([k]) => !k.replace('a', '').split(':').some(x => toyIds.has(+x)));
    return {v:2, saved:Date.now(), sim:snap,
      entries:W.entries.filter(e => !e.toy).map(e => ({id:e.id, design:e.design, name:e.name, mine:e.mine, born:e.born, maker:e.maker}))};
  }
  function loadGalaxy(state, norm = d => d){
    for(const e of [...W.entries]) removeEntry(e);
    sim.restore(state.sim);
    const meta = new Map((state.entries || []).map(m => [m.id, m]));
    for(const sb of [...sim.bodies]){
      if(sb === sim.central) continue;
      const m = meta.get(sb.id);
      if(!m || !m.design || !TYPE_INFO[m.design.type]){ sim.remove(sb); continue; }
      makeEntry(sb, {...m, design:norm(m.design)});
    }
  }

  // estelas: muestreo en tiempo de simulación
  function sampleTrails(dt){
    for(const e of W.entries){
      const tr = e.trail;
      tr.acc += dt;
      if(tr.acc >= TRAIL_EVERY || tr.n === 0){
        tr.acc = 0;
        const q = e.body.root.position;
        tr.buf[tr.head*3] = q.x; tr.buf[tr.head*3+1] = q.y; tr.buf[tr.head*3+2] = q.z;
        tr.head = (tr.head + 1) % TRAIL_K; tr.n = Math.min(TRAIL_K, tr.n + 1);
      }
    }
  }
  // the largest step between neighbouring trail samples (a cut trail shows a long chord)
  function trailGap(e){
    const tr = e.trail; let gap = 0;
    for(let i = 1; i < tr.n; i++){
      const a = ((tr.head - i) % TRAIL_K + TRAIL_K) % TRAIL_K, b = ((tr.head - i - 1) % TRAIL_K + TRAIL_K) % TRAIL_K;
      gap = Math.max(gap, Math.hypot(tr.buf[a*3] - tr.buf[b*3], tr.buf[a*3+1] - tr.buf[b*3+1], tr.buf[a*3+2] - tr.buf[b*3+2]));
    }
    return gap;
  }
  const _c = new THREE.Color();
  function writeTrails(){
    let o = 0, oc = 0;
    for(const e of W.entries){
      const tr = e.trail; if(tr.n < 2) continue;
      const mine = e.mine;
      const isComet = e.sb.comet;
      // brasa = lo tuyo · menta = lo que va y vuelve (cometas, juguetes) · celeste = lo de los demás
      _c.copy(mine ? BRASA : (isComet || e.toy) ? MENTA : CELESTE);
      const base = (mine ? 0.85 : e.toy ? 0.55 : isComet ? 0.5 : 0.36) * (e.dying ? Math.max(0, 1 - e.dying*1.4) : 1);
      const n = tr.n;
      const idx = i => ((tr.head - n + i) % TRAIL_K + TRAIL_K) % TRAIL_K;
      for(let i=0;i<n;i++){
        const a = idx(i);
        const ax = tr.buf[a*3], ay = tr.buf[a*3+1], az = tr.buf[a*3+2];
        let bx, by, bz;
        if(i < n-1){ const b = idx(i+1); bx = tr.buf[b*3]; by = tr.buf[b*3+1]; bz = tr.buf[b*3+2]; }
        else { const q = e.body.root.position; bx = q.x; by = q.y; bz = q.z; }
        trailPos[o++] = ax; trailPos[o++] = ay; trailPos[o++] = az;
        trailPos[o++] = bx; trailPos[o++] = by; trailPos[o++] = bz;
        const fa = Math.pow(i/n, 1.6)*base, fb = Math.pow((i+1)/n, 1.6)*base;
        trailCol[oc++] = _c.r*fa; trailCol[oc++] = _c.g*fa; trailCol[oc++] = _c.b*fa; trailCol[oc++] = fa;
        trailCol[oc++] = _c.r*fb; trailCol[oc++] = _c.g*fb; trailCol[oc++] = _c.b*fb; trailCol[oc++] = fb;
      }
    }
    trailGeo.setDrawRange(0, o/3);
    trailGeo.attributes.position.needsUpdate = true;
    trailGeo.attributes.aCol.needsUpdate = true;
  }

  /* ================================================================ banco: tu astro */
  W.benchBody = null;
  W.benchState = 'none'; // none | bench | toPad | pad | aiming | gone
  function setBenchDesign(d, {pop} = {}){
    if(!W.benchBody || W.benchState === 'gone' || W.benchState === 'none'){
      const b = new Body(d);
      b.root.position.copy(BENCH);
      b.scaleNow = 0.001; b.scaleGoal = 1;
      scene.add(b.root);
      W.benchBody = b; W.benchState = 'bench';
      b.manualSpin = false;
      return 'new';
    }
    const kind = W.benchBody.setDesign(d);
    if(kind === 'rebuild' && pop !== false){
      W.benchBody.scaleNow = 0.55; W.benchBody.scaleGoal = 1;
      W.benchBody.squash(.35);
      sparks(W.benchBody.root.position, '#fff1de', 22, 2.4);
    } else {
      W.benchBody.squash(.12);
    }
    return kind;
  }
  // rotación con el dedo (taller): el dedo deja "giro pendiente" y el astro lo alcanza con
  // un retardo corto; se siente pesado y blando en vez de pegado al dedo
  const spinVel = new THREE.Vector2(), spinPend = new THREE.Vector2();
  let spinIdle = 9, spinAcc = 0, spinDragging = false;
  const _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion(), _ax = new THREE.Vector3();
  function rotateBench(dxRad, dyRad){ spinPend.x += dxRad; spinPend.y += dyRad; }
  function applySpin(dt){
    const b = W.benchBody; if(!b) { spinPend.set(0, 0); return; }
    const k = 1 - Math.exp(-dt*13);
    const dx = spinPend.x*k, dy = spinPend.y*k;
    spinPend.x -= dx; spinPend.y -= dy;
    if(Math.abs(dx) + Math.abs(dy) < 1e-6) return;
    _ax.set(0,1,0); _qa.setFromAxisAngle(_ax, dx);
    _ax.set(1,0,0).applyQuaternion(camera.quaternion); _qb.setFromAxisAngle(_ax, dy);
    b.spin.quaternion.premultiply(_qa).premultiply(_qb);
    spinAcc += Math.hypot(dx, dy);
    if(spinAcc > 0.7){ spinAcc = 0; emit('rotate-note', Math.min(1, Math.hypot(spinVel.x, spinVel.y)/8)); }
  }

  // banco → punto de lanzamiento (R6): ya no hay animación de "ubicarlo en una órbita". El astro viaja en
  // línea recta con la misma curva que la cámara, así que se queda delante de ti mientras la galaxia
  // aparece, y llega al punto del plano que estás mirando (que sigue a la cámara mientras vuela).
  let hop = null;
  function moveBenchToPad(dur = 2.2){
    const b = W.benchBody; if(!b) return;
    W.benchState = 'toPad';
    pad.visible = true;
    const from = b.root.position.clone();
    hop = {t:0, dur: RM ? 0.4 : dur, from, live:true, s0:b.root.scale.x, s1:PAD_SCALE};
  }
  function moveBenchBack(){
    const b = W.benchBody; if(!b) return;
    W.benchState = 'toBench';
    const from = b.root.position.clone(), to = BENCH.clone();
    const ctrl = from.clone().lerp(to, 0.5).add(new THREE.Vector3(0, 7, 0));
    hop = {t:0, dur: RM ? 0.45 : 2.0, from, to, ctrl, s0:b.root.scale.x, s1:1, back:true};
  }

  /* lanzar por lanzar: cometas, asteroides y lluvias directo a la plataforma, sin taller.
     Lo que tenías en el banco espera guardado y vuelve al salir. */
  let stash = null;
  W.toss = false; W.padToy = null;
  function enterToss(){
    if(W.toss) return;
    W.toss = true;
    hop = null;
    if(W.benchBody && W.benchState !== 'gone' && W.benchState !== 'none'){
      stash = W.benchBody;
      stash.root.position.copy(BENCH); stash.root.scale.setScalar(1); stash.root.visible = false;
    }
    W.benchBody = null; W.benchState = 'none';
    pad.visible = true;
  }
  function exitToss(){
    if(!W.toss) return;
    aimCancel();
    W.toss = false;
    if(W.benchBody && W.padToy){ scene.remove(W.benchBody.root); W.benchBody.dispose(); }
    W.padToy = null;
    W.benchBody = stash; W.benchState = stash ? 'bench' : 'none';
    if(stash) stash.root.visible = true;
    stash = null;
  }
  function loadToy(design, {shower = 0} = {}){
    if(!W.toss) return;
    if(W.benchBody && W.padToy){ scene.remove(W.benchBody.root); W.benchBody.dispose(); }
    aim.active = false; band.visible = false; path.visible = false;
    const b = new Body(design);
    restPos(b.root.position);
    b.root.scale.setScalar(PAD_SCALE);
    b.scaleNow = 0.001; b.scaleGoal = 1;
    scene.add(b.root);
    W.benchBody = b; W.benchState = 'pad'; W.padToy = {shower};
    b.squash(.4);
    sparks(b.root.position, '#7fe0c4', 16, 1.4);
    pad.visible = true;
    emit('landed', {toy:true});
  }
  const _hp = new THREE.Vector3();
  function restPos(out){ return out.copy(anchor).setY(anchor.y + LIFT); }
  function updateHop(dt){
    if(!hop) return;
    const b = W.benchBody;
    hop.t += dt;
    const k = clamp(hop.t/hop.dur, 0, 1), e = ease(k), u = 1 - e;
    if(hop.live) b.root.position.lerpVectors(hop.from, restPos(_hp), e);
    else b.root.position.set(
      u*u*hop.from.x + 2*u*e*hop.ctrl.x + e*e*hop.to.x,
      u*u*hop.from.y + 2*u*e*hop.ctrl.y + e*e*hop.to.y,
      u*u*hop.from.z + 2*u*e*hop.ctrl.z + e*e*hop.to.z);
    b.root.scale.setScalar(hop.s0 + (hop.s1 - hop.s0)*e);
    if(k >= 1){
      const back = hop.back; hop = null;
      if(back){ W.benchState = 'bench'; pad.visible = false; }
      else { W.benchState = 'pad'; b.squash(.4); sparks(b.root.position, '#ff8a5b', 18, 1.4); emit('landed'); }
    }
  }

  /* ================================================================ puntería y lanzamiento (R6)
     Se tira de una banda en la pantalla: desde el astro o desde cualquier punto de la mitad de abajo.
     La dirección del tirón se lleva al plano galáctico con la base de la cámara (derecha y "adelante",
     sin componente vertical), así que se lanza en cualquier dirección: prógrado, retrógrado o radial,
     y la órbita queda plana. La fuerza no tiene tope brusco: v = VK·s/(1+s), con s = tirón/referencia.
     Alejar la cámara no multiplica el impulso (el tirón se mide en píxeles, no en mundo). */
  const aim = {active:false, sx:0, sy:0, cx:0, cy:0, px:0, py:0, s:0, fine:1, strength:0, vel:new THREE.Vector3(), pred:null, predAt:0, dirty:false};
  const VK = 6.5;                 // rapidez límite (unidades/s): bajo el tope de 8 de la nota
  const _r = new THREE.Vector3(), _u = new THREE.Vector3(), _f = new THREE.Vector3(), _fw = new THREE.Vector3();
  const _r2 = new THREE.Vector3(), _u2 = new THREE.Vector3(), _hv = new THREE.Vector3();
  function maxPull(){ return Math.min(W.vw, W.vh) * 0.45; }
  const speedFor = s => VK*s/(1 + s);
  function planeBasis(){
    camera.updateMatrixWorld();
    _r.setFromMatrixColumn(camera.matrixWorld, 0).setY(0);
    _u.setFromMatrixColumn(camera.matrixWorld, 1).setY(0);
    _fw.setFromMatrixColumn(camera.matrixWorld, 2).negate().setY(0);
    if(_r.lengthSq() < 1e-8) _r.set(1, 0, 0);
    _r.normalize();
    const f = _fw.lengthSq() > _u.lengthSq() ? _fw : _u;   // mirando desde arriba, "adelante" es el arriba de la pantalla
    f.normalize();
    return {right:_r, fwd:f};
  }
  // el punto del plano bajo la mirada; si el rayo va casi rasante, una proyección fija desde el blanco de la cámara
  const ray = new THREE.Raycaster(), _ndc = new THREE.Vector2(), _ap = new THREE.Vector3();
  const LAUNCH_RMAX = 30;
  function computeAnchor(out){
    camera.updateMatrixWorld();
    _ndc.set(ANCHOR_SCREEN.x*2 - 1, -(ANCHOR_SCREEN.y*2 - 1));
    ray.setFromCamera(_ndc, camera);
    const o = ray.ray.origin, d = ray.ray.direction;
    if(d.y < -0.06) out.copy(o).addScaledVector(d, -o.y/d.y);
    else { const {fwd} = planeBasis(); out.copy(rig.target).setY(0).addScaledVector(fwd, -6); }
    const h = sim.hostAt([out.x, 0, out.z]);
    _ap.set(out.x - h.p[0], 0, out.z - h.p[2]);
    let r = _ap.length();
    if(r < 1e-3){ const {fwd} = planeBasis(); _ap.copy(fwd).negate(); r = 1; }
    const rr = clamp(r, LAUNCH_RMIN, LAUNCH_RMAX);
    out.set(h.p[0] + _ap.x/r*rr, 0, h.p[2] + _ap.z/r*rr);
    return out;
  }
  function launchHost(){ restPos(_hp); return sim.hostAt([_hp.x, _hp.y, _hp.z]); }
  function aimUpdate(cx, cy){
    aim.cx = cx; aim.cy = cy;
    const dx = cx - aim.sx, dy = cy - aim.sy, M = maxPull();
    aim.px = dx; aim.py = dy;
    aim.s = Math.hypot(dx, dy)/M*aim.fine;
    aim.strength = aim.s/(1 + aim.s);
    const {right, fwd} = planeBasis();
    const dir = _f.set(0, 0, 0).addScaledVector(right, -dx).addScaledVector(fwd, dy);   // tirachinas: al revés del tirón
    if(dir.lengthSq() < 1e-6) dir.copy(fwd);
    dir.normalize();
    const h = launchHost();
    aim.vel.copy(dir).multiplyScalar(speedFor(aim.s)).add(_hv.set(h.v[0], 0, h.v[2]));   // más el movimiento del sistema
    // el astro sigue al tirón en el plano de la pantalla (la goma se satura a la vista, la fuerza no)
    const L = Math.hypot(dx, dy), cap = M*1.15, k = L > cap ? cap/L : 1;
    const b = W.benchBody;
    restPos(_hp);
    const wpp = 2*camera.position.distanceTo(_hp)*Math.tan(vfov()/2)/W.vh;
    _r2.setFromMatrixColumn(camera.matrixWorld, 0); _u2.setFromMatrixColumn(camera.matrixWorld, 1);
    b.root.position.copy(_hp).addScaledVector(_r2, dx*k*wpp).addScaledVector(_u2, -dy*k*wpp);
    // banda: dos postes a los lados del punto de lanzamiento
    const pa = bandGeo.attributes.position, post = 1.2*Math.max(1, wpp*60);
    pa.setXYZ(0, _hp.x - _r2.x*post, _hp.y - _r2.y*post, _hp.z - _r2.z*post);
    pa.setXYZ(1, b.root.position.x, b.root.position.y, b.root.position.z);
    pa.setXYZ(2, _hp.x + _r2.x*post, _hp.y + _r2.y*post, _hp.z + _r2.z*post);
    pa.needsUpdate = true;
    band.visible = true;
    aim.dirty = true;
    if(performance.now() - aim.predAt > 70) runPredict();
  }
  // la trayectoria prevista: a lo sumo ~14 veces por segundo mientras se arrastra
  function runPredict(){
    aim.dirty = false; aim.predAt = performance.now();
    restPos(_hp);
    const p0 = [_hp.x, _hp.y, _hp.z], v0 = [aim.vel.x, aim.vel.y, aim.vel.z];
    const bd = W.benchBody ? W.benchBody.d : {type:'planet'};
    const pr = predict(sim, p0, v0, {seconds:40, dt:1/45, every:4, type:bd.type, meteor:!!bd.meteor});
    const n = Math.min(PATH_N, pr.pts.length/3);
    const pp = pathGeo.attributes.position, pi = pathGeo.attributes.aI;
    for(let i=0;i<n;i++){ pp.setXYZ(i, pr.pts[i*3], pr.pts[i*3+1], pr.pts[i*3+2]); pi.setX(i, i); }
    pp.needsUpdate = true; pi.needsUpdate = true;
    pathGeo.setDrawRange(0, n);
    pathMat.uniforms.uN.value = n;
    pathMat.uniforms.uOut.value = {escape:1, fall:2, long:3}[pr.outcome] || 0;
    path.visible = aim.s > 0.04;
    const end = new THREE.Vector3(pr.pts[(n-1)*3], pr.pts[(n-1)*3+1], pr.pts[(n-1)*3+2]);
    const h = launchHost();
    const el = pr.el || elements([p0[0] - h.p[0], p0[1] - h.p[1], p0[2] - h.p[2]], [v0[0] - h.v[0], v0[1] - h.v[1], v0[2] - h.v[2]], h.mu);
    void h;
    aim.pred = {...pr, end, el};
    emit('aim', {strength:aim.strength, outcome:pr.outcome, el, compact:!!pr.compact, end:project(end)});
  }
  function aimCancel(){
    aim.active = false; band.visible = false; path.visible = false;
    if(W.benchBody && W.benchState === 'aiming'){ W.benchState = 'pad'; settleBack = 0.25; }
  }
  let settleBack = 0;
  function release(){
    aim.active = false;
    const b = W.benchBody;
    band.visible = false; path.visible = false;
    if(aim.s < 0.06){ W.benchState = 'pad'; settleBack = 0.3; emit('aim-cancel'); return null; }
    if(aim.dirty || !aim.pred) runPredict();
    band.visible = false; path.visible = false;
    if(W.shared && !W.padToy){
      if(W.readOnly){ emit('shared-denied'); return null; }
      const p0 = restPos(new THREE.Vector3());
      W.benchState = 'launching';
      emit('shared-pending');
      W.requestLaunch({name:W.pendingName, design:{...b.d}, origin:[p0.x,p0.z], velocity:[aim.vel.x,aim.vel.z],
        system:launchHost().id, strength:aim.strength, el:aim.pred.el, outcome:aim.pred.outcome, compact:!!aim.pred.compact});
      return null;
    }
    // presupuestos (R7): si no se admite, el astro se queda en la mano, con su diseño intacto
    if(!W.padToy){
      restPos(_hp);
      const ok = sim.admit({type:b.d.type, meteor:!!b.d.meteor, owner:W.owner, now:Date.now(), p:[_hp.x, _hp.y, _hp.z]});
      if(!ok.ok){ W.benchState = 'pad'; settleBack = 0.3; emit('launch-denied', ok); return null; }
    }
    // la banda suelta: el astro parte del punto marcado en el plano con la velocidad del gesto
    const v = aim.vel.clone();
    const p0 = restPos(new THREE.Vector3());
    const d = {...b.d};
    const s0 = b.root.scale.x;
    const toy = W.padToy;
    scene.remove(b.root); b.dispose();
    W.benchBody = null; W.benchState = 'gone'; W.padToy = null;
    const n = toy && toy.shower ? toy.shower : 1;
    const list = [], group = ++launchGroup;
    for(let i=0;i<n;i++){
      // una lluvia se abre en abanico en el plano: cada piedrita con su propio rumbo y su propia órbita
      const vv = v.clone(), pp = p0.clone();
      let dd = d;
      if(n > 1){
        vv.applyAxisAngle(_Y, (i/(n - 1) - 0.5)*0.42).multiplyScalar(0.9 + Math.random()*0.2);
        pp.add(new THREE.Vector3((Math.random() - .5)*0.6, 0, (Math.random() - .5)*0.6));
        dd = {...d, size:0.12 + Math.random()*0.3, pal:(Math.random()*3)|0, tail:0.4 + Math.random()*0.3, seed:(Math.random()*999)|0};
      }
      const e = addEntry({design:dd, p:[pp.x, pp.y, pp.z], v:[vv.x, vv.y, vv.z], name:W.pendingName, maker:W.pendingMaker,
        mine:!toy, toy:!!toy, life: n > 1 ? 9 + Math.random()*4 : 75, scale0: n > 1 ? undefined : s0, group: n > 1 ? group : 0, launch:true});
      e.body.squash(.55, vv.clone().normalize());
      e.trail.n = 0;
      e.launchedAt = W.t;
      e.launchPred = aim.pred;
      list.push(e);
    }
    sparks(p0, toy ? '#7fe0c4' : '#ff8a5b', 34, 3.2);
    pad.visible = true;
    W.lastLaunched = list[0];
    rig.keep = {body:list[0].body, t:2, d0:rig.goal.dist};
    return {entry:list[0], entries:list, toy:!!toy, strength:aim.strength, el:aim.pred.el, outcome:aim.pred.outcome, compact:!!aim.pred.compact};
  }
  // para las pruebas: el tirón en pantalla (px) que lanza en la dirección (dx, dz) del plano con esa rapidez
  function pullFor(dx, dz, speed){
    const {right, fwd} = planeBasis();
    const L = Math.hypot(dx, dz) || 1, ux = dx/L, uz = dz/L;
    const P = speed/(VK - speed)*maxPull();
    return {x:-(ux*right.x + uz*right.z)*P, y:(ux*fwd.x + uz*fwd.z)*P};
  }
  function launchInfo(){
    restPos(_hp);
    const h = launchHost(), r = Math.hypot(_hp.x - h.p[0], _hp.z - h.p[2]);
    return {anchor:[_hp.x, _hp.y, _hp.z], host:[...h.p], r, vc:Math.sqrt(h.mu/r), vesc:Math.sqrt(2*h.mu/r)};
  }
  const _Y = new THREE.Vector3(0, 1, 0);
  let launchGroup = 0;

  /* ================================================================ entrada (puntero) */
  const pointers = new Map();
  let drag = null, pinch = null;
  function onDown(ev){
    canvas.setPointerCapture(ev.pointerId);
    pointers.set(ev.pointerId, {x:ev.clientX, y:ev.clientY, x0:ev.clientX, y0:ev.clientY, t0:performance.now()});
    rig.idle = 0;
    if(pointers.size === 2){
      // dos dedos: pellizco (si se estaba apuntando, se cancela)
      if(aim.active){ aimCancel(); emit('aim-cancel'); }
      const [a, b] = [...pointers.values()];
      pinch = {d0:Math.hypot(a.x-b.x, a.y-b.y), dist0: W.mode === 'workshop' ? benchZoom : rig.goal.dist};
      drag = null;
      return;
    }
    if(pointers.size > 2) return;
    const x = ev.clientX, y = ev.clientY;
    if(W.mode === 'launch' && W.benchState === 'pad' && W.benchBody && !hop){
      // R6: se tira desde el astro o desde cualquier punto de la mitad de abajo (un pulgar basta);
      // arrastrar arriba sigue moviendo la cámara, y con ella el punto de lanzamiento
      const ps = project(W.benchBody.root.position);
      const near = Math.hypot(ps.x - x, ps.y - y) < Math.max(70, W.vw*0.1);
      if(near || y > W.vh*0.45){
        aim.active = true; W.benchState = 'aiming'; aim.fine = 1;
        aim.sx = near ? ps.x : x; aim.sy = near ? ps.y : y;
        drag = {kind:'aim'};
        rig.vAz = rig.vEl = 0;
        emit('aim-start');
        aimUpdate(x, y);
        return;
      }
    }
    drag = {kind: W.mode === 'workshop' ? 'spin' : 'orbit', lx:x, ly:y, lt:performance.now()};
    if(drag.kind === 'spin'){ spinDragging = true; spinVel.set(0,0); emit('spin-start'); }
    rig.vAz = rig.vEl = 0;
  }
  function onMove(ev){
    const p = pointers.get(ev.pointerId); if(!p) return;
    p.x = ev.clientX; p.y = ev.clientY;
    if(pinch && pointers.size >= 2){
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x-b.x, a.y-b.y);
      const ratio = pinch.d0 / Math.max(20, d);
      if(W.mode === 'workshop') benchZoom = clamp(pinch.dist0*ratio, 0.7, 1.45);
      else { rig.goal.dist = clamp(pinch.dist0*ratio, rig.lim.dMin, rig.lim.dMax); emit('camera-user'); }
      return;
    }
    if(!drag) return;
    if(drag.kind === 'aim'){ aimUpdate(p.x, p.y); return; }
    const now = performance.now(), dtm = Math.max(8, now - drag.lt);
    const dx = p.x - drag.lx, dy = p.y - drag.ly;
    drag.lx = p.x; drag.ly = p.y; drag.lt = now;
    if(drag.kind === 'spin'){
      const k = 0.011;
      rotateBench(dx*k, dy*k);
      spinVel.set(dx*k/(dtm/1000), dy*k/(dtm/1000));
      spinIdle = 0;
      return;
    }
    const k = 0.0065;
    if(Math.hypot(p.x - p.x0, p.y - p.y0) > 6){
      rig.follow = W.mode === 'home' ? rig.follow : null;
      rig.goal.az -= dx*k;
      rig.goal.el = clamp(rig.goal.el + dy*k, rig.lim.elMin, rig.lim.elMax);
      rig.vAz = -dx*k/(dtm/1000)*0.8; rig.vEl = dy*k/(dtm/1000)*0.7;
      if(rig.flight){ rig.flight = null; }
      emit('camera-user');
    }
  }
  function onUp(ev){
    const p = pointers.get(ev.pointerId);
    pointers.delete(ev.pointerId);
    if(pointers.size < 2) pinch = null;
    if(!p) return;
    if(drag && drag.kind === 'aim'){
      drag = null;
      if(ev.type === 'pointercancel'){ aimCancel(); emit('aim-cancel'); return; }
      const res = release();
      if(res) emit('launch', res);
      return;
    }
    if(drag && drag.kind === 'spin'){ spinDragging = false; spinIdle = 0; }
    const moved = Math.hypot(p.x - p.x0, p.y - p.y0), dur = performance.now() - p.t0;
    drag = null;
    if(moved < 9 && dur < 400 && pointers.size === 0) tap(p.x, p.y);
  }
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  canvas.addEventListener('wheel', ev => {
    ev.preventDefault();
    rig.idle = 0;
    // apuntando: la rueda afina la fuerza sin mover el ratón
    if(aim.active){ aim.fine = clamp(aim.fine*Math.exp(-ev.deltaY*0.0012), 0.35, 3); aimUpdate(aim.cx, aim.cy); return; }
    const f = Math.exp(ev.deltaY*0.0012);
    if(W.mode === 'workshop') benchZoom = clamp(benchZoom*f, 0.7, 1.45);
    else { rig.goal.dist = clamp(rig.goal.dist*f, rig.lim.dMin, rig.lim.dMax); emit('camera-user'); }
  }, {passive:false});
  let benchZoom = 1;

  function tap(x, y){
    if(W.mode === 'workshop'){
      if(W.benchBody){ W.benchBody.squash(.38); W.benchBody.pulseGlow(.8); emit('pet-bench'); }
      return;
    }
    // ¿el fuego?
    const sp = project(SUN);
    let best = null, bd = Infinity;
    for(const e of W.entries){
      const s = project(e.body.root.position);
      if(s.behind) continue;
      const rpx = pxRadius(e.body.root.position, e.body.visR);
      const d = Math.hypot(s.x - x, s.y - y);
      if(d < Math.max(28, rpx + 14) && d < bd){ bd = d; best = e; }
    }
    if(best){
      best.body.squash(.42); best.body.pulseGlow(1);
      sparks(best.body.root.position, best.mine ? '#ff8a5b' : '#bde7f7', 14, 1.2);
      emit('tap-body', best);
      return;
    }
    if(Math.hypot(sp.x - x, sp.y - y) < Math.max(40, pxRadius(SUN, 1.4))){
      W.fire.sq.v += 2.4; sparks(SUN, '#ffb48c', 30, 2.4);
      emit('tap-fire');
      return;
    }
    emit('tap-empty');
  }
  function focus(e){
    followSys = null;
    if(!e){ rig.follow = null; return; }
    rig.follow = e.body;
    rig.goal.dist = clamp(Math.max(9, e.body.visR*24), rig.lim.dMin, Math.max(rig.goal.dist*0.8, 12));
    rig.goal.el = clamp(rig.goal.el, 0.35, 0.8);
  }

  /* ================================================================ utilidades */
  const _p = new THREE.Vector3();
  function project(v){
    _p.copy(v).project(camera);
    return {x:(_p.x*0.5 + 0.5)*W.vw, y:(-_p.y*0.5 + 0.5)*W.vh, behind:_p.z > 1};
  }
  function pxRadius(pos, r){
    const d = camera.position.distanceTo(pos);
    return r/(d*Math.tan(vfov()/2)) * W.vh/2;
  }
  function resize(){
    const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight;
    W.vw = w; W.vh = h;
    renderer.setPixelRatio(dprCap);
    renderer.setSize(w, h, false);
    camera.aspect = w/h;
    camera.fov = w/h < 0.9 ? 52 : 46;
    camera.updateProjectionMatrix();
    W.px = renderer.getPixelRatio();
    pxU.value = W.px;
    projU.value = h*W.px/(2*Math.tan(camera.fov*Math.PI/360));
  }

  /* ================================================================ modos */
  // keep: la cámara se queda donde está (galaxia ↔ lanzamiento: es la misma vista del jugador)
  function setMode(mode, {dur, instant, keep} = {}){
    const prev = W.mode;
    if(mode === 'workshop' && prev !== 'workshop') rememberView();
    // galaxia ↔ lanzamiento es la misma vista; del taller se vuelve a la última vista de la galaxia
    if((mode === 'home' && prev === 'launch') || (mode === 'launch' && prev === 'home')) keep = true;
    W.mode = mode;if(mode==='home'&&!keep)homeAuto=true;
    const v = mode === 'home' && prev === 'workshop' && galaxyView ? views().launch : views()[mode];
    if(mode === 'workshop') benchZoom = 1;
    // The bench is the thing being designed. A flight left the first frames on the far galaxy.
    if(typeof document !== 'undefined'){
      if(mode === 'workshop') document.body.dataset.workshopFocus = 'near';
      else delete document.body.dataset.workshopFocus;
    }
    if(keep){ rig.flight = null; rig.shiftGoal = {...views().home.shift}; }
    else if(instant || mode === 'workshop') snapTo(v); else flyTo(v, dur ?? 2.2);
    if(mode !== 'launch'){ aimCancel(); }
    rig.idle = 0;
  }
  function recenter(){ homeAuto=true;followSys = null; flyTo(views().home, 1.4); }
  // volver a la galaxia después de lanzar: sin vuelo de cámara, solo seguir al astro
  function homeFocus(e){
    W.mode = 'home';
    rig.flight = null;
    if(e) focus(e);
  }
  function isOffHome(){
    const v = views().home;
    return Math.abs(angDiff(rig.goal.az, v.az)) > 0.6 || Math.abs(rig.goal.el - v.el) > 0.3 || Math.abs(rig.goal.dist - v.dist)/v.dist > 0.35 || !!rig.follow;
  }

  /* ================================================================ bucle */
  const ctxBody = {dt:0, light:new THREE.Vector3(), sun:SUN, mode:'galaxy', rm:RM, aurora:0, px:1};
  let frames = 0, slowAcc = 0, slowN = 0;
  function frame(dtRaw){
    document.body.dataset.benchState=W.benchState;
    const dt = Math.min(dtRaw, 0.05);
    W.t += dt; timeU.value = W.t;
    if(W.shared) toySim.advance(dt); else sim.advance(dt);
    updateExtent(dt);
    // marco baricéntrico: el Fogón se mece un poco cuando algo pesado lo acompaña
    if(W.shared && skyState.k >= 0) skyTick(dtRaw);
    skyPos(sim.central, _sky); SUN.set(_sky[0], _sky[1], _sky[2]);
    fire.position.copy(SUN);
    W.dust.position.copy(SUN); W.embers.position.copy(SUN);
    sampleTrails(dt);
    // aurora
    let aurAmp = 0;
    if(aurora){
      aurora.t += dt;
      const k = aurora.t/aurora.dur;
      aurAmp = Math.min(1, aurora.t/1.4) * Math.min(1, Math.max(0, (aurora.dur - aurora.t)/2.4));
      aurU.uProg.value = k; aurU.uAmp.value = aurAmp;
      if(k >= 1){ aurora = null; W.aurora.visible = false; emit('aurora-end'); }
    }
    // astros de la galaxia
    ctxBody.dt = dt; ctxBody.light.copy(SUN); ctxBody.mode = 'galaxy'; ctxBody.aurora = aurAmp; ctxBody.px = W.px; ctxBody.proj = projU.value;
    ctxBody.cam = camera.position;
    let dead = null;
    for(const e of W.entries){
      if(e.toy) e.body.root.position.set(e.sb.p[0], e.sb.p[1], e.sb.p[2]);
      else { skyPos(e.sb, _sky); e.body.root.position.set(_sky[0], _sky[1], _sky[2]); }
      // recién lanzado: se encoge despacio de la escala de la plataforma a la de la galaxia
      const rs = e.body.root.scale.x;
      if(Math.abs(rs - e.scaleGoal) > 1e-3) e.body.root.scale.setScalar(rs + (e.scaleGoal - rs)*(1 - Math.exp(-dt*1.1)));
      if(e.toy){
        e.body.vel = e.sb.v;
        if(e.dieAt && W.t > e.dieAt) retire(e);
        if(e.dying && (e.dying += dt) > 1.3) (dead ||= []).push(e);
      }
      e.body.update(ctxBody);
    }
    if(dead) dead.forEach(removeEntry);
    // tu astro en el banco / plataforma
    updateHop(dt);
    applySpin(dt);
    const b = W.benchBody;
    if(b){
      if(W.benchState === 'bench' || W.benchState === 'toBench'){
        ctxBody.light.copy(KEY_LIGHT); ctxBody.mode = 'bench';
        if(!spinDragging){
          spinIdle += dt;
          if(spinVel.lengthSq() > 1e-4){ rotateBench(spinVel.x*dt, spinVel.y*dt); spinVel.multiplyScalar(Math.exp(-dt*1.5)); }
        }
        b.manualSpin = spinDragging || spinIdle < 1.6;
        if(W.benchState === 'bench' && !RM) b.root.position.y = BENCH.y + Math.sin(W.t*1.1)*0.06;
      } else {
        // en la plataforma se ilumina desde el fuego y desde tu lado: nunca queda a contraluz
        ctxBody.light.copy(SUN).lerp(camera.position, W.benchState === 'toPad' ? 0.3 : 0.55); ctxBody.mode = 'galaxy';
        b.manualSpin = false;
        if(W.benchState === 'pad' || W.benchState === 'launching'){
          const rest = restPos(_hp).setY(LIFT + (RM ? 0 : Math.sin(W.t*2)*0.08));
          b.root.position.lerp(rest, settleBack > 0 ? 0.35 : 1);
          settleBack = Math.max(0, settleBack - dt);
        }
      }
      b.root.visible = !(W.mode === 'home' && (W.benchState === 'bench' || W.benchState === 'toBench'));
      b.update(ctxBody);
    }
    // banco: rueda de alfarero; solo existe cerca del taller (de lejos flotaba en el espacio como un objeto raro)
    W.benchDeco.wheel.rotation.z += dt*0.25; W.benchDeco.wheel2.rotation.z -= dt*0.12;
    {
      const near = clamp((36 - camera.position.distanceTo(BENCH))/12, 0, 1);
      bench.visible = near > 0.01;
      for(const m of ['wheel', 'wheel2', 'back']){ const o = W.benchDeco[m]; o.material.opacity = o.userData.op*near; }
    }
    if(b && W.mode === 'workshop'){
      const v = views().workshop;
      rig.goal.dist = v.dist*benchZoom;
      if(!rig.flight) rig.goal.target.copy(BENCH);
    }
    // punto de lanzamiento: sigue a la mirada (salvo mientras se apunta); el anillo lo marca en el plano
    if(W.mode === 'launch' || W.benchState === 'toPad'){
      if(!aim.active){ computeAnchor(anchorGoal); anchor.lerp(anchorGoal, hop ? 1 : 1 - Math.exp(-dt*7)); }
      else if(aim.dirty && performance.now() - aim.predAt > 70) runPredict();
      pad.position.copy(anchor);
    }
    if(pad.visible){
      const pulse = RM ? 0.8 : 0.65 + Math.sin(W.t*3)*0.25;
      // la plataforma toma el color de lo que se lanza: brasa lo tuyo, menta lo que es por jugar
      const padCol = W.toss ? MENTA : BRASA;
      W.padDeco.ring.material.color.lerp(padCol, 0.08); W.padDeco.glow.material.color.lerp(padCol, 0.08);
      band.material.color.copy(W.padDeco.ring.material.color);
      W.padDeco.ring.material.opacity = pulse*(W.benchState === 'aiming' ? 1 : 0.85);
      W.padDeco.ring2.scale.setScalar(1 + (RM ? 0 : (W.t*0.6 % 1)*0.6));
      W.padDeco.ring2.material.opacity = RM ? .2 : 0.3*(1 - (W.t*0.6 % 1));
      if(W.mode !== 'launch' && W.benchState !== 'toPad') pad.visible = false;
    }
    // el Fogón: respira y chisporrotea suave
    const f = W.fire;
    f.sq.v += (-60*f.sq.x - 7*f.sq.v)*dt; f.sq.x += f.sq.v*dt;
    const flick = RM ? 0 : (Math.sin(W.t*2.3)*0.5 + Math.sin(W.t*5.1 + 1)*0.3)*0.03;
    const k = clamp(f.sq.x, -0.4, 0.5);
    f.core.scale.set(1 - k*0.4 + flick, 1 + k + flick, 1 - k*0.4 + flick);
    f.g1.material.opacity = 0.85 + flick*3;
    f.g1.scale.setScalar(8.5*(1 + k*0.5 + flick));
    if(!RM) f.rays.material.rotation += dt*0.03;
    // chispas
    let anyB = false;
    for(let i=0;i<BURST_N;i++){
      if(burst.life[i] <= 0) continue;
      anyB = true;
      burst.life[i] = Math.max(0, burst.life[i] - dt*1.1);
      burst.vel[i*3] *= 0.97; burst.vel[i*3+1] *= 0.97; burst.vel[i*3+2] *= 0.97;
      burst.pos[i*3] += burst.vel[i*3]*dt; burst.pos[i*3+1] += burst.vel[i*3+1]*dt; burst.pos[i*3+2] += burst.vel[i*3+2]*dt;
    }
    burstPts.visible = anyB;
    if(anyB){ burstGeo.attributes.position.needsUpdate = true; burstGeo.attributes.aLife.needsUpdate = true; burstGeo.attributes.aCol.needsUpdate = true; }

    writeTrails();
    updateRig(dt);
    for(const entry of W.entries){
      if(!entry.marker)continue;
      const pos=entry.body.root.position,distance=pos.distanceTo(camera.position);
      const marker=distantMarker(pxRadius(pos,entry.body.visR),distance,W.vh,camera.fov);
      entry.marker.visible=W.mode==='home'&&marker.visible;
      if(entry.marker.visible){entry.marker.position.copy(pos);entry.marker.scale.setScalar(marker.scale);entry.marker.material.opacity=marker.opacity;}
    }
    placeSkyLayers();
    renderer.render(scene, camera);

    // presupuesto: si el teléfono sufre, bajamos resolución (una vez por escalón)
    frames++;
    if(dtRaw > 0 && dtRaw < 0.25){ slowAcc += dtRaw; slowN++; }
    if(slowN >= 90){
      const avg = slowAcc/slowN; slowAcc = 0; slowN = 0;
      if(avg > 0.026 && dprCap > 1 && quality !== 'high'){ dprCap = Math.max(1, dprCap - 0.35); resize(); }
    }
    W.fps += ((dtRaw > 0 ? 1/dtRaw : 60) - W.fps)*0.05;
    emit('frame', dt);
  }

  // precalentar: unos segundos de historia para que las estelas existan al abrir
  function warm(seconds){
    const steps = Math.round(seconds*30);
    for(let i=0;i<steps;i++){ sim.advance(1/30); sampleTrails(1/30); }
  }

  /* ================================================================ preferencias en vivo (R16) */
  function setMotion(rm){
    RM = W.rm = ctxBody.rm = !!rm;
    for(const [u, calm, full] of rmU) u.value = RM ? calm : full;
  }
  // calidad: 'low' = resolución 1× y sin estelas largas; 'high' = hasta 2× y sin bajar sola; 'auto' = 1.75× y baja si sufre
  let quality = 'auto';
  function setQuality(q){
    quality = q === 'low' || q === 'high' ? q : 'auto';
    const dpr = window.devicePixelRatio || 1;
    dprCap = quality === 'low' ? 1 : quality === 'high' ? Math.min(dpr, 2) : Math.min(dpr, 1.75);
    resize();
  }

  /* ================================================================ nombres sobre los astros (R3)
     Lo que js/ui/labels.js necesita por astro, en píxeles CSS del lienzo. Se reutilizan los objetos. */
  const _lp = new THREE.Vector3(), labelPool = [];
  function labelItems(focused){
    const out = [];
    const near = camera.near;
    let k = 0;
    for(const e of W.entries){
      if(e.toy || e.dying) continue;
      const pos = e.body.root.position;
      _lp.copy(pos).applyMatrix4(camera.matrixWorldInverse);
      const it = labelPool[k] ||= {};
      k++;
      const dist = -_lp.z;
      const pr = project(pos);
      const m = e.maker;
      it.id = e.id;
      it.text = m && m.name ? m.name : '';
      it.anon = !m || !!m.anon || !m.name;
      it.x = pr.x; it.y = pr.y;
      it.depth = clamp((dist - 4)/(rig.lim.dMax*1.4), 0, 1);
      it.radius = dist > near ? pxRadius(pos, e.body.visR) : 0;
      it.onScreen = dist > near && !pr.behind && pr.x > -40 && pr.x < W.vw + 40 && pr.y > -40 && pr.y < W.vh + 40;
      it.mine = !!e.mine;
      it.focus = focused === e;
      it.hover = false;
      it.kind = e.design.type;
      out.push(it);
    }
    return out;
  }

  resize();
  snapTo(views().home);

  return Object.assign(W, {
    on:(ev, fn) => ((listeners[ev] ||= []).push(fn)),
    viewState: () => ({az:rig.goal.az,el:rig.goal.el,dist:rig.goal.dist,target:rig.goal.target.toArray()}),
    restoreView: o => {if([o.az,o.el,o.dist,...(o.target||[])].every(Number.isFinite) && o.target?.length===3) snapTo({...views().home,...o,target:new THREE.Vector3(...o.target)});},
    frame, resize, setMode, recenter, homeFocus, isOffHome, focus, project, pxRadius,
    discPixels: () => W.entries.filter(e => !e.toy).map(e => pxRadius(e.body.root.position, e.body.visR)),
    applySharedState, completeSharedLaunch, failSharedLaunch,
    addEntry, removeEntry, orbitOf, systemsInfo, flyToSystem, serialize, loadGalaxy, setBenchDesign, moveBenchToPad, moveBenchBack, startAurora, sparks, warm,
    enterToss, exitToss, loadToy,
    paintSky, setMotion, setQuality, labelItems,
    // para las pruebas (tools/): poner la cámara en un ángulo y una distancia exactos
    debugCam: import.meta.env.DEV ? o => { const v = views().home; snapTo({...v, ...o, target:o.target ? new THREE.Vector3(...o.target) : v.target}); rig.idle = -1e9; } : undefined,
    aimState:aim, views, maxPull, pullFor:import.meta.env.DEV?pullFor:undefined, launchInfo:import.meta.env.DEV?launchInfo:undefined,
    benchType: () => W.benchBody ? W.benchBody.d.type : null,
    sunScreen: () => project(SUN),
    isAuroraOn: () => !!aurora,
    isFlying: () => !!rig.flight || !!hop,
    debugView: import.meta.env.DEV ? () => ({path:path.visible, band:band.visible, bench:W.benchBody ? {state:W.benchState, visible:W.benchBody.root.visible, p:W.benchBody.root.position.toArray()} : null, trails:W.entries.filter(e => !e.toy).map(e => ({id:e.id, n:e.trail.n, gap:trailGap(e), r:e.body.root.position.toArray()}))}) : undefined,
    debugProject: import.meta.env.DEV ? (x, z) => { const q = new THREE.Vector3(x, 0, z).project(camera); return [q.x, q.y]; } : undefined,
  });
}

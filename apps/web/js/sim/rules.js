// rules.js — los números del mundo en un solo lugar (R9). Unidades de juego: G = 15, una estrella común
// tiene masa 1, un segundo de simulación es un segundo real. Con eso, una órbita circular a r = 7 dura ≈ 30 s.
// Cada número sale de spec/galaxy-sim-design.md salvo donde SIM-DECISIONS.md dice otra cosa (y por qué).

export const G = 15;
export const GM = G;               // compatibilidad: μ del Fogón (masa 1)
export const DT = 1 / 120;         // paso fijo del integrador (h)
export const GALAXY_EVERY = 4;     // un tic de galaxia = 4 pasos (H = 1/30 s): topología, rieles, choques, capturas
export const MAX_SUBSTEPS = 8;     // por cuadro; si el cuadro llega tarde se pierde tiempo de pantalla, no estabilidad
export const SOFT = 0.2;           // suavizado de Plummer ε para todo par con un cuerpo compacto
export const ATTRACT_MIN = 0.5;    // compatibilidad con world.js de antes: solo los compactos tiran de los demás

export const R_FAR = 19;           // borde visible de un sistema: más allá, lo que se aleja "se escapa"
export const R_GUARD = 1.95;       // guarda del Fogón (los demás compactos tienen la suya en TYPE_RULES.guard)

// Halo de la galaxia: potencial logarítmico centrado en el centro de masas, sin fuerza dentro de r0.
// Es la "nebulosa exterior" de la nota hecha conservativa: lo que se escapa de todo da la vuelta en una
// elipse enorme y vuelve como lo que es (R8). Solo actúa sobre lo que se integra (compactos y viajeros);
// las órbitas en riel son Kepler exacto alrededor de su anfitrión (R25).
//   Φ(r) = ½·v²·ln(1 + d²/rc²),  d = max(0, r − r0)
export const HALO = {r0: 22, rc: 14, v: 2.0};
// Fair confinement (operator, 2026-10-25): far bodies come back around the centre without piling into it. Light bodies
// lose only their radial speed beyond `calm` (their orbits turn round instead of decaying inward) and feel a spring
// beyond `wall`; compact bodies (stars, pulsars, black holes) feel only a conservative spring beyond their own wall.
// Measured on the fair's 21 real launches, 30 minutes ahead: chaos 5x lower than none, no bodies stuck together, half
// of them within ~100 of the centre, the farthest ~300. Braking compact bodies, even only far out, made them collapse
// into stuck clusters, so they only feel the spring.
// Settling is simulated age, never wall time. A finite Hermite bridge preserves position and velocity
// at both ends; its 300 s duration gives an approximately 100 s relaxation scale.
export const SETTLING = {grace: 60, duration: 300, spacing: 26, omega: 0.004, lightRadius: 14};
export const CONFINE = {light: {calm: 60, wall: 100, k: 0.02, brake: 0.5/120}, heavy: {calm: Infinity, wall: 150, k: 0.01, brake: 0}};

// Ventanas de encuentro y anfitriones
export const WINDOW = 8;           // s: lo que choca, o pasa cerca de un compacto ajeno, se integra este tiempo
export const ENC_K = 3.2;          // radio de encuentro de un compacto = ENC_K·√m (estrella 3.2, agujero negro 4.5)
export const A_BIN = 19;           // dos compactos ligados con apoastro dentro del borde (R_FAR) son una binaria
export const A_BIN_KEEP = 24;      // histéresis: una binaria se deshace solo si su apoastro pasa de esto
export const D_FOUND = 38;         // un compacto suelto a más de esto de todo otro sistema funda el suyo
export const R_CAPTURE = 19;       // un viajero puede ser capturado dentro de este radio de un sistema...
export const CAPTURE_HOLD = 1;     // ...si sigue ligado a él durante 1 s seguido
export const RAIL_SPAN = 0.45;     // un riel no puede llegar más allá de esta fracción de la distancia al otro sistema
export const KISS = 2.4;           // separación mínima resuelta entre dos compactos: más cerca, rebotan (visible)
export const SNUGGLE = 0.35;       // restitución normal de un beso entre compactos ligados: se acurrucan en una binaria estrecha
export const KISS_QUIET = 0.25;    // un beso más lento que esto (u/s en la normal) no emite evento: es un roce

// Choques tiernos (R12)
export const RESTITUTION = 0.6;
export const PAIR_COOLDOWN = 2;    // s entre dos efectos del mismo par
export const NEBULA_ASSIST = 1.6;  // energía específica máxima que una nebulosa le quita a un viajero (una vez por paso)

// Una fila por tipo. mass: masas de la nota · radius: radio de choque (escala visual del prototipo) ·
// primary: es un cuerpo compacto que ancla un sistema (gravedad mutua siempre integrada) · guard: radio del
// soplo (lo que cae más cerca sale soplado en una órbita larga) · canComet: si al volver de lejos se vuelve
// cometa (R8) · effect: lo que hace al recibir un golpe (R12) · micro: masa en unidades enteras de 10⁻⁶.
export const TYPE_RULES = {
  fogon:    {mass: 1,     radius: 1.25, primary: true,  guard: 1.95, canComet: false, effect: 'puff'},
  star:     {mass: 1,     radius: 0.6,  primary: true,  guard: 1.1,  canComet: false, effect: 'puff'},
  binary:   {mass: 2,     radius: 0.7,  primary: true,  guard: 1.3,  canComet: false, effect: 'puff'},
  pulsar:   {mass: 1.4,   radius: 0.4,  primary: true,  guard: 0.9,  canComet: false, effect: 'beam'},
  blackhole:{mass: 2,     radius: 0.45, primary: true,  guard: 0.9,  canComet: false, effect: 'accrete'},
  giant:    {mass: 0.01,  radius: 0.7,  primary: false, canComet: false, effect: 'storm'},
  planet:   {mass: 0.001, radius: 0.35, primary: false, canComet: false, effect: 'squash'},
  moon:     {mass: 1e-5,  radius: 0.22, primary: false, canComet: false, effect: 'crater'},
  asteroid: {mass: 1e-6,  radius: 0.2,  primary: false, canComet: true,  effect: 'chips'},
  comet:    {mass: 1e-6,  radius: 0.2,  primary: false, canComet: true,  effect: 'frost'},
  meteor:   {mass: 1e-6,  radius: 0.1,  primary: false, canComet: true,  effect: 'sparkle'},
  nebula:   {mass: 1e-4,  radius: 0.9,  primary: false, canComet: false, effect: 'pass'},
};
for(const r of Object.values(TYPE_RULES)) r.micro = Math.round(r.mass * 1e6);

// Lo que se ve al chocar, según quién golpea a quién: el efecto es el del que recibe, salvo que el que
// golpea sea un cometa (escarcha) o una piedra (esquirlas) y el golpeado sea un astro sólido.
export function impactEffect(hitter, target){
  if(target === 'nebula' || hitter === 'nebula') return 'pass';
  if(hitter === 'comet' || hitter === 'meteor') return 'frost';
  return TYPE_RULES[target].effect;
}

// Presupuestos contra el caos (R7, nota §2). playerSlots: en el prototipo local no se limita la cantidad de
// astros por jugador (el operador prueba lanzando mucho); la app compartida lo enciende con 3.
export const BUDGET = {
  playerSlots: Infinity, playerMass: 3.1,
  playerBlackHoles: 1, playerStellar: 1,
  systemBodies: 32, systemCompact: 2, systemBlackHoles: 1,
  galaxyBodies: 1024, galaxyBlackHoles: 4, galaxySystems: 32,
  blackHoleGapMs: 10 * 60 * 1000,
};

// la lluvia de meteoros viaja con diseño de cometa, pero su regla es la del meteoro
export function ruleKey(type, meteor){ return meteor ? 'meteor' : (TYPE_RULES[type] ? type : 'planet'); }
export function rulesFor(type, meteor){ return TYPE_RULES[ruleKey(type, meteor)]; }
export const isCompact = type => !!(TYPE_RULES[type] && TYPE_RULES[type].primary);

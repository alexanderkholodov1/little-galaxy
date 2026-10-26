// Deterministic binary64 math. No native libm, exponentiation, FMA or platform tables.
// Every intermediate uses ECMAScript's rounded + - * /, sqrt, abs and floor.
// Trig uses Cody-Waite reduction with three split pi/2 terms (|x| <= 2^20).
// Simulation callers reduce orbital time to a period first. Reject larger arguments
// explicitly rather than silently losing phase. Accuracy is measured in math.test.js.
export const PI = 3.141592653589793;
const HALF_PI = 1.5707963267948966, QUARTER_PI = 0.7853981633974483;
const LN2_HI = 0.6931471803691238, LN2_LO = 1.9082149292705877e-10;
export const zero = x => x === 0 ? 0 : x;
export const square = x => x*x;
export const cube = x => x*x*x;
export function hypot(...v){
  let scale=0; for(const x of v) if(Math.abs(x)>scale) scale=Math.abs(x);
  if(scale===0 || scale===Infinity)return scale;
  let sum=0; for(const x of v){const t=x/scale;sum+=t*t;}
  return Math.sqrt(sum)*scale;
}
function reduce(x){
  if(Math.abs(x)>1048576) throw new RangeError('Simulation angle exceeds deterministic range');
  const n=Math.floor(x*0.6366197723675814+0.5);
  const a=x-n*1.5707963267341256, b=n*6.077100506303966e-11;
  const h=a-b, l=(a-h)-b-n*2.0222662487959506e-21;
  return [n-4*Math.floor(n/4),h,l];
}
function sinKernel(x,y){
  const z=x*x;
  const p=-1.66666666666666324348e-1+z*(8.33333333332248946124e-3+z*(-1.98412698298579493134e-4+z*(2.75573137070700676789e-6+z*(-2.50507602534068634195e-8+z*1.58969099521155010221e-10))));
  return x+(x*z*p+y*(1-z*0.5));
}
function cosKernel(x,y){
  const z=x*x;
  const p=4.16666666666666019037e-2+z*(-1.38888888888741095749e-3+z*(2.48015872894767294178e-5+z*(-2.75573143513906633035e-7+z*(2.08757232129817482790e-9+z*-1.13596475577881948265e-11))));
  const h=0.5*z,w=1-h;
  return w+(((1-w)-h)+(z*z*p-x*y));
}
export function sin(x){
  const [n,h,l]=reduce(x);
  return zero(n===0?sinKernel(h,l):n===1?cosKernel(h,l):n===2?-sinKernel(h,l):-cosKernel(h,l));
}
export function cos(x){
  const [n,h,l]=reduce(x);
  return zero(n===0?cosKernel(h,l):n===1?-sinKernel(h,l):n===2?-cosKernel(h,l):sinKernel(h,l));
}
export function atan(x){
  const negative=x<0; x=Math.abs(x);
  let inverse=false,offset=0;
  if(x>1){x=1/x;inverse=true;}
  if(x>0.41421356237309503){x=(x-1)/(x+1);offset=QUARTER_PI;}
  const z=x*x; let sum=0;
  for(let i=25;i>=1;i--)sum=(i-2*Math.floor(i/2)===0?1:-1)/(2*i+1)+z*sum;
  let out=offset+(x+x*z*sum);
  if(inverse)out=HALF_PI-out;
  return zero(negative?-out:out);
}
export function atan2(y,x){
  if(x===0)return y===0?0:y<0?-HALF_PI:HALF_PI;
  const ax=Math.abs(x),ay=Math.abs(y);
  let a=ay>ax?HALF_PI-atan(ax/ay):atan(ay/ax);
  if(x<0)a=PI-a;
  return zero(y<0?-a:a);
}
export function acos(x){return atan2(Math.sqrt((1-x)*(1+x)),x);}
function scale2(x,n){
  let base=n<0?0.5:2; n=Math.abs(n);
  while(n>0){const half=Math.floor(n/2);if(n-2*half===1)x*=base;n=half;if(n>0)base*=base;}
  return x;
}
export function exp(x){
  if(x>709.782712893384)return Infinity;
  if(x<-745)return 0;
  const n=Math.floor(x*1.4426950408889634+0.5),r=(x-n*LN2_HI)-n*LN2_LO;
  let p=1;
  for(let i=18;i>=1;i--)p=1+r*p/i;
  // Split scaling avoids overflowing a power-of-two intermediate near the endpoints.
  const first=Math.floor(n/2);return scale2(scale2(p,first),n-first);
}
export function log(x){
  if(x===0)return -Infinity;if(x<0)return NaN;if(x===Infinity)return Infinity;
  let n=0;
  while(x>1.4142135623730951){x*=0.5;n++;}
  while(x<0.7071067811865476){x*=2;n--;}
  const t=(x-1)/(x+1),z=t*t;let p=0;
  for(let i=19;i>=1;i--)p=1/(2*i+1)+z*p;
  return (n*LN2_LO+2*(t+t*z*p))+n*LN2_HI;
}
export function sinh(x){
  if(Math.abs(x)<1){let p=1;for(let i=12;i>=1;i--)p=1+x*x*p/((2*i)*(2*i+1));return zero(x*p);}
  const e=exp(Math.abs(x)),out=(e-1/e)*0.5;return x<0?-out:out;
}
export function cosh(x){const e=exp(Math.abs(x));return (e+1/e)*0.5;}
// Canonical wire state also preserves undefined (unlike a JSON cloning workaround).
export function canonical(value){
 if(typeof value==='number')return zero(value);
 if(Array.isArray(value))return value.map(canonical);
 if(value && typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,canonical(v)]));
 return value;
}

// Test-only pre-grid all-pairs algorithm. Deliberately independent broad phase.
import {impactEffect,PAIR_COOLDOWN} from '../js/sim/rules.js';
import {hypot} from '../js/sim/math.js';
import {createBus} from '../js/sim/bus.js';
import assert from 'node:assert/strict';
const sub=(a,b)=>a.map((x,k)=>x-b[k]),dot=(a,b)=>a.reduce((n,x,k)=>n+x*b[k],0);
export function allPairs(){
    const L = this.bodies.filter(b => b.mode !== 'n');
    for(let i = 0; i < L.length; i++){
      const a = L[i];
      for(let j = i + 1; j < L.length; j++){
        const b = L[j];
        // Captured test particles share the quiet Kepler regime, including their settling bridge.
        // A fresh throw still has the original contact dynamics during its protected first minute.
        if((a.settled || a.calmStart !== undefined) && (b.settled || b.calmStart !== undefined)) continue;
        if(a.group && a.group === b.group) continue;     // una lluvia de meteoros no choca consigo misma
        const n = sub(b.p, a.p), d2 = dot(n, n), rr = a.r + b.r;
        const key = a.id + ':' + b.id;
        if(d2 < rr*rr){
          if(this.contacts.has(key)) continue;
          this.contacts.set(key, this.t + PAIR_COOLDOWN);
          const speed = hypot(...sub(a.v, b.v));
          // el efecto es del que recibe: el más pesado (o el que no es cometa)
          const [hit, tgt] = a.m <= b.m ? [a, b] : [b, a];
          const effect = impactEffect(hit.kind, tgt.kind);
          if(effect !== 'pass') this.bounce(a, b, n, Math.sqrt(d2), rr);
          this.emit('impact', a, {other: b, kinds: [a.kind, b.kind], speed, effect, hitter: hit, target: tgt});
        } else if(d2 > rr*rr*2.25 && this.contacts.has(key) && this.t >= this.contacts.get(key)) this.contacts.delete(key);
      }
    }
    for(const [k, until] of this.contacts) if(k[0] === 'a' && this.t > until) this.contacts.delete(k);
  }

export function verifiedTouch(grid){return function(){
 if(!this.bodies.some(b=>b.mode!=='n' && !b.settled && b.calmStart===undefined))return grid.call(this);
 const ref=Object.create(Object.getPrototypeOf(this));
 Object.assign(ref,this,{bodies:structuredClone(this.bodies),contacts:new Map(this.contacts),_ids:null,_prim:null,bus:createBus()});
 const events=[],other=[];const shape=(type,b,e)=>[type,b?.id,e?.other?.id,e?.speed,e?.effect];
 const off=this.on((...args)=>events.push(shape(...args)));ref.on((...args)=>other.push(shape(...args)));
 try{grid.call(this);allPairs.call(ref);}finally{off();}
 assert.deepEqual(this.snapshot(),ref.snapshot(),'grid/all-pairs state');assert.deepEqual(events,other,'grid/all-pairs event order');
};}

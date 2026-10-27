// bus.js — eventos de la simulación: (tipo, cuerpo, extra). Los oyentes se llaman en el orden en que se suscriben.
export function createBus(){
  const fns = [];
  return {
    on(fn){ fns.push(fn); return () => { const i = fns.indexOf(fn); if(i >= 0) fns.splice(i, 1); }; },
    emit(type, b, extra){ for(const fn of fns.slice()) fn(type, b, extra); },
  };
}

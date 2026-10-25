export function launchVoice(error){
 const es=document.documentElement.lang==='es',message=String(error?.message||'');
 if(/cooldown|rate limit/i.test(message))return es?'Tu astro sigue en tu mano. Dale al fuego 15 segundos para descansar y vuelve a tirar.':'Your star is still in your hand. Give the fire 15 seconds to settle, then throw again.';
 if(/capacity|budget|limit|full/i.test(message))return es?'Este fuego ha recibido todo lo que puede cuidar por ahora. Tu diseño está guardado.':'This fire has received all it can care for right now. Your design is safe.';
 if(/read.only|frozen|resting/i.test(message))return es?'Esta galaxia está descansando. Puedes mirarla; tu diseño está guardado.':'This galaxy is resting. You can visit it; your design is safe.';
 return es?'El cielo no pudo escucharte. Tu astro sigue en tu mano; vuelve a tirar cuando haya conexión.':'The sky could not hear you. Your star is still in your hand; throw again when connected.';
}

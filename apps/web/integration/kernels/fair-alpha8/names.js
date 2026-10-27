import {names} from '@little-galaxy/shared';
const legacyNames=Object.values(names).flatMap(n=>[n.en,n.es]);
// The prototype's generated proper names fit one bounded design parameter; no new text field.
const nouns=[['Brasa',1],['Lucero',0],['Miel',1],['Farol',0],['Canela',1],['Vela',1],['Duende',0],['Mochi',0],['Ceniza',1],['Bruma',1],['Guijarro',0],['Ámbar',0],['Lila',1],['Pompa',1],['Cascabel',0],['Lumbre',1],['Rescoldo',0],['Chispa',1],['Malvavisco',0],['Nube',1],['Grillo',0],['Luciérnaga',1],['Botón',0],['Pluma',1]];
const adjectives=[['Tímido','Tímida'],['Dormido','Dormida'],['Risueño','Risueña'],['Tibio','Tibia'],['Lejano','Lejana'],['Valiente','Valiente'],['Curioso','Curiosa'],['Pequeño','Pequeña'],['Callado','Callada'],['Soñador','Soñadora'],['Tierno','Tierna'],['Despistado','Despistada'],['Bailarín','Bailarina'],['Viajero','Viajera'],['Dulce','Dulce'],['Lento','Lenta'],['Feliz','Feliz'],['Brillante','Brillante']];
export function encodeName(name){for(let n=0;n<nouns.length;n++)for(let a=0;a<adjectives.length;a++)if(`${nouns[n][0]} ${adjectives[a][nouns[n][1]]}`===name)return n*32+a+1;const legacy=legacyNames.indexOf(name);return legacy<0?0:10000+legacy;}
export function decodeName(code){if(code>=10000)return legacyNames[code-10000]||null;const n=nouns[Math.floor((code-1)/32)],a=adjectives[(code-1)%32];return n&&a?`${n[0]} ${a[n[1]]}`:null;}

export const legacyName=key=>names[key]?.en||null;

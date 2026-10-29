import {afterEach,expect,it,vi} from 'vitest';
import {Body,defaultDesign} from '../js/bodies.js';

function uniformLoopBounds(shader){
 const uniforms=new Set([...shader.matchAll(/\buniform\s+int\s+([^;]+);/g)].flatMap(m=>m[1].split(',').map(name=>name.trim())));
 // The clay override precedes NOISE's #ifndef fallback. Keep the first definition.
 const macros=new Map();
 for(const[,name,value]of shader.matchAll(/^\s*#define\s+(\w+)\s+([^\n]+)/gm))if(!macros.has(name))macros.set(name,value.trim());
 const loops=[...shader.matchAll(/\bfor\s*\([^;]*;[^;]*?(?:<=|>=|<|>)\s*([^;]+);/g)];
 expect(loops.length).toBe([...shader.matchAll(/\bfor\s*\(/g)].length);
 return loops.map(([,bound])=>{
  let value=bound.trim();const seen=new Set();
  while(macros.has(value)&&!seen.has(value)){seen.add(value);value=macros.get(value);}
  return {bound,uniform:uniforms.has(value)};
 });
}
afterEach(()=>vi.restoreAllMocks());
it('keeps a separate clay program per kind and uniform bounds in both shader stages',()=>{
 // Comet construction needs a glow canvas; this guard inspects shaders, not raster output.
 vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue({createRadialGradient:()=>({addColorStop(){}}),fillRect(){}});
 const kinds={planet:0,giant:1,moon:2,comet:3,asteroid:4};
 for(const[type,kind]of Object.entries(kinds))for(const lod of ['high','low']){
  const body=new Body(defaultDesign(type,17),{lod}),material=body.parts.mat;
  expect(material.defines.CLAY_KIND,`${type}/${lod}`).toBe(kind);
  expect(material.uniforms.uOctaves.value).toBe(4);
  expect(material.uniforms.uRidged.value).toBe(3);
  expect(material.uniforms.uCell.value).toBe(1);
  for(const stage of ['vertexShader','fragmentShader']){
   const bounds=uniformLoopBounds(material[stage]);
   expect(bounds.length).toBeGreaterThan(0);
   for(const loop of bounds)expect(loop.uniform,`${type}/${lod}/${stage}: ${loop.bound}`).toBe(true);
  }
 }
});
it('detects both literal bounds and constant macro bounds',()=>{
 expect(uniformLoopBounds('for(int i=0;i<4;i++){}')[0].uniform).toBe(false);
 expect(uniformLoopBounds('#define COUNT 4\nfor(int i=0;i<COUNT;i++){}')[0].uniform).toBe(false);
});

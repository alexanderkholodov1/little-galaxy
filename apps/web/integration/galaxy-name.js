/** Present the operator's default open-galaxy name in the page language, including old manifests. */
export function displayGalaxyName(name,lang='en'){
 return ['Sandbox','Open Galaxy','Galaxia abierta'].includes(name)?(lang==='es'?'Galaxia abierta':'Open Galaxy'):name;
}

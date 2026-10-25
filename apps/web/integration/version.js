export const currentVersion = {version: __APP_VERSION__, commit: __APP_COMMIT__};
export function changed(current, served){
  return Boolean(served?.version && (current.version !== served.version || (current.commit && served.commit && current.commit !== served.commit)));
}
export async function fetchVersion(fetcher = fetch){
  try{
    const response = await fetcher(`${import.meta.env.BASE_URL}version.json`, {cache:'no-store', signal:AbortSignal.timeout(10000)});
    return response.ok ? await response.json() : null;
  }catch{ return null; }
}
// Only offer a reload after preserving the workshop. The player chooses a safe moment.
export function watchVersion(save){
  let offered = false;
  const check = async () => {
    if(document.hidden || offered) return;
    const served = await fetchVersion();
    if(!changed(currentVersion, served)) return;
    offered = true;
    const button = document.createElement('button');
    button.className = 'pill glass'; button.id = 'updateAvailable';
    button.style.cssText = 'position:fixed;bottom:16px;right:16px;z-index:1000';
    button.textContent = document.documentElement.lang === 'es' ? 'Nuevo cielo listo · actualizar' : 'New sky ready · update';
    button.onclick = () => {save(); location.reload();};
    document.body.append(button);
  };
  const timer = setInterval(check, 20000);
  return () => clearInterval(timer);
}

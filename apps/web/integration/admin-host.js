export function adminHostTarget({hostname,authDomain,baseUrl='/little-galaxy/',search=''}) {
  if(!authDomain||hostname===authDomain||hostname==='localhost'||hostname==='127.0.0.1')return null;
  return `https://${authDomain}${baseUrl}admin${search}`;
}

export function guardAdminHost({location=window.location,authDomain=import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,baseUrl=import.meta.env.BASE_URL}={}) {
  const target=adminHostTarget({hostname:location.hostname,authDomain,baseUrl,search:location.search});
  if(target)location.replace(target);
  return target;
}

export function isReadOnlyRequest(method,url){
  if(['GET','HEAD','OPTIONS'].includes(method))return true;
  return method==='POST'&&/\/google\.firestore\.v1\.Firestore\/Listen\/|\/documents:(batchGet|runQuery)(?:\?|$)/.test(url);
}

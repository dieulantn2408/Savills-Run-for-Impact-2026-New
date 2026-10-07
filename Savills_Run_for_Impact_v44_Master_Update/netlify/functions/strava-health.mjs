export async function handler(event){
  if(event.httpMethod!=='GET')return {statusCode:405,body:'Method not allowed'};
  const required=['STRAVA_CLIENT_ID','STRAVA_CLIENT_SECRET','SITE_URL','FIREBASE_SERVICE_ACCOUNT_JSON'];
  const configured=Object.fromEntries(required.map(k=>[k,Boolean(process.env[k])]));
  return {statusCode:200,headers:{'Content-Type':'application/json','Cache-Control':'no-store'},body:JSON.stringify({functionsDeployed:true,configured,ready:Object.values(configured).every(Boolean)})};
}

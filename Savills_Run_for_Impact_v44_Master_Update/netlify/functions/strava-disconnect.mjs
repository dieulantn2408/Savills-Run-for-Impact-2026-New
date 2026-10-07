import {db,json,userFrom,env,stamp} from './_shared.mjs';
export async function handler(event){
  if(event.httpMethod!=='POST')return json(405,{error:'POST only'});
  try{
    const u=await userFrom(event), tokenRef=db.doc('stravaTokens/'+u.uid), snap=await tokenRef.get();
    if(!snap.exists){await db.doc('stravaConnections/'+u.uid).set({status:'disconnected',stravaDisconnectedAt:stamp.serverTimestamp()},{merge:true});return json(200,{ok:true,alreadyDisconnected:true});}
    const t=snap.data(), revokeToken=t.refreshToken||t.accessToken;
    if(!revokeToken)throw Error('Stored Strava authorization is incomplete');
    const auth='Basic '+Buffer.from(env('STRAVA_CLIENT_ID')+':'+env('STRAVA_CLIENT_SECRET')).toString('base64');
    const rr=await fetch('https://www.strava.com/oauth/revoke',{method:'POST',headers:{Authorization:auth,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({token:revokeToken,token_type_hint:t.refreshToken?'refresh_token':'access_token'})});
    if(!rr.ok)throw Error('Strava deauthorization failed (HTTP '+rr.status+')');
    const batch=db.batch();
    batch.delete(tokenRef);
    if(t.athleteId)batch.delete(db.doc('stravaAthletes/'+t.athleteId));
    batch.set(db.doc('stravaConnections/'+u.uid),{status:'disconnected',stravaDisconnectedAt:stamp.serverTimestamp()},{merge:true});
    batch.set(db.collection('auditLogs').doc(),{userId:u.uid,eventType:'strava_disconnected',timestamp:stamp.serverTimestamp(),status:'success'});
    const acts=await db.collection('stravaActivities').where('uid','==',u.uid).get();acts.docs.forEach(d=>batch.delete(d.ref));
    await batch.commit();
    return json(200,{ok:true});
  }catch(e){console.error('Strava disconnect failed:',e);return json(502,{error:e.message||'Could not disconnect Strava'});}
}
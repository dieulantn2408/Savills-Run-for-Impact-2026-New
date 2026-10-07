import {db,origin,env,stamp} from './_shared.mjs';
export async function handler(event){
 const p=event.queryStringParameters||{},back=origin();
 const redirect=code=>({statusCode:302,headers:{Location:back+'/?strava='+code,'Cache-Control':'no-store'},body:''});
 if(!p.state||!p.code||p.error)return redirect('cancelled');
 const ref=db.doc('stravaOAuthStates/'+p.state);
 try{const snap=await ref.get();if(!snap.exists||snap.data().expiresAt<Date.now())return redirect('expired');const uid=snap.data().uid;await ref.delete();
 const r=await fetch('https://www.strava.com/oauth/token',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({client_id:env('STRAVA_CLIENT_ID'),client_secret:env('STRAVA_CLIENT_SECRET'),code:p.code,grant_type:'authorization_code'})});if(!r.ok)throw Error('OAuth token exchange failed');const t=await r.json();
 const athleteId=String(t.athlete.id),aRef=db.doc('stravaAthletes/'+athleteId),prior=await aRef.get();if(prior.exists&&prior.data().uid!==uid)return redirect('already-linked');
 const batch=db.batch();batch.set(db.doc('stravaTokens/'+uid),{athleteId,accessToken:t.access_token,refreshToken:t.refresh_token,expiresAt:t.expires_at,scope:p.scope||'',updatedAt:stamp.serverTimestamp()});batch.set(aRef,{uid});batch.set(db.doc('stravaConnections/'+uid),{status:'connected',connectedAt:stamp.serverTimestamp(),athleteIdLast4:athleteId.slice(-4)});await batch.commit();return redirect('connected');
 }catch(e){console.error('OAuth callback:',e.message);return redirect('error');}
}

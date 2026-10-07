import admin from 'firebase-admin';
if(!admin.apps.length){
 const raw=process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
 if(raw) admin.initializeApp({credential:admin.credential.cert(JSON.parse(raw))});
}
export const db=admin.apps.length?admin.firestore():null;
export const stamp=admin.firestore.FieldValue;
export const json=(status,obj)=>({statusCode:status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'},body:JSON.stringify(obj)});
export const origin=()=>{const v=process.env.SITE_URL;if(!v||!/^https:\/\//.test(v))throw Error('Configure SITE_URL');return v.replace(/\/$/,'');};
export async function userFrom(event){if(!db)throw Error('Missing FIREBASE_SERVICE_ACCOUNT_JSON in Netlify environment variables');const bearer=event.headers.authorization||event.headers.Authorization||'';if(!bearer.startsWith('Bearer '))throw Error('Please log in');const user=await admin.auth().verifyIdToken(bearer.slice(7),true);const member=await db.doc('members/'+user.uid).get();if(!member.exists)throw Error('HR approval required');return user;}
export const env=(name)=>{if(!process.env[name])throw Error('Missing '+name);return process.env[name];};
export async function stravaToken(uid){
 const ref=db.doc('stravaTokens/'+uid),snap=await ref.get();if(!snap.exists)throw Error('Strava not connected');let t=snap.data();
 if(t.expiresAt>Date.now()/1000+120)return t.accessToken;
 const r=await fetch('https://www.strava.com/oauth/token',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({client_id:env('STRAVA_CLIENT_ID'),client_secret:env('STRAVA_CLIENT_SECRET'),grant_type:'refresh_token',refresh_token:t.refreshToken})});
 if(!r.ok)throw Error('Strava refresh failed '+r.status);
 const d=await r.json();await ref.update({accessToken:d.access_token,refreshToken:d.refresh_token,expiresAt:d.expires_at});return d.access_token;
}

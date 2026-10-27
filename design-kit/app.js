/* ---------- Config ---------- */
const API = { url:'https://aoqoflvvrntrdcdbdckx.supabase.co', key:'sb_publishable_FSJ_s4_t4zSZwoWSJIYiaQ_2a3m0G0b', live:null };
const TILE_BASE = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}';
const TILE_REF  = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}';
const TILE_ATTR = 'Tiles © Esri — Esri, HERE, Garmin, © OpenStreetMap contributors';
const LA_IMG = { url:'la_map.jpg', bounds:[[33.68778175843937,-118.3447265625],[34.05265942137598,-117.9052734375]] };
const DEFAULT_CENTER = [33.8475,-118.1363]; // Lakewood, CA until the phone says otherwise
const CAP = () => (window.Capacitor && typeof window.Capacitor.isNativePlatform==='function' && window.Capacitor.isNativePlatform()) ? window.Capacitor : null;
const PLUGIN = name => { const c=CAP(); return c && c.Plugins ? c.Plugins[name] : null; };
const BUNDLE_ID = 'com.gymtitles.app';
async function sha256hex(str){ const buf=await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str)); return [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join(''); }
const randomNonce = () => { const a=new Uint8Array(24); crypto.getRandomValues(a); return [...a].map(b=>('0'+b.toString(16)).slice(-2)).join(''); };
const sb = (typeof supabase !== 'undefined') ? supabase.createClient(API.url, API.key, {auth:{persistSession:true, autoRefreshToken:true, detectSessionInUrl:false}}) : null;

const LIFTS = {
  bench:{key:'bench', name:'Bench press', short:'Bench', title:'Bench King'},
  squat:{key:'squat', name:'Back squat', short:'Squat', title:'Squat King'},
  dead:{key:'dead',  name:'Deadlift',   short:'Deadlift', title:'Deadlift King'}
};
const LIFT_ORDER = ['bench','squat','dead'];
const STATE_NAMES = {AL:'Alabama',AK:'Alaska',AZ:'Arizona',AR:'Arkansas',CA:'California',CO:'Colorado',CT:'Connecticut',DE:'Delaware',DC:'Washington DC',FL:'Florida',GA:'Georgia',HI:'Hawaii',ID:'Idaho',IL:'Illinois',IN:'Indiana',IA:'Iowa',KS:'Kansas',KY:'Kentucky',LA:'Louisiana',ME:'Maine',MD:'Maryland',MA:'Massachusetts',MI:'Michigan',MN:'Minnesota',MS:'Mississippi',MO:'Missouri',MT:'Montana',NE:'Nebraska',NV:'Nevada',NH:'New Hampshire',NJ:'New Jersey',NM:'New Mexico',NY:'New York',NC:'North Carolina',ND:'North Dakota',OH:'Ohio',OK:'Oklahoma',OR:'Oregon',PA:'Pennsylvania',RI:'Rhode Island',SC:'South Carolina',SD:'South Dakota',TN:'Tennessee',TX:'Texas',UT:'Utah',VT:'Vermont',VA:'Virginia',WA:'Washington',WV:'West Virginia',WI:'Wisconsin',WY:'Wyoming'};

// Launch cities: real centers, gym counts within 25 km from the ingest (chains + named gyms).
const CITIES = [
  {id:'la',  name:'Los Angeles', state:'CA', lat:33.85, lon:-118.14, gyms:773},
  {id:'nyc', name:'New York', state:'NY', lat:40.73, lon:-73.95, gyms:1678},
  {id:'chi', name:'Chicago', state:'IL', lat:41.88, lon:-87.68, gyms:758},
  {id:'hou', name:'Houston', state:'TX', lat:29.76, lon:-95.37, gyms:542},
  {id:'dal', name:'Dallas', state:'TX', lat:32.78, lon:-96.80, gyms:537},
  {id:'phx', name:'Phoenix', state:'AZ', lat:33.50, lon:-112.05, gyms:631},
  {id:'atl', name:'Atlanta', state:'GA', lat:33.78, lon:-84.39, gyms:559},
  {id:'mia', name:'Miami', state:'FL', lat:25.78, lon:-80.22, gyms:584},
  {id:'col', name:'Columbus', state:'OH', lat:39.98, lon:-82.99, gyms:363},
  {id:'den', name:'Denver', state:'CO', lat:39.74, lon:-104.98, gyms:643},
  {id:'sea', name:'Seattle', state:'WA', lat:47.61, lon:-122.33, gyms:494},
  {id:'lv',  name:'Las Vegas', state:'NV', lat:36.15, lon:-115.17, gyms:387},
  {id:'phl', name:'Philadelphia', state:'PA', lat:39.97, lon:-75.16, gyms:771},
  {id:'bos', name:'Boston', state:'MA', lat:42.35, lon:-71.08, gyms:679},
  {id:'sd',  name:'San Diego', state:'CA', lat:32.78, lon:-117.12, gyms:564},
  {id:'atx', name:'Austin', state:'TX', lat:30.27, lon:-97.74, gyms:419}
];
const CITY = Object.fromEntries(CITIES.map(c=>[c.id,c]));

/* ---------- Gym store (from the database) ---------- */
const GYM = {};
let LOCAL = null;
function putGym(r){ if(!r||r.id==null) return null; const g=GYM[r.id]||(GYM[r.id]={}); Object.assign(g,r); g.id=+g.id; return g; }
const gymLabel = g => g ? (g.brand && g.city ? g.brand+' — '+g.city : g.name) : 'Unknown gym';
const gymTitle = g => g.brand || g.name;
const gymSub = g => g.city||'';
function distKm(aLat,aLon,bLat,bLon){ const dLat=(bLat-aLat)*111, dLon=(bLon-aLon)*111*Math.cos(aLat*Math.PI/180); return Math.hypot(dLat,dLon); }
const miles = km => (km*0.621371).toFixed(1);

async function api(path, {timeout=9000, method='GET', body=null}={}){
  const ctl=new AbortController(); const t=setTimeout(()=>ctl.abort(),timeout);
  try{
    const headers={apikey:API.key, 'Content-Type':'application/json'};
    const tok=SESSION&&SESSION.access_token; if(tok) headers.Authorization='Bearer '+tok;
    if(method==='POST'||method==='PATCH') headers.Prefer='return=representation';
    const r=await fetch(API.url+'/rest/v1/'+path,{method, headers, body: body?JSON.stringify(body):undefined, signal:ctl.signal});
    if(!r.ok){ let m='HTTP '+r.status; try{ const j=await r.json(); m=j.message||j.msg||m; }catch(_){} throw new Error(m); }
    const txt=await r.text(); return txt?JSON.parse(txt):null;
  } finally{ clearTimeout(t); }
}
const rpc = (fn, args, opts={}) => api('rpc/'+fn, {method:'POST', body:args||{}, ...opts});
const SEL='select=id,name,brand,tier,street,city,state,zip,lat,lon';
async function loadLocal(){
  if(LOCAL) return LOCAL;
  try{ const r=await fetch('la_gyms.json'); LOCAL=await r.json(); } catch(e){ LOCAL=[]; }
  LOCAL.forEach(putGym); return LOCAL;
}
async function probe(){
  if(API.live!==null) return API.live;
  try{ await api('gyms?select=id&limit=1',{timeout:7000}); API.live=true; }
  catch(e){ API.live=false; await loadLocal(); }
  return API.live;
}
async function gymsInBox(s,w,n,e,limit=320){
  if(await probe()){
    const rows=await api(`gyms?${SEL}&lat=gte.${s}&lat=lte.${n}&lon=gte.${w}&lon=lte.${e}&tier=neq.review&order=tier.asc,confidence.desc&limit=${limit}`);
    return rows.map(putGym);
  }
  return (await loadLocal()).filter(g=>g.tier!=='review'&&g.lat>=s&&g.lat<=n&&g.lon>=w&&g.lon<=e).slice(0,limit).map(putGym);
}
async function gymById(id){
  if(GYM[id]&&GYM[id].name) return GYM[id];
  if(await probe()){ const rows=await api(`gyms?${SEL}&id=eq.${id}`); return rows.length?putGym(rows[0]):null; }
  return (await loadLocal()).find(g=>g.id===+id)||null;
}
async function searchGyms(q){
  const s=q.replace(/[%,()*]/g,' ').trim(); if(!s) return [];
  if(await probe()){
    const enc=encodeURIComponent('*'+s+'*');
    const rows=await api(`gyms?${SEL}&or=(name.ilike.${enc},city.ilike.${enc})&tier=neq.review&order=tier.asc&limit=8`);
    return rows.map(putGym);
  }
  const l=s.toLowerCase(); return (await loadLocal()).filter(g=>g.tier!=='review'&&((g.name||'').toLowerCase().includes(l)||(g.city||'').toLowerCase().includes(l))).slice(0,8).map(putGym);
}

/* ---------- Session, people, boards ---------- */
let SESSION=null;           // supabase session
let MEP=null;               // my profile row
const PEOPLE={};            // user_id -> {name,h,bw,birth_year}
const BOARD={};             // gym_id -> {rows, at}
const TITLES={};            // gym_id -> {bench:row,squat:row,dead:row}
const TCOUNT={};            // gym_id -> titles held (for pins)
const myId = () => SESSION ? SESSION.user.id : null;
function person(id, row){ const p=PEOPLE[id]||(PEOPLE[id]={name:'Lifter',h:200}); if(row){ if(row.display_name) p.name=row.display_name; if(row.avatar_hue!=null) p.h=row.avatar_hue; if(row.bodyweight_lb!=null) p.bw=row.bodyweight_lb; if(row.birth_year!=null) p.birth_year=row.birth_year; } return p; }
function computeTitles(gid, rows){
  const t={};
  rows.filter(r=>r.status==='approved'&&r.reps===1).forEach(r=>{ const c=t[r.lift]; if(!c || +r.weight_lb>+c.weight_lb || (+r.weight_lb===+c.weight_lb && r.recorded_at<c.recorded_at)) t[r.lift]=r; });
  TITLES[gid]=t; TCOUNT[gid]=Object.keys(t).length; return t;
}
async function loadBoard(gid, force){
  gid=+gid; const b=BOARD[gid];
  if(b && !force && Date.now()-b.at<60000) return b.rows;
  let rows=[];
  try{ if(await probe()) rows=await rpc('gym_board',{p_gym_id:gid}); } catch(e){ rows=[]; }
  rows.forEach(r=>{ r.gym_id=gid; person(r.user_id,r); });
  BOARD[gid]={rows, at:Date.now()}; computeTitles(gid, rows); return rows;
}
async function loadTitleCounts(ids){
  if(!ids.length || !(await probe())) return;
  try{
    const rows=await api(`gym_titles?gym_id=in.(${ids.join(',')})&select=gym_id,lift`);
    ids.forEach(id=>TCOUNT[id]=0); rows.forEach(r=>{ TCOUNT[r.gym_id]=(TCOUNT[r.gym_id]||0)+1; });
  } catch(e){}
}
const titleHolder = (gid, lift) => (TITLES[gid]||{})[lift]||null;
const heldCount = gid => TCOUNT[gid]||0;
const boardRows = gid => (BOARD[gid]||{rows:[]}).rows;
const boardLifters = gid => new Set(boardRows(gid).filter(r=>r.status==='approved').map(r=>r.user_id)).size;
const isKing = (uid, gid, lift) => { const h=titleHolder(gid,lift); return !!h && h.user_id===uid; };
const HOME = () => MEP && MEP.home_gym_id ? +MEP.home_gym_id : null;

/* ---------- My data ---------- */
const MY={ lifts:[], titles:[], notes:[], at:0 };
async function loadMine(force){
  if(!myId()) return; if(!force && Date.now()-MY.at<30000) return;
  try{
    const [lifts, titles, notes] = await Promise.all([
      api(`lifts?user_id=eq.${myId()}&select=*,gyms(id,name,brand,city,state)&order=recorded_at.desc&limit=100`),
      api(`gym_titles?user_id=eq.${myId()}&select=gym_id,lift,weight_lb`),
      api(`notifications?user_id=eq.${myId()}&select=id,kind,title,body,gym_id,read_at,created_at&order=created_at.desc&limit=20`)
    ]);
    MY.lifts=lifts||[]; MY.titles=titles||[]; MY.notes=notes||[]; MY.at=Date.now();
    MY.lifts.forEach(l=>{ if(l.gyms) putGym(l.gyms); });
  } catch(e){}
}
const myBest = lift => MY.lifts.filter(l=>l.lift===lift&&l.status==='approved'&&l.reps===1).sort((a,b)=>b.weight_lb-a.weight_lb)[0]||null;
const myPending = () => MY.lifts.filter(l=>l.status==='pending');

/* ---------- Auth ---------- */
async function initAuth(){
  if(!sb) return;
  try{ const {data}=await sb.auth.getSession(); SESSION=data.session||null; }catch(e){ SESSION=null; }
  sb.auth.onAuthStateChange((_e, s)=>{ const was=!!SESSION; SESSION=s||null; if(!!SESSION!==was) onAuthChange(); });
  if(SESSION) await loadProfile();
}
async function loadProfile(){
  if(!myId()) { MEP=null; return; }
  try{ const rows=await api(`profiles?id=eq.${myId()}&select=*`); MEP=rows[0]||null; if(MEP) person(MEP.id, MEP); } catch(e){ MEP=null; }
  if(MEP && MEP.home_gym_id) await gymById(MEP.home_gym_id);
  await loadMine(true);
  registerPush();
}
async function onAuthChange(){ if(SESSION){ await loadProfile(); } else { MEP=null; MY.lifts=[]; MY.titles=[]; } render(false); }
async function signIn(email, pass){ const {error}=await sb.auth.signInWithPassword({email, password:pass}); if(error) throw error; }
async function signUp(email, pass, name){ const {data, error}=await sb.auth.signUp({email, password:pass, options:{data:{display_name:name}}}); if(error) throw error; return data; }
async function signOut(){ try{ await sb.auth.signOut(); }catch(e){} SESSION=null; MEP=null; MY.lifts=[]; MY.titles=[]; }
async function signInWithApple(){
  const plugin=PLUGIN('SignInWithApple'); if(!plugin) throw new Error('Sign in with Apple is available in the iOS app.');
  const raw=randomNonce(); const hashed=await sha256hex(raw);
  const res=await plugin.authorize({clientId:BUNDLE_ID, redirectURI:'https://'+API.url.replace('https://','')+'/auth/v1/callback', scopes:'email name', state:randomNonce(), nonce:hashed});
  const r=res&&res.response; if(!r||!r.identityToken) throw new Error('Apple did not return a sign-in token.');
  const {data, error}=await sb.auth.signInWithIdToken({provider:'apple', token:r.identityToken, nonce:raw});
  if(error) throw error;
  // Apple only sends the name on the very first sign-in; keep it.
  const nm=[r.givenName, r.familyName&&r.familyName[0]?r.familyName[0]+'.':''].filter(Boolean).join(' ').trim();
  if(nm && data&&data.user){ try{ await api('profiles?id=eq.'+data.user.id, {method:'PATCH', body:{display_name:nm}}); }catch(e){} }
}
async function registerPush(){
  const push=PLUGIN('PushNotifications'); if(!push||!myId()) return;
  try{
    let perm=await push.checkPermissions(); if(perm.receive==='prompt') perm=await push.requestPermissions();
    if(perm.receive!=='granted') return;
    if(!registerPush.bound){ registerPush.bound=true;
      push.addListener('registration', async t=>{ try{ await api('push_tokens?on_conflict=user_id,token',{method:'POST', body:{user_id:myId(), token:t.value, platform:'ios', updated_at:new Date().toISOString()}}); }catch(e){} });
      push.addListener('pushNotificationActionPerformed', ()=>{ loadMine(true).then(()=>{ if(S.screen==='profile') render(false); }); });
    }
    await push.register();
  } catch(e){}
}
function requireAuth(next){ if(SESSION) return true; S.authNext=next; S.auth.mode='in'; S.auth.error=null; S.auth.done=null; go('auth'); return false; }

/* ---------- State ---------- */
const S = {
  screen:'discover', gymId:null, gymTab:'recent', gymLbLift:'bench',
  lb:{scope:'city', lift:'bench', bwc:'all', age:'all', open:false, rows:null, key:null, loading:false},
  submit:{step:1, lift:null, weight:'', reps:1, bw:'', gymId:null, file:null, fileUrl:null, fileSecs:null, pct:0, uploading:false, error:null, result:null, geo:null},
  search:'', searchHits:[], searching:false, video:null, videoUrl:null, videoErr:null, toast:null, city:'la', citySheet:false,
  view:{ids:[], loading:true, center:DEFAULT_CENTER.slice(), zoom:12, total:0}, featured:null,
  me:DEFAULT_CENTER.slice(), auth:{mode:'in', error:null, busy:false, done:null, done_email:null}, authNext:null,
  review:{queue:null, item:null, verdict:null, reason:'', busy:false, videoUrl:null, error:null},
  settings:{open:false, confirmDelete:false, busy:false, error:null}, report:{open:false, reason:'', done:false}
};

/* ---------- Helpers ---------- */
const $ = sel => document.querySelector(sel);
const esc = s => String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const NOW=()=>new Date();
function fmtDate(iso){ const d=new Date(iso); return MONTHS[d.getMonth()]+' '+d.getDate()+(d.getFullYear()!==NOW().getFullYear()?', '+d.getFullYear():''); }
function ago(iso){ const d=(NOW()-new Date(iso))/86400000; if(d<1) return 'Today'; if(d<2) return 'Yesterday'; if(d<7) return Math.floor(d)+' days ago'; if(d<30) return Math.floor(d/7)+' wk ago'; return fmtDate(iso); }
function dur(s){ s=Math.max(0,Math.round(+s||0)); return Math.floor(s/60)+':'+String(s%60).padStart(2,'0'); }
const initials = n => (n||'L').split(' ').map(p=>p[0]).join('').replace('.','').slice(0,2).toUpperCase();
function av(u, size='m', king=false){ u=u||{name:'Lifter',h:200}; return '<div class="av av-'+size+(king?' king':'')+'" style="--h:'+(u.h||200)+'" aria-hidden="true">'+initials(u.name)+'</div>'; }
const ageOf = by => by ? NOW().getFullYear()-by : null;
const W = w => (Math.round(+w*10)/10).toString();

const I = {
  crown:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 18h18l-1.6-9.2-4.7 3.6L12 5l-2.7 7.4L4.6 8.8 3 18zm0 2h18v1.5H3z"/></svg>',
  check:'<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  play:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l12-7.5z"/></svg>',
  back:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
  close:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  pin:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5a7 7 0 0114 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>',
  people:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0113 0"/><path d="M16 4.5a3.5 3.5 0 010 7M18 14a6.5 6.5 0 013.5 6"/></svg>',
  search:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg>',
  locate:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="8"/><path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3"/></svg>',
  camera:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="7" width="13" height="11" rx="2.5"/><path d="M16 11l5-3v9l-5-3"/></svg>',
  clock:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>',
  bench:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10h18M6 7v6M18 7v6M9 8.5v3M15 8.5v3"/><path d="M7 20l3-7M17 20l-3-7"/></svg>',
  squat:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18M6 3.5v5M18 3.5v5M9 4.5v3M15 4.5v3"/><circle cx="12" cy="9.5" r="1.6"/><path d="M12 11v3l-3.5 2.5v4M12 14l3.5 2.5v4"/></svg>',
  dead:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 18h18M6 15.5v5M18 15.5v5M9 16.5v3M15 16.5v3"/><circle cx="12" cy="4.5" r="1.6"/><path d="M12 6.5v3M12 9.5L8.5 14M12 9.5l3.5 4.5M8.5 14v3.5M15.5 14v3.5"/></svg>',
  podium:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 21V9h6v12M3 21v-7h6M15 21v-9h6v9M2.5 21h19"/></svg>',
  user:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0116 0"/></svg>',
  plus:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
  info:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 100 20 10 10 0 000-20zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>',
  share:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V4M7.5 8.5L12 4l4.5 4.5"/><path d="M5 13v6h14v-6"/></svg>',
  shield:'<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.5l8 3v6c0 5-3.4 8.6-8 10-4.6-1.4-8-5-8-10v-6l8-3z"/><path d="M8.4 12.1l2.4 2.4 4.8-5"/></svg>',
  flag:'<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 21V4h11l-1.5 4L16 12H5"/></svg>',
  gear:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/></svg>',
  chev:'<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>',
  chevd:'<svg class="chev" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>'
};
const CROWN_PATH='M3 18h18l-1.6-9.2-4.7 3.6L12 5l-2.7 7.4L4.6 8.8 3 18zm0 2h18v1.5H3z';
const verifiedChip = (t='Verified') => '<span class="chip chip-verified">'+I.check+t+'</span>';
const reviewChip = (t='Under review') => '<span class="chip chip-review">'+I.clock.replace('<svg','<svg fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"')+t+'</span>';
const rejectedChip = (t='Not approved') => '<span class="chip chip-review" style="color:#F27A6A;background:rgba(242,122,106,.14)">'+I.close.replace('<svg','<svg fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"')+t+'</span>';
const errBox = m => '<div class="info-box" style="border-color:#F27A6A;color:#F27A6A">'+I.info.replace('<svg','<svg style="fill:#F27A6A"')+'<span>'+esc(m)+'</span></div>';
const pinIcon = () => I.pin.replace('<svg','<svg fill="none" stroke="currentColor"');
const miniCrown = () => '<svg class="mini-crown" viewBox="0 0 24 24"><path d="'+CROWN_PATH+'"/></svg>';

// A lift record for thumbnails and the video modal. Normalized from board rows (lift_id) and my lifts (id).
const VIDEOS={};
function rec(r){ const id=r.lift_id||r.id; const o={lift_id:id, user_id:r.user_id, gym_id:r.gym_id!=null?+r.gym_id:null, lift:r.lift, weight_lb:+r.weight_lb, reps:r.reps||1, recorded_at:r.recorded_at, video_seconds:r.video_seconds, video_path:r.video_path, status:r.status||'approved'}; VIDEOS[id]=o; return o; }
function thumb(r, opts={}){
  const x=rec(r); const u=person(x.user_id); const cls='thumb'+(opts.cls?' '+opts.cls:'');
  const cap = opts.cap ? '<div class="cap">'+W(x.weight_lb)+' lb<small>'+LIFTS[x.lift].short+' · '+fmtDate(x.recorded_at)+'</small></div>' : '';
  const tag = opts.tag ? '<div class="tag">'+opts.tag+'</div>' : '';
  const d = opts.cap ? '' : '<span class="dur">'+dur(x.video_seconds||0)+'</span>';
  return '<button class="'+cls+'" style="--h:'+(u.h||200)+'" data-video="'+x.lift_id+'" aria-label="Play '+esc(u.name)+' '+LIFTS[x.lift].name+' '+W(x.weight_lb)+' lb"><span class="bar"></span><span class="play">'+I.play+'</span>'+tag+d+cap+'</button>';
}

/* ---------- Navigation ---------- */
function go(screen, extra={}){ Object.assign(S, extra); S.screen=screen; render(true); }
function render(reset){
  const sc=$('#screen'); const keep = reset ? 0 : sc.scrollTop;
  let html='';
  switch(S.screen){
    case 'discover': html=vDiscover(); break;
    case 'gym': html=vGym(); break;
    case 'leaderboards': html=vLeaderboards(); break;
    case 'submit': html=vSubmit(); break;
    case 'profile': html=vProfile(); break;
    case 'auth': html=vAuth(); break;
    case 'review': html=vReview(); break;
  }
  if(S.screen!=='discover' && MAPEL.parentNode) PARK.appendChild(MAPEL);
  sc.innerHTML='<div class="view'+(reset?'':' noanim')+(S.screen==='discover'?' full':'')+'">'+html+'</div>'+(S.toast?'<div class="toast">'+I.check+esc(S.toast)+'</div>':'');
  if(!reset){ sc.querySelector('.view').style.animation='none'; sc.scrollTop=keep; } else sc.scrollTop=0;
  renderNav();
  if(S.screen==='discover') mountMap();
  if(S.screen==='submit' && S.submit.step===4) requestAnimationFrame(()=>document.querySelectorAll('.track i[data-w]').forEach(i=>i.style.width=i.dataset.w+'%'));
  if(S.screen==='profile') requestAnimationFrame(()=>document.querySelectorAll('.track i[data-w]').forEach(i=>i.style.width=i.dataset.w+'%'));
  const modal=$('#modal'); if(modal) modal.remove();
  if(S.video) document.getElementById('app').insertAdjacentHTML('beforeend', vVideo());
  else if(S.citySheet) document.getElementById('app').insertAdjacentHTML('beforeend', vCitySheet());
}
function renderNav(){
  const tab = S.screen==='gym' ? 'discover' : (S.screen==='auth'||S.screen==='review') ? 'profile' : S.screen;
  const b=(id,icon,label)=>'<button class="nav-btn'+(tab===id?' on':'')+'" data-nav="'+id+'" aria-label="'+label+'">'+icon+'<span>'+label+'</span></button>';
  $('#nav').innerHTML = b('discover',I.pin,'Discover')+b('leaderboards',I.podium,'Ranks')+
    '<button class="nav-submit'+(tab==='submit'?' on':'')+'" data-nav="submit" aria-label="Submit a lift">'+I.plus+'</button>'+
    b('profile',I.user,'Profile');
}
function toast(msg){ S.toast=msg; const old=$('.toast'); if(old) old.remove(); $('#screen').insertAdjacentHTML('beforeend','<div class="toast">'+I.check+esc(msg)+'</div>'); clearTimeout(toast.t); toast.t=setTimeout(()=>{S.toast=null; const t=$('.toast'); if(t) t.remove();},2400); }
const meAvatarBtn = () => '<button class="icon-btn" data-nav="profile" aria-label="Your profile" style="'+(MEP?'width:36px;height:36px;padding:0;background:none;border:0':'width:36px;height:36px')+'">'+(MEP?av(person(MEP.id),'s'):I.user)+'</button>';

/* ---------- Map (Leaflet) ---------- */
const PARK=document.createElement('div'); PARK.style.display='none'; document.body.appendChild(PARK);
const MAPEL=document.createElement('div'); MAPEL.id='map'; PARK.appendChild(MAPEL);
let MAP=null, PINS=null, MEPIN=null, loadT=null, loadSeq=0;
function initMap(){
  if(MAP) return;
  MAP=L.map(MAPEL,{attributionControl:true, minZoom:4, maxZoom:17, zoomSnap:0.5, zoomControl:false});
  L.control.zoom({position:'topright'}).addTo(MAP);
  MAP.attributionControl.setPrefix('');
  MAP.setView(S.view.center, S.view.zoom);
  if(API.live){
    L.tileLayer(TILE_BASE,{maxNativeZoom:16, maxZoom:17, attribution:TILE_ATTR}).addTo(MAP);
    L.tileLayer(TILE_REF,{maxNativeZoom:16, maxZoom:17, pane:'tilePane'}).addTo(MAP);
  } else {
    L.imageOverlay(LA_IMG.url, LA_IMG.bounds).addTo(MAP);
    L.tileLayer('tiles/{z}/{x}/{y}.jpg',{minNativeZoom:12, maxNativeZoom:14, minZoom:11, maxZoom:16, bounds:L.latLngBounds(LA_IMG.bounds), errorTileUrl:'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', attribution:TILE_ATTR}).addTo(MAP);
    MAP.setMaxBounds(L.latLngBounds(LA_IMG.bounds).pad(0.05)); MAP.setMinZoom(11); MAP.setMaxZoom(16);
  }
  PINS=L.layerGroup().addTo(MAP);
  MEPIN=L.marker(S.me,{icon:L.divIcon({className:'mepin',html:'<i></i>',iconSize:[14,14],iconAnchor:[7,7]}),interactive:false,zIndexOffset:-100}).addTo(MAP);
  MAPEL.insertAdjacentHTML('beforeend','<div class="inview" id="inview"><i></i><span>Loading gyms…</span></div><button class="near" id="near">'+I.locate+'Near me</button>');
  MAP.on('moveend', ()=>{ S.view.center=[MAP.getCenter().lat,MAP.getCenter().lng]; S.view.zoom=MAP.getZoom(); syncCity(); scheduleLoad(); });
  MAP.on('zoomend', ()=>drawPins());
  scheduleLoad(0);
}
function mountMap(){
  const slot=document.getElementById('mapslot'); if(!slot) return;
  if(API.live===null) return;
  slot.appendChild(MAPEL);
  if(!MAP) initMap(); else { MAP.invalidateSize(); drawPins(); }
}
function scheduleLoad(ms=250){ clearTimeout(loadT); loadT=setTimeout(loadView, ms); }
async function loadView(){
  if(!MAP) return;
  const seq=++loadSeq; const b=MAP.getBounds();
  S.view.loading=true; updateInview();
  let rows=[];
  try{ rows=await gymsInBox(b.getSouth(), b.getWest(), b.getNorth(), b.getEast()); } catch(e){ rows=[]; }
  if(seq!==loadSeq) return;
  S.view.ids=rows.map(g=>g.id); S.view.loading=false; S.view.total=rows.length;
  await loadTitleCounts(S.view.ids);
  if(seq!==loadSeq) return;
  pickFeatured(); drawPins(); updateInview(); updateSheet();
  if(S.featured) loadBoard(S.featured).then(()=>{ if(S.screen==='discover') updateSheet(); });
}
function updateInview(){
  const el=document.getElementById('inview'); if(!el) return;
  const n=S.view.ids.length;
  el.className='inview'+(API.live===false?' off':'');
  el.innerHTML='<i></i>'+(S.view.loading?'<span>Loading gyms…</span>':'<span><b>'+n+'</b> gym'+(n===1?'':'s')+(n>=320?'+':'')+' in view'+(API.live===false?' · offline preview':'')+'</span>');
}
function pickFeatured(){
  const c=S.view.center; const ids=S.view.ids;
  if(!ids.length){ S.featured=null; return; }
  const home=HOME();
  if(home && GYM[home] && ids.includes(home) && distKm(c[0],c[1],GYM[home].lat,GYM[home].lon)<9){ S.featured=home; return; }
  S.featured = ids.slice().sort((a,b)=> heldCount(b)-heldCount(a) || distKm(c[0],c[1],GYM[a].lat,GYM[a].lon)-distKm(c[0],c[1],GYM[b].lat,GYM[b].lon))[0];
}
function drawPins(){
  if(!PINS) return; PINS.clearLayers();
  const z=MAP.getZoom(); const showLabels=z>=13.5; const showIndie=z>=11.5;
  S.view.ids.forEach(id=>{
    const g=GYM[id]; if(!g) return; const f=id===S.featured; const indie=!g.brand;
    if(indie && !showIndie && !f) return;
    const n=heldCount(id);
    const html='<div class="dot">'+I.crown+(n?'<span class="n">'+n+'</span>':'')+'</div>'+((showLabels||f)?'<div class="lbl">'+esc(g.brand?g.brand:g.name)+(f||z>=15?'<small>'+esc(g.city||'')+'</small>':'')+'</div>':'');
    const w=f?44:(indie?26:34), h=w+((showLabels||f)?28:0);
    const m=L.marker([g.lat,g.lon],{icon:L.divIcon({className:'gpin'+(f?' featured':'')+(indie?' indie':''),html,iconSize:[160,h],iconAnchor:[80,w/2]}),keyboard:true,title:gymLabel(g),zIndexOffset:f?1000:(n?200:0)});
    m.on('click',()=>openGym(id));
    m.on('keypress',e=>{ if(e.originalEvent.key==='Enter') openGym(id); });
    PINS.addLayer(m);
  });
}
function syncCity(){
  const c=S.view.center; let best=null, bd=1e9;
  CITIES.forEach(x=>{ const d=distKm(c[0],c[1],x.lat,x.lon); if(d<bd){ bd=d; best=x; } });
  S.city = bd<60 ? best.id : null;
  const pill=document.querySelector('.city-pill[data-opencity] span'); if(pill) pill.textContent = S.city ? CITY[S.city].name : 'Map';
}
function flyTo(lat,lon,zoom){ if(!MAP) return; MAP.flyTo([lat,lon], zoom, {duration:.8}); }
function openGym(id){ id=+id; S.gymId=id; S.gymTab='recent'; S.search=''; S.searchHits=[]; go('gym'); loadBoard(id).then(()=>{ if(S.screen==='gym'&&S.gymId===id) render(false); }); }

/* ---------- Discover ---------- */
function vDiscover(){
  const c=S.city?CITY[S.city]:null;
  return '<div class="discover">'+
    '<div class="map-wrap" id="mapslot"></div>'+
    '<div class="map-top">'+
      '<div class="brand"><div class="logo">'+I.crown+'Apex Lifts</div><button class="city-pill" data-opencity="1" aria-label="Change city">'+pinIcon()+'<span>'+esc(c?c.name:'Map')+'</span>'+I.chevd+'</button>'+meAvatarBtn()+'</div>'+
      '<label class="search">'+I.search+'<input id="search" type="search" placeholder="Search gyms or cities" value="'+esc(S.search)+'" autocomplete="off" aria-label="Search gyms or cities"></label><div id="sresults">'+searchResultsHtml()+'</div>'+
    '</div>'+
    '<div class="sheet" id="sheet">'+sheetHtml()+'</div>'+
  '</div>';
}
function searchResultsHtml(){
  const q=S.search.trim().toLowerCase(); if(!q) return '';
  const cityHits = CITIES.filter(x=>(x.name+' '+x.state+' '+STATE_NAMES[x.state]).toLowerCase().includes(q)).slice(0,3);
  const gymHits = S.searchHits;
  if(!cityHits.length && !gymHits.length) return '<div class="search-results"><div class="sr"><span><b>'+(S.searching?'Searching…':'No gyms or cities match')+'</b><small>Try a gym name or a city</small></span></div></div>';
  return '<div class="search-results">'+
    cityHits.map(x=>'<button class="sr" data-city="'+x.id+'"><span class="ic ic-city">'+I.pin+'</span><span><b>'+esc(x.name)+', '+x.state+'</b><small>'+x.gyms.toLocaleString()+' gyms within 15 mi</small></span></button>').join('')+
    gymHits.map(g=>'<button class="sr" data-gym="'+g.id+'"><span class="ic">'+I.crown+'</span><span><b>'+esc(gymLabel(g))+'</b><small>'+esc((g.street?g.street+', ':'')+(g.city||'')+(g.state?', '+g.state:''))+'</small></span></button>').join('')+
  '</div>';
}
function sheetHtml(){
  const fid=S.featured; const c=S.view.center;
  if(S.view.loading && !fid) return '<div class="grab"></div><div class="loading-row"><i></i>Finding gyms near here…</div>';
  if(!fid) return '<div class="grab"></div><div class="empty" style="padding:18px 0"><b>No gyms in view</b>'+(API.live?'Zoom out or search for a city.':'This preview covers the Lakewood area.')+'</div>';
  const feat=GYM[fid]; const held=heldCount(fid); const home=fid===HOME();
  const dkm=distKm(S.me[0],S.me[1],feat.lat,feat.lon); const n=boardLifters(fid);
  const others=S.view.ids.filter(id=>id!==fid).map(id=>GYM[id]).sort((a,b)=>distKm(c[0],c[1],a.lat,a.lon)-distKm(c[0],c[1],b.lat,b.lon)).slice(0,14);
  return '<div class="grab"></div>'+
    '<div class="feat">'+
      '<div class="feat-head">'+
        '<div class="grow"><div class="eyebrow">'+(home?'Your gym · '+miles(dkm)+' mi away':'Featured · '+miles(dkm)+' mi from you')+'</div><h2>'+esc(gymLabel(feat))+'</h2><div class="sub">'+(n?n+' verified lifter'+(n===1?'':'s')+' · ':'No verified lifters yet · ')+(held===3?'3 titles up for grabs':(3-held)+' title'+(3-held>1?'s':'')+' vacant')+'</div></div>'+
        '<button class="btn btn-accent btn-sm" data-gym="'+fid+'">Title board</button>'+
      '</div>'+
      '<div class="kings">'+LIFT_ORDER.map(l=>{ const h=titleHolder(fid,l); const p=h?person(h.user_id):null; return '<button class="king-mini" data-gym="'+fid+'"><div class="top">'+I.crown+'<span>'+LIFTS[l].title+'</span></div>'+(h?'<div class="w">'+W(h.weight_lb)+'<small>LB</small></div><div class="who">'+av(p,'s')+'<span>'+esc(p.name)+'</span></div>':'<div class="w vac">Vacant</div><div class="who"><span style="color:var(--accent)">Claim it first</span></div>'); }).join('')+'</div>'+
      '<div><div class="eyebrow" style="margin-bottom:8px">Gyms in view · '+S.view.ids.length+(S.view.ids.length>=320?'+':'')+'</div><div class="nearby">'+others.map(g=>'<button class="nb" data-gym="'+g.id+'"><b>'+esc(g.name)+'</b><small>'+esc(g.city||'')+' · '+miles(distKm(S.me[0],S.me[1],g.lat,g.lon))+' mi</small><small>'+I.crown+heldCount(g.id)+'/3 titles held</small></button>').join('')+'</div></div>'+
    '</div>';
}
function updateSheet(){ const s=document.getElementById('sheet'); if(s) s.innerHTML=sheetHtml(); }
function vCitySheet(){
  return '<div class="modal" id="modal"><button class="scrim" data-closecity="1" aria-label="Close"></button><div class="city-sheet"><div class="grab"></div>'+
    '<div class="section-h" style="padding:0 16px 4px"><h3 class="h-m">Jump to a city</h3><span class="muted" style="font-size:13px">'+(API.live?'88,641 gyms nationwide':'Lakewood area preview')+'</span></div>'+
    '<div class="list" style="padding:0 16px 12px">'+CITIES.map(c=>{ const on=c.id===S.city;
      return '<button class="row city-row'+(on?' on':'')+'" data-city="'+c.id+'"><div class="grow"><div class="name"><span class="t">'+esc(c.name)+', '+c.state+'</span></div><div class="meta">'+c.gyms.toLocaleString()+' gyms within 15 mi</div></div>'+(on?'<span class="chip chip-verified">'+I.check+'Here</span>':'<span class="muted chev-ic">'+I.chev+'</span>')+'</button>'; }).join('')+
    '</div></div></div>';
}
let searchT=null, searchSeq=0;
function runSearch(){
  clearTimeout(searchT);
  const q=S.search.trim(); if(!q){ S.searchHits=[]; S.searching=false; paintSearch(); return; }
  S.searching=true; paintSearch();
  searchT=setTimeout(async()=>{ const seq=++searchSeq; let hits=[]; try{ hits=await searchGyms(q); }catch(e){} if(seq!==searchSeq) return; S.searchHits=hits; S.searching=false; paintSearch(); }, 220);
}
function paintSearch(){ const el=document.getElementById('sresults'); if(el) el.innerHTML=searchResultsHtml(); }

/* ---------- Gym profile ---------- */
function vGym(){
  const g=GYM[S.gymId];
  if(!g||!g.name){ gymById(S.gymId).then(x=>{ if(x&&S.screen==='gym'&&S.gymId==x.id){ loadBoard(x.id).then(()=>render(false)); } }); return '<div class="topbar"><button class="icon-btn" data-nav="discover" aria-label="Back to map">'+I.back+'</button></div><div class="loading-row" style="padding:16px"><i></i>Loading gym…</div>'; }
  const rows=boardRows(g.id); const loaded=!!BOARD[g.id]; const me=myId();
  const approved=rows.filter(r=>r.status==='approved'); const mine=rows.filter(r=>r.user_id===me && r.status!=='approved');
  const lifters=new Set(approved.map(r=>r.user_id)).size;
  const vacancies = LIFT_ORDER.filter(l=>!titleHolder(g.id,l)).length;
  const status = !loaded ? 'Loading board…' : vacancies ? vacancies+' title'+(vacancies>1?'s':'')+' vacant · claim one' : '3 titles up for grabs';
  const platesSvg='<svg class="plates" viewBox="0 0 200 200" aria-hidden="true"><circle cx="100" cy="100" r="90" fill="none" stroke="rgba(255,255,255,.06)" stroke-width="18"/><circle cx="100" cy="100" r="62" fill="none" stroke="rgba(255,255,255,.05)" stroke-width="14"/><circle cx="100" cy="100" r="36" fill="none" stroke="rgba(240,194,90,.12)" stroke-width="10"/><circle cx="100" cy="100" r="12" fill="rgba(255,255,255,.05)"/></svg>';
  const cards = LIFT_ORDER.map(l=>{
    const h=titleHolder(g.id,l);
    const pend = mine.filter(p=>p.lift===l && p.status==='pending' && (!h || +p.weight_lb>+h.weight_lb));
    if(!h) return '<article class="title-card vacant"><div class="tc-head"><div class="tc-title">'+I.crown+LIFTS[l].title+'</div><span class="tc-lift">'+LIFTS[l].name+'</span></div><div class="tc-body" style="grid-template-columns:1fr"><div><div class="tc-weight">Vacant</div><p class="sub" style="margin:8px 0 0">No verified '+LIFTS[l].name.toLowerCase()+' at this gym yet. The first approved lift takes the crown.</p></div></div>'+(pend.length?'<div class="tc-note"><i></i>Your '+W(pend[0].weight_lb)+' lb claim is under review</div>':'')+'<div class="tc-cta"><button class="btn btn-accent" data-challenge="'+l+'" data-gymid="'+g.id+'">Claim this title</button></div></article>';
    const p=person(h.user_id);
    return '<article class="title-card">'+
      '<div class="tc-head"><div class="tc-title">'+I.crown+LIFTS[l].title+'</div><span class="tc-lift">'+LIFTS[l].name+'</span></div>'+
      '<div class="tc-body">'+
        '<div style="min-width:0"><div class="tc-champ">'+av(p,'m',true)+'<div style="min-width:0"><div class="nm">'+esc(p.name)+(h.user_id===me?' <span class="chip chip-you">You</span>':'')+'</div><div class="dt">Set '+fmtDate(h.recorded_at)+'</div></div></div>'+
        '<div class="tc-weight">'+W(h.weight_lb)+'<small>LB</small></div>'+
        '<div class="tc-chips">'+verifiedChip()+'<span class="chip chip-neutral">1 rep</span></div></div>'+
        thumb(h,{cls:'tc-thumb'})+
      '</div>'+
      (pend.length?'<div class="tc-note"><i></i>Your '+W(pend[0].weight_lb)+' lb challenge is under review</div>':'')+
      '<div class="tc-cta"><button class="btn btn-accent" data-challenge="'+l+'" data-gymid="'+g.id+'">'+(h.user_id===me?'Defend this title':'Challenge this title')+'</button><button class="btn btn-ghost" style="flex:0 0 48px;padding:0" data-share="'+l+'" aria-label="Share">'+I.share+'</button></div>'+
    '</article>';
  }).join('');
  const tabs=[['recent','Recent lifts'],['lb','Leaderboard'],['people','People']];
  let body='';
  if(!loaded) body='<div class="loading-row"><i></i>Loading lifts…</div>';
  else if(S.gymTab==='recent'){
    const recs=approved.slice(0,12);
    body='<div class="list">'+
      mine.map(p=>'<div class="row">'+thumb(p,{cls:'thumb-s'})+'<div class="grow"><div class="name"><span class="t">'+esc(person(p.user_id).name)+'</span><span class="chip chip-you">You</span></div><div class="meta">'+LIFTS[p.lift].name+' · '+p.reps+' rep'+(p.reps>1?'s':'')+' · '+ago(p.recorded_at)+'</div><div style="margin-top:4px">'+(p.status==='pending'?reviewChip():rejectedChip())+'</div></div><div class="w">'+W(p.weight_lb)+'<small>LB</small></div></div>').join('')+
      recs.map(r=>{ const u=person(r.user_id); const th=titleHolder(g.id,r.lift); const king=!!th&&th.lift_id===r.lift_id; return '<div class="row">'+thumb(r,{cls:'thumb-s'})+'<div class="grow"><div class="name">'+(king?miniCrown():'')+'<span class="t">'+esc(u.name)+'</span>'+(r.user_id===me?'<span class="chip chip-you">You</span>':'')+'</div><div class="meta">'+LIFTS[r.lift].name+' · '+(r.reps>1?r.reps+' reps · ':'')+ago(r.recorded_at)+(king?' · '+LIFTS[r.lift].title:'')+'</div><div style="margin-top:4px">'+verifiedChip()+'</div></div><div class="w">'+W(r.weight_lb)+'<small>LB</small></div></div>'; }).join('')+
      (recs.length||mine.length?'':'<div class="empty"><b>No verified lifts yet</b>Be the first lifter on the board at '+esc(gymLabel(g))+'.</div>')+
    '</div>';
  } else if(S.gymTab==='lb'){
    const l=S.gymLbLift; const best={};
    approved.filter(r=>r.lift===l&&r.reps===1).forEach(r=>{ const c=best[r.user_id]; if(!c||+r.weight_lb>+c.weight_lb) best[r.user_id]=r; });
    const list=Object.values(best).sort((a,b)=>b.weight_lb-a.weight_lb||(a.recorded_at<b.recorded_at?-1:1));
    body='<div style="padding-top:12px"><div class="seg">'+LIFT_ORDER.map(k=>'<button class="'+(k===l?'on':'')+'" data-gymlb="'+k+'">'+LIFTS[k].short+'</button>').join('')+'</div></div>'+
      '<div class="list" style="margin-top:4px">'+list.map((r,i)=>{ const u=person(r.user_id); return '<div class="row'+(r.user_id===me?' me':'')+'"><span class="rk'+(i<3?' top3':'')+'">'+(i+1)+'</span>'+av(u,'m',i===0)+'<div class="grow"><div class="name">'+(i===0?miniCrown():'')+'<span class="t">'+esc(u.name)+'</span>'+(r.user_id===me?'<span class="chip chip-you">You</span>':'')+'</div><div class="meta">'+(i===0?LIFTS[l].title+' · ':'')+(r.bodyweight_lb?W(r.bodyweight_lb)+' lb · ':'')+fmtDate(r.recorded_at)+'</div></div><div class="w">'+W(r.weight_lb)+'<small>LB</small></div></div>'; }).join('')+'</div>'+
      (list.length?'':'<div class="empty"><b>Nobody ranked yet</b>Submit a verified '+LIFTS[l].name.toLowerCase()+' to start the board.</div>')+
      '<div style="padding:12px 0 4px"><button class="btn btn-ghost btn-block" data-nav="leaderboards" data-lbscope="city">See city, state and national ranks</button></div>';
  } else {
    const ids=[...new Set(approved.map(r=>r.user_id))];
    body='<div class="people">'+ids.map(uid=>{ const u=person(uid); const t=LIFT_ORDER.filter(l=>isKing(uid,g.id,l)); const total=LIFT_ORDER.reduce((s,l)=>{ const b=approved.filter(r=>r.user_id===uid&&r.lift===l&&r.reps===1).sort((a,c)=>c.weight_lb-a.weight_lb)[0]; return s+(b?+b.weight_lb:0); },0); return '<div class="person">'+av(u,'l',t.length>0)+'<b>'+esc(u.name)+(uid===me?' (You)':'')+'</b>'+(t.length?'<span class="chip chip-gold">'+I.crown+t.map(k=>LIFTS[k].title).join(' · ')+'</span>':'<small>'+W(total)+' lb total</small>')+'</div>'; }).join('')+'</div>'+(ids.length?'':'<div class="empty"><b>No lifters yet</b>Nobody has posted a verified lift here.</div>');
  }
  const tierChip = g.brand ? '<span class="chip chip-neutral tier-chip">'+esc(g.brand)+'</span>' : '<span class="chip chip-neutral tier-chip">Independent</span>';
  const homeBtn = MEP ? (HOME()===g.id ? '<span class="chip chip-verified">'+I.check+'Home gym</span>' : '<button class="chip chip-neutral" data-sethome="'+g.id+'">Make this my home gym</button>') : '';
  return '<header class="gym-hero">'+platesSvg+
      '<div class="topbar"><button class="icon-btn" data-nav="discover" aria-label="Back to map">'+I.back+'</button><div class="grow"></div>'+meAvatarBtn()+'</div>'+
      '<div class="eyebrow">Title board</div><h1>'+esc(gymTitle(g))+'<small>'+esc(gymSub(g))+(g.state?', '+esc(g.state):'')+'</small></h1>'+
      '<div class="gym-meta"><span>'+pinIcon()+esc((g.street?g.street+', ':'')+(g.city||''))+'</span><span>'+I.people.replace('<svg','<svg fill="none" stroke="currentColor"')+lifters+' verified lifter'+(lifters===1?'':'s')+'</span>'+tierChip+homeBtn+'</div>'+
      '<div class="status-line"><i></i>'+status+'</div>'+
    '</header>'+
    '<div class="titles stagger">'+cards+'</div>'+
    '<section class="section"><div class="tabs">'+tabs.map(t=>'<button class="'+(S.gymTab===t[0]?'on':'')+'" data-gymtab="'+t[0]+'">'+t[1]+'</button>').join('')+'</div>'+body+'</section>'+
    '<div style="height:24px"></div>';
}

/* ---------- Leaderboards ---------- */
function lbKey(){ const {scope,lift}=S.lb; const c=S.city?CITY[S.city]:null; return scope+':'+lift+':'+(scope==='gym'?HOME():scope==='city'?(c?c.id:'map:'+S.view.center.map(x=>x.toFixed(2)).join(',')):scope==='state'?(c?c.state:'?'):'us'); }
async function ensureLb(){
  const key=lbKey(); if(S.lb.key===key && (S.lb.rows||S.lb.loading)) return;
  S.lb.key=key; S.lb.rows=null; S.lb.loading=true;
  const {scope,lift}=S.lb; const c=S.city?CITY[S.city]:null; const center=c?[c.lat,c.lon]:S.view.center;
  let rows=[];
  try{
    if(await probe()){
      if(scope==='gym' && !HOME()) rows=[];
      else rows=await rpc('leaderboard',{p_lift:lift, p_scope:scope, p_lat:center[0], p_lon:center[1], p_radius_m:40000, p_state:c?c.state:null, p_gym_id:HOME(), lim:100});
    }
  } catch(e){ rows=[]; }
  rows.forEach(r=>{ person(r.user_id,r); putGym({id:r.gym_id,name:r.gym_name,brand:r.gym_brand,city:r.gym_city,state:r.gym_state}); });
  if(S.lb.key!==key) return;
  S.lb.rows=rows; S.lb.loading=false; if(S.screen==='leaderboards') render(false);
}
const BW_CLASSES = [
  {k:'all', l:'All weights', test:()=>true},
  {k:'u165', l:'Under 165', test:bw=>bw!=null&&bw<165},
  {k:'165', l:'165–198', test:bw=>bw>=165&&bw<198},
  {k:'198', l:'198–231', test:bw=>bw>=198&&bw<231},
  {k:'231', l:'231+', test:bw=>bw>=231}
];
const AGE_GROUPS = [
  {k:'all', l:'All ages', test:()=>true},
  {k:'u25', l:'18–24', test:a=>a!=null&&a<25},
  {k:'25', l:'25–34', test:a=>a>=25&&a<35},
  {k:'35', l:'35+', test:a=>a>=35}
];
function lbRows(){
  if(!S.lb.rows) return null; const {bwc,age}=S.lb;
  const bwT=BW_CLASSES.find(x=>x.k===bwc).test, agT=AGE_GROUPS.find(x=>x.k===age).test;
  return S.lb.rows.filter(r=>bwT(r.bodyweight_lb!=null?+r.bodyweight_lb:null)&&agT(ageOf(r.birth_year)));
}
function vLeaderboards(){
  ensureLb();
  const {scope,lift,bwc,age,open}=S.lb; const c=S.city?CITY[S.city]:null; const rows=lbRows(); const first=rows&&rows[0]; const me=myId();
  const scopeName={gym:HOME()&&GYM[HOME()]?gymLabel(GYM[HOME()]):'My gym',city:c?c.name:'Around here',state:c?STATE_NAMES[c.state]:'State',global:'United States'}[scope];
  const scopes=[['gym','My gym'],['city','City'],['state','State'],['global','National']];
  const activeF=(bwc!=='all')+(age!=='all');
  const MAX=50; const shown=rows?rows.slice(1,MAX):[];
  let first_html;
  if(scope==='gym' && !HOME()) first_html='<div class="empty"><b>Pick a home gym</b>Open any gym\'s title board and tap "Make this my home gym".</div>';
  else if(!rows) first_html='<div class="loading-row" style="padding:24px 16px"><i></i>Ranking '+esc(scopeName)+'…</div>';
  else if(first){ const p=person(first.user_id); const g=GYM[first.gym_id]; rec({lift_id:first.lift_id,user_id:first.user_id,gym_id:first.gym_id,lift,weight_lb:first.weight_lb,recorded_at:first.recorded_at,status:'approved'});
    first_html='<section class="lb-first"><span class="rank">#1</span><div class="crown-big">'+I.crown+'</div><div class="who">'+av(p,'xl',true)+'<div><div class="nm">'+esc(p.name)+(first.user_id===me?'<span class="chip chip-you">You</span>':'')+'</div><div class="gy">'+esc(gymLabel(g))+(scope!=='gym'&&scope!=='city'?', '+esc(g.state||''):'')+'</div></div></div><div class="big">'+W(first.weight_lb)+'<small>LB</small></div><div class="foot"><span class="chip chip-gold">'+I.crown+LIFTS[lift].title+(scope==='gym'?'':' · '+esc(g.city||''))+'</span>'+verifiedChip()+'<span class="chip chip-neutral">'+fmtDate(first.recorded_at)+'</span></div></section>'; }
  else first_html='<div class="empty"><b>Nobody ranked yet</b>'+(activeF?'No verified lifts match these filters.':'The first verified '+LIFTS[lift].name.toLowerCase()+' here takes the top spot.')+'</div>';
  return '<div class="lb-top">'+
      '<div class="topbar" style="padding:0;min-height:0"><div class="grow"><div class="eyebrow">Leaderboards</div><h1 class="h-xl">'+esc(scopeName)+'</h1></div><button class="icon-btn" data-lbopen="1" aria-label="Filters" style="'+(activeF?'border-color:var(--accent);color:var(--accent)':'')+'"><svg viewBox="0 0 24 24"><path d="M4 6h16M7 12h10M10 18h4"/></svg></button></div>'+
      '<div class="seg">'+scopes.map(x=>'<button class="'+(scope===x[0]?'on':'')+'" data-lbscope="'+x[0]+'">'+x[1]+'</button>').join('')+'</div>'+
      ((scope==='city'||scope==='state')?'<div class="lb-city"><span>Ranking in</span><button class="city-pill" data-opencity="1">'+pinIcon()+'<span>'+esc(c?c.name+', '+c.state:'map area')+'</span>'+I.chevd+'</button><span>'+(rows?rows.length+' lifter'+(rows.length===1?'':'s'):'')+'</span></div>':(scope==='global'&&rows?'<div class="lb-city"><span>'+rows.length+' verified lifter'+(rows.length===1?'':'s')+' nationwide</span></div>':''))+
      '<div class="pills">'+LIFT_ORDER.map(k=>'<button class="pill'+(lift===k?' on-accent':'')+'" data-lblift="'+k+'">'+LIFTS[k].short+'</button>').join('')+'</div>'+
      (open?'<div class="filters"><div><div class="lbl">Bodyweight class</div><div class="pills">'+BW_CLASSES.map(x=>'<button class="pill'+(bwc===x.k?' on':'')+'" data-lbbw="'+x.k+'">'+x.l+'</button>').join('')+'</div></div><div><div class="lbl">Age group</div><div class="pills">'+AGE_GROUPS.map(x=>'<button class="pill'+(age===x.k?' on':'')+'" data-lbage="'+x.k+'">'+x.l+'</button>').join('')+'</div></div></div>':'')+
    '</div>'+
    first_html+
    '<div class="lb-list"><div class="list">'+shown.map((r,i)=>{ const rank=i+2; const p=person(r.user_id); const g=GYM[r.gym_id]; return '<div class="row'+(r.user_id===me?' me':'')+'"><span class="rk'+(rank<=3?' top3':'')+'">'+rank+'</span>'+av(p,'m')+'<div class="grow"><div class="name"><span class="t">'+esc(p.name)+'</span>'+(r.user_id===me?'<span class="chip chip-you">You</span>':'')+'</div><div class="meta">'+(scope==='gym'?(r.bodyweight_lb?W(r.bodyweight_lb)+' lb · ':'')+fmtDate(r.recorded_at):esc(gymLabel(g))+(scope!=='city'?', '+esc(g.state||''):''))+'</div></div><div class="w">'+W(r.weight_lb)+'<small>LB</small></div></div>'; }).join('')+'</div>'+
    (rows&&rows.length>MAX?'<p class="muted" style="font-size:13px;text-align:center;margin:16px 0 0">Showing the top '+MAX+' of '+rows.length+' lifters.</p>':'')+
    (rows&&rows.length>1?'<p class="muted" style="font-size:13px;text-align:center;margin:16px 0 0">Ranks count verified single-rep lifts only.</p>':'')+
    '</div>';
}

/* ---------- Submit ---------- */
function vSubmit(){
  const s=S.submit; const g=GYM[s.gymId];
  if(!g) return '<div class="pad"><div class="topbar" style="padding:0"><button class="icon-btn" data-nav="discover" aria-label="Close">'+I.close+'</button></div><div class="empty"><b>Pick a gym first</b>Open a gym\'s title board on the map and tap Claim or Challenge.</div><button class="btn btn-accent btn-block" data-nav="discover">Go to the map</button></div>';
  const holder = s.lift ? titleHolder(g.id,s.lift) : null;
  const steps='<div class="steps">'+[1,2,3,4].map(i=>'<i class="'+(i<=s.step?'on':'')+'"></i>').join('')+'</div>';
  const top=(title,sub,back)=>'<div class="topbar">'+(back?'<button class="icon-btn" data-sstep="'+back+'" aria-label="Back">'+I.back+'</button>':'<button class="icon-btn" data-gym="'+g.id+'" aria-label="Close">'+I.close+'</button>')+'<div class="grow"><div class="eyebrow">Submit a lift · Step '+s.step+' of 4</div></div></div>'+steps+'<div class="pad" style="padding-bottom:8px"><h1 class="h-xl">'+title+'</h1><p class="sub" style="margin:6px 0 0">'+sub+'</p></div>';
  if(s.step===1){
    return top('Choose your lift','Titles are decided by your heaviest verified single at this gym.')+
      '<div class="pad lift-opts" style="padding-top:8px">'+LIFT_ORDER.map(l=>{ const h=titleHolder(g.id,l); return '<button class="lift-opt'+(s.lift===l?' on':'')+'" data-slift="'+l+'"><span class="ic">'+I[l]+'</span><span style="min-width:0"><b>'+LIFTS[l].name+'</b><small>'+I.crown+(h?LIFTS[l].title+': '+esc(person(h.user_id).name)+' · '+W(h.weight_lb)+' lb':LIFTS[l].title+' is vacant')+'</small></span><span class="chk">'+I.check+'</span></button>'; }).join('')+'</div>'+
      '<div class="footer-btns"><button class="btn btn-accent" data-sstep="2" '+(s.lift?'':'disabled')+'>Continue</button></div>';
  }
  if(s.step===2){
    const w=parseFloat(s.weight)||0;
    return top('Enter your result','Weight on the bar. Your gym is set from the title board.')+
      '<div class="pad" style="display:flex;flex-direction:column;gap:16px;padding-top:8px">'+
        '<div class="field"><label for="w">Weight</label><div class="weight-in"><input id="w" type="number" inputmode="decimal" min="0" max="1999" step="0.5" placeholder="0" value="'+esc(s.weight)+'" data-bind="weight" autofocus><span>LB</span></div></div>'+
        '<div class="two"><div class="field"><label>Reps</label><div class="stepper"><button data-reps="-1" aria-label="Fewer reps">−</button><output id="reps">'+s.reps+'</output><button data-reps="1" aria-label="More reps">+</button></div></div>'+
        '<div class="field"><label for="bw">Bodyweight <span>optional</span></label><div class="plain-in"><input id="bw" type="number" inputmode="decimal" placeholder="lb" value="'+esc(s.bw)+'" data-bind="bw"><span>LB</span></div></div></div>'+
        '<div class="field"><label>Gym</label><div class="gym-lock"><span class="ic">'+pinIcon()+'</span><div style="min-width:0"><b>'+esc(gymLabel(g))+'</b><small>'+(g.id===HOME()?'Your home gym · set from the title board':'Set from the title board')+'</small></div></div></div>'+
        (holder?'<div class="target"><div style="flex:1;min-width:0"><b>'+LIFTS[s.lift].title+' to beat</b><small>'+esc(person(holder.user_id).name)+' · set '+fmtDate(holder.recorded_at)+'</small></div><div class="w">'+W(holder.weight_lb)+'<small>LB</small></div></div>':'<div class="target"><div style="flex:1"><b>'+LIFTS[s.lift].title+' is vacant</b><small>Any approved single takes the crown.</small></div></div>')+
        (s.reps>1?'<div class="info-box">'+I.info+'<span>Titles count single-rep lifts. A '+s.reps+'-rep set is logged and verified but cannot take the '+LIFTS[s.lift].title+' crown.</span></div>':'')+
      '</div>'+
      '<div class="footer-btns"><button class="btn btn-ghost" data-sstep="1">'+I.back+'</button><button class="btn btn-accent" data-sstep="3" '+(w>0?'':'disabled')+'>Continue</button></div>';
  }
  if(s.step===3){
    const fileInput='<input id="vfile" type="file" accept="video/mp4,video/quicktime,video/*" capture="environment" style="position:absolute;opacity:0;width:1px;height:1px;pointer-events:none">';
    let up='';
    if(s.uploading) up='<div class="upload" style="border-style:solid"><b>Uploading…</b><div class="progress"><i style="width:'+s.pct+'%"></i></div><small>'+s.pct+'% · '+esc(s.file?s.file.name:'')+'</small></div>';
    else if(!s.file) up='<label class="upload" for="vfile" style="cursor:pointer"><span class="ic">'+I.camera+'</span><b>Record or choose lift video</b><small>MP4 or MOV, up to 150 MB. Show the plates and the full lift.</small>'+fileInput+'</label>';
    else up='<div class="card preview" style="padding:12px"><video id="vprev" src="'+esc(s.fileUrl)+'" muted playsinline preload="metadata" style="width:100%;border-radius:12px;background:#000;aspect-ratio:9/13;object-fit:cover"></video><div class="info"><b>'+esc(s.file.name)+'</b><small id="vmeta">'+(s.fileSecs?dur(s.fileSecs)+' · ':'')+(s.file.size/1048576).toFixed(0)+' MB</small><div class="checks"><span>'+I.check+'Video attached</span><span class="muted" style="font-size:12px">Location is captured when you submit</span></div><label class="btn btn-ghost btn-sm" for="vfile" style="align-self:flex-start;margin-top:4px;cursor:pointer">Replace video'+fileInput+'</label></div></div>';
    return top('Upload proof','Approved lifts earn a verified badge and can take a gym title.')+
      '<div class="pad" style="display:flex;flex-direction:column;gap:14px;padding-top:8px">'+up+
        (s.error?errBox(s.error):'')+
        '<div class="info-box">'+I.info+'<span>Two independent reviewers check every video. Depth, lockout and plate math decide approval.</span></div>'+
        '<div class="card" style="padding:14px;display:flex;gap:12px;align-items:center">'+av(MEP?person(MEP.id):null,'m')+'<div style="min-width:0;flex:1"><div class="eyebrow">Submitting</div><div style="font-weight:600">'+LIFTS[s.lift].name+' · <span class="num" style="font-size:22px;font-weight:800">'+esc(s.weight)+'</span> lb × '+s.reps+'</div><div class="muted" style="font-size:13px">'+esc(gymLabel(g))+(s.bw?' · '+esc(s.bw)+' lb bodyweight':'')+'</div></div></div>'+
      '</div>'+
      '<div class="footer-btns"><button class="btn btn-ghost" data-sstep="2" '+(s.uploading?'disabled':'')+'>'+I.back+'</button><button class="btn btn-accent" data-submit="1" '+(s.file&&!s.uploading?'':'disabled')+'>'+(s.uploading?'Uploading…':'Submit for review')+'</button></div>';
  }
  // step 4: submitted
  const p=s.result; const h=titleHolder(p.gym_id,p.lift); const rw=+p.weight_lb; const rc=h?+h.weight_lb:0; const diff=rc-rw;
  let msg, pct, gold=false;
  if(!h){ msg='<em>Vacant title.</em> If approved, you become the first '+LIFTS[p.lift].title+' at '+esc(gymLabel(g))+'.'; pct=100; gold=true; }
  else if(p.reps>1){ msg='Logged as a '+p.reps+'-rep set. It will be verified but cannot take the '+LIFTS[p.lift].title+' title.'; pct=Math.min(100,Math.round(rw/rc*100)); }
  else if(diff>0){ msg='You are <em>'+W(diff)+' lb</em> away from the '+LIFTS[p.lift].title+' title.'; pct=Math.round(rw/rc*100); }
  else if(diff===0){ msg='You matched the '+LIFTS[p.lift].title+'. Ties go to the earlier lift, so you need more weight.'; pct=100; }
  else { msg='If approved, you take the <em class="gold">'+LIFTS[p.lift].title+'</em> title by '+W(Math.abs(diff))+' lb.'; pct=100; gold=true; }
  return '<div class="done-hero"><div class="mark">'+I.clock+'</div><div><div class="eyebrow">Submitted</div><h2>Under review</h2></div>'+reviewChip('Waiting for 2 reviewers')+'</div>'+
    '<div class="pad" style="display:flex;flex-direction:column;gap:14px;padding-top:4px">'+
      '<div class="card gap-card"><div class="big">'+msg+'</div>'+
        '<div class="cmp"><div><span class="lbl">Your lift</span><span class="v">'+W(rw)+'<small>LB</small></span></div><div><span class="lbl">'+(h?LIFTS[p.lift].title+' · '+esc(person(h.user_id).name):'Current record')+'</span><span class="v">'+(h?W(rc):'—')+(h?'<small>LB</small>':'')+'</span></div></div>'+
        '<div class="track"><i class="'+(gold?'gold':'')+'" data-w="'+pct+'"></i>'+(h&&diff>0?'<b></b>':'')+'</div>'+
      '</div>'+
      '<div class="info-box">'+I.info+'<span>Your lift shows as pending on your profile and on this gym\'s board. Two reviewers must agree before it counts.</span></div>'+
    '</div>'+
    '<div class="footer-btns"><button class="btn btn-ghost" data-nav="profile">My profile</button><button class="btn btn-accent" data-gym="'+p.gym_id+'">Back to title board</button></div>';
}
function resetSubmit(gymId, lift){ if(S.submit.fileUrl) URL.revokeObjectURL(S.submit.fileUrl); S.submit={step:lift?2:1, lift:lift||null, weight:'', reps:1, bw:MEP&&MEP.bodyweight_lb?W(MEP.bodyweight_lb):'', gymId:gymId?+gymId:(HOME()||null), file:null, fileUrl:null, fileSecs:null, pct:0, uploading:false, error:null, result:null, geo:null}; }
function pickFile(file){
  const s=S.submit; if(!file) return;
  if(file.size>150*1048576){ s.error='That video is over 150 MB. Trim it to the lift and try again.'; render(false); return; }
  if(s.fileUrl) URL.revokeObjectURL(s.fileUrl);
  s.file=file; s.fileUrl=URL.createObjectURL(file); s.error=null; s.fileSecs=null; render(false);
  const v=document.getElementById('vprev'); if(v){ v.onloadedmetadata=()=>{ if(isFinite(v.duration)){ s.fileSecs=Math.round(v.duration); const sm=document.getElementById('vmeta'); if(sm) sm.textContent=dur(s.fileSecs)+' · '+(file.size/1048576).toFixed(0)+' MB'; } }; }
}
function getGeo(){ return new Promise(res=>{ if(!navigator.geolocation) return res(null); const t=setTimeout(()=>res(null),6000); navigator.geolocation.getCurrentPosition(p=>{ clearTimeout(t); res({lat:p.coords.latitude,lon:p.coords.longitude}); }, ()=>{ clearTimeout(t); res(null); }, {enableHighAccuracy:true, timeout:5500, maximumAge:30000}); }); }
async function submitLift(){
  const s=S.submit; if(!s.file||s.uploading) return; if(!requireAuth({screen:'submit'})) return;
  s.uploading=true; s.pct=0; s.error=null; render(false);
  try{
    const geo=await getGeo(); s.geo=geo;
    const isMov=/quicktime/i.test(s.file.type)||/\.mov$/i.test(s.file.name);
    const path=myId()+'/'+Date.now()+'_'+s.lift+'_'+String(s.weight).replace(/[^0-9.]/g,'')+(isMov?'.mov':'.mp4');
    await new Promise((resolve,reject)=>{
      const xhr=new XMLHttpRequest(); xhr.open('POST', API.url+'/storage/v1/object/videos/'+path);
      xhr.setRequestHeader('apikey',API.key); xhr.setRequestHeader('Authorization','Bearer '+SESSION.access_token); xhr.setRequestHeader('Content-Type',isMov?'video/quicktime':'video/mp4');
      xhr.upload.onprogress=e=>{ if(e.lengthComputable){ s.pct=Math.round(e.loaded/e.total*100); const bar=document.querySelector('.progress i'); const lbl=document.querySelector('.upload small'); if(bar) bar.style.width=s.pct+'%'; if(lbl) lbl.textContent=s.pct+'% · '+s.file.name; } };
      xhr.onload=()=>{ if(xhr.status>=200&&xhr.status<300) resolve(); else { let m='Upload failed ('+xhr.status+')'; try{ m=JSON.parse(xhr.responseText).message||m; }catch(_){} reject(new Error(m)); } };
      xhr.onerror=()=>reject(new Error('Upload failed. Check your connection and try again.'));
      xhr.send(s.file);
    });
    const row={user_id:myId(), gym_id:+s.gymId, lift:s.lift, weight_lb:parseFloat(s.weight), reps:s.reps, bodyweight_lb:s.bw?parseFloat(s.bw):null, video_path:path, video_seconds:s.fileSecs||null, device_lat:geo?geo.lat:null, device_lon:geo?geo.lon:null};
    const out=await api('lifts?select=*',{method:'POST', body:row});
    s.result=out[0]; s.uploading=false; s.step=4;
    if(s.fileUrl){ URL.revokeObjectURL(s.fileUrl); s.fileUrl=null; }
    await Promise.all([loadBoard(+s.gymId,true), loadMine(true)]);
    render(true);
  } catch(e){ s.uploading=false; s.error=e.message||'Something went wrong. Try again.'; render(false); }
}

/* ---------- Auth screen ---------- */
function vAuth(){
  const a=S.auth; const mode=a.mode;
  const back='<div class="topbar" style="padding:0;min-height:0"><button class="icon-btn" data-nav="discover" aria-label="Back">'+I.back+'</button><div class="grow"></div></div>';
  if(a.done==='check-email') return '<div class="pad" style="display:flex;flex-direction:column;gap:14px;padding-top:28px">'+back+'<div class="done-hero"><div class="mark" style="border-color:var(--accent);background:rgba(201,242,58,.12)">'+I.check.replace('<svg','<svg style="stroke:var(--accent)"')+'</div><div><div class="eyebrow">Almost there</div><h2>Check your email</h2></div><p class="sub">We sent a confirmation link to <b>'+esc(a.done_email||'')+'</b>. Tap it, then come back and sign in.</p></div><button class="btn btn-accent btn-block" data-authmode="in">Sign in</button></div>';
  return '<div class="pad" style="display:flex;flex-direction:column;gap:14px;padding-top:28px">'+back+
    '<div><div style="font-family:var(--font-display);font-weight:800;font-size:22px;letter-spacing:.04em;text-transform:uppercase;display:flex;align-items:center;gap:8px">'+I.crown.replace('<svg','<svg style="width:22px;height:22px;fill:var(--gold)"')+'Apex Lifts</div><h1 class="h-xl" style="margin-top:10px">'+(mode==='in'?'Welcome back':'Claim your gym')+'</h1><p class="sub" style="margin:6px 0 0">'+(mode==='in'?'Sign in to submit lifts and hold titles.':'One account. Every gym in the country.')+'</p></div>'+
    (PLUGIN('SignInWithApple')?'<button class="btn btn-block" data-apple="1" style="background:#fff;color:#000;gap:10px" '+(a.busy?'disabled':'')+'><svg viewBox="0 0 24 24" style="width:20px;height:20px;fill:#000;stroke:none" aria-hidden="true"><path d="M16.4 12.6c0-2.4 2-3.6 2.1-3.7-1.1-1.7-2.9-1.9-3.5-1.9-1.5-.2-2.9.9-3.7.9-.8 0-1.9-.9-3.2-.8-1.6 0-3.1 1-4 2.4-1.7 3-.4 7.3 1.2 9.7.8 1.2 1.8 2.5 3 2.4 1.2 0 1.7-.8 3.2-.8s1.9.8 3.2.8c1.3 0 2.2-1.2 3-2.4.9-1.3 1.3-2.6 1.3-2.7 0 0-2.6-1-2.6-3.9zM14 5.4c.7-.8 1.1-1.9 1-3-1 0-2.1.7-2.8 1.5-.6.7-1.2 1.8-1 2.9 1.1.1 2.2-.6 2.8-1.4z"/></svg>Continue with Apple</button><div class="muted" style="text-align:center;font-size:12px;letter-spacing:.1em;text-transform:uppercase">or use email</div>':'')+
    '<div class="seg"><button class="'+(mode==='in'?'on':'')+'" data-authmode="in">Sign in</button><button class="'+(mode==='up'?'on':'')+'" data-authmode="up">Create account</button></div>'+
    '<form id="authform" style="display:flex;flex-direction:column;gap:12px" autocomplete="on">'+
      (mode==='up'?'<div class="field"><label for="aname">Display name</label><div class="plain-in"><input id="aname" name="name" type="text" autocomplete="nickname" placeholder="Darius M." maxlength="40" required style="font-size:18px;font-weight:600;font-family:var(--font-body)"></div></div>':'')+
      '<div class="field"><label for="aemail">Email</label><div class="plain-in"><input id="aemail" name="email" type="email" autocomplete="email" inputmode="email" placeholder="you@email.com" required style="font-size:18px;font-weight:600;font-family:var(--font-body)"></div></div>'+
      '<div class="field"><label for="apass">Password'+(mode==='up'?' <span>8+ characters</span>':'')+'</label><div class="plain-in"><input id="apass" name="password" type="password" autocomplete="'+(mode==='up'?'new-password':'current-password')+'" minlength="8" required style="font-size:18px;font-weight:600;font-family:var(--font-body)"></div></div>'+
      (a.error?errBox(a.error):'')+
      '<button class="btn btn-accent btn-block" type="submit" '+(a.busy?'disabled':'')+'>'+(a.busy?'One moment…':(mode==='in'?'Sign in':'Create account'))+'</button>'+
    '</form>'+
    (API.live===false?'<div class="info-box">'+I.info+'<span>This preview can\'t reach the server. Accounts work in the installed app.</span></div>':'')+
    '<p class="muted" style="font-size:12px;text-align:center;line-height:1.5">By continuing you agree to the <a href="https://claude.ai/artifact/QWPiTMDtxtEhbMUrUc5m6b#terms" target="_blank" rel="noopener" style="color:inherit;text-decoration:underline">Terms of Service</a> and <a href="https://claude.ai/artifact/QWPiTMDtxtEhbMUrUc5m6b#privacy" target="_blank" rel="noopener" style="color:inherit;text-decoration:underline">Privacy Policy</a>. Lift videos you submit are checked by verifiers and, once approved, shown on the gym\'s board.</p>'+
  '</div>';
}
async function handleAuth(form){
  const a=S.auth; if(a.busy) return; a.error=null; a.busy=true; render(false);
  const email=form.email.value.trim(), pass=form.password.value;
  try{
    if(!sb) throw new Error('Could not load the sign-in library.');
    if(a.mode==='in'){ await signIn(email, pass); await loadProfile(); a.busy=false; const n=S.authNext; S.authNext=null; toast('Signed in'); if(n&&n.screen==='submit'){ resetSubmit(S.submit.gymId, S.submit.lift); go('submit'); } else if(n&&n.screen) go(n.screen, n.extra||{}); else go('profile'); }
    else { const name=(form.name&&form.name.value.trim())||email.split('@')[0]; const d=await signUp(email, pass, name); a.busy=false; if(d.session){ await loadProfile(); toast('Account created'); go('profile'); } else { a.done='check-email'; a.done_email=email; render(true); } }
  } catch(e){ a.busy=false; a.error=(e.message||'Could not sign in').replace('Invalid login credentials','Wrong email or password.'); render(false); }
}

/* ---------- Profile ---------- */
function vProfile(){
  if(!SESSION) return '<div class="pad" style="padding-top:40px;display:flex;flex-direction:column;gap:14px"><div class="prof-head" style="padding:0"><div class="av av-xl" style="--h:200" aria-hidden="true">'+I.user.replace('<svg','<svg style="width:40px;height:40px;stroke:#fff;fill:none;stroke-width:2"')+'</div><div><h1>Your title page</h1><p class="sub" style="margin-top:6px">Sign in to submit lifts, hold titles and track your bests.</p></div></div><button class="btn btn-accent btn-block" data-nav="auth" data-authmode="in">Sign in</button><button class="btn btn-ghost btn-block" data-nav="auth" data-authmode="up">Create account</button></div>';
  if(!MEP){ loadProfile().then(()=>{ if(S.screen==='profile') render(false); }); return '<div class="loading-row" style="padding:40px 16px"><i></i>Loading your profile…</div>'; }
  const u=person(MEP.id, MEP); const home=HOME(); const g=home?GYM[home]:null; const held=MY.titles; const approved=MY.lifts.filter(l=>l.status==='approved'); const pending=myPending(); const rejected=MY.lifts.filter(l=>l.status==='rejected');
  const isVer=MEP.role==='verifier'||MEP.role==='admin';
  const progs=LIFT_ORDER.map(l=>{ const h=home?titleHolder(home,l):null; const mine=myBest(l); const mw=mine?+mine.weight_lb:0; const rc=h?+h.weight_lb:0; const isMe=h&&h.user_id===MEP.id; const pend=pending.find(p=>p.lift===l&&(!home||+p.gym_id===home));
    let txt, pct;
    if(!home){ txt=mw?'Best '+W(mw)+' lb':'No verified single yet'; pct=mw?100:0; }
    else if(isMe){ txt='Held · '+W(mw)+' lb'; pct=100; }
    else if(!h){ txt=pend?W(pend.weight_lb)+' lb under review · title vacant':'Vacant · claim it'; pct=pend?100:0; }
    else { txt=(pend?W(pend.weight_lb)+' lb under review · ':'')+(mw?W(mw)+' / '+W(rc)+' lb · '+W(rc-mw)+' lb away':W(rc)+' lb to beat'); pct=mw?Math.min(100,Math.round(mw/rc*100)):0; }
    return '<div class="prog'+(isMe?' held':'')+'"><div class="l"><b>'+LIFTS[l].title+'</b><span>'+txt+'</span></div><div class="track"><i class="'+(isMe?'gold':'')+'" data-w="'+pct+'"></i></div></div>'; }).join('');
  const row=(p,chip)=>'<div class="row">'+thumb(p,{cls:'thumb-s'})+'<div class="grow"><div class="name"><span class="t">'+LIFTS[p.lift].name+' × '+p.reps+'</span></div><div class="meta">'+esc(p.status==='rejected'?(p.reject_reason||'Reviewers could not verify this lift'):gymLabel(GYM[p.gym_id]||p.gyms)+' · '+ago(p.recorded_at))+'</div><div style="margin-top:4px">'+chip+'</div></div><div class="w">'+W(p.weight_lb)+'<small>LB</small></div></div>';
  return '<div class="topbar"><div class="grow"><div class="eyebrow">Athlete</div></div><button class="icon-btn" data-settings="1" aria-label="Settings">'+I.gear+'</button></div>'+
    '<div class="prof-head">'+av(u,'xl',held.length>0)+'<div><h1>'+esc(u.name)+'</h1>'+(g?'<button class="gym-link" data-gym="'+g.id+'">'+pinIcon()+esc(gymLabel(g))+' · home gym</button>':'<button class="gym-link" data-nav="discover">'+pinIcon()+'Choose a home gym on the map</button>')+'</div>'+
      '<div class="badges">'+held.map(t=>'<span class="badge gold">'+I.crown+LIFTS[t.lift].title+(home&&+t.gym_id!==home&&GYM[t.gym_id]?' · '+esc(GYM[t.gym_id].city||''):'')+'</span>').join('')+(approved.length?'<span class="badge lime">'+I.check+'Verified lifter</span>':'<span class="badge">New lifter</span>')+(isVer?'<span class="badge lime">'+I.shield+'Verifier</span>':'')+(MEP.bodyweight_lb||MEP.birth_year?'<span class="badge">'+(MEP.bodyweight_lb?W(MEP.bodyweight_lb)+' lb':'')+(MEP.bodyweight_lb&&MEP.birth_year?' · ':'')+(MEP.birth_year?ageOf(MEP.birth_year)+' yrs':'')+'</span>':'')+'</div></div>'+
    (S.settings.open?vSettings():'')+
    (MY.notes.some(n=>!n.read_at)?'<section class="card status-card" style="margin-bottom:12px;gap:8px"><div class="head"><b>Updates</b><button class="chip chip-neutral" data-readall="1">Mark read</button></div>'+MY.notes.filter(n=>!n.read_at).slice(0,5).map(n=>'<div style="display:flex;gap:10px;align-items:flex-start"><span style="width:8px;height:8px;border-radius:50%;background:'+(n.kind==='approved'?'var(--accent)':n.kind==='dethroned'?'var(--gold)':'#F27A6A')+';margin-top:7px;flex:none"></span><div style="min-width:0"><div style="font-weight:600">'+esc(n.title)+'</div><div class="sub">'+esc(n.body)+'</div><div class="muted" style="font-size:12px;margin-top:2px">'+ago(n.created_at)+'</div></div></div>').join('')+'</section>':'')+
    (isVer?'<section class="card status-card" style="margin-bottom:12px;gap:8px"><div class="head"><b>Verifier queue</b><span class="chip chip-neutral">'+(S.review.queue?S.review.queue.length+' waiting':'…')+'</span></div><p class="sub" style="margin:0">Review lifts from other lifters. Two matching verdicts decide a lift. You earn credit for every verdict that matches the final call.</p><button class="btn btn-accent btn-block" data-nav="review">Open the queue</button></section>':'')+
    '<section class="card status-card"><div class="head"><b><em>'+held.length+'</em> title'+(held.length===1?'':'s')+' held</b><span class="chip chip-neutral">'+approved.length+' verified lift'+(approved.length===1?'':'s')+'</span></div>'+progs+'</section>'+
    '<div class="bests">'+LIFT_ORDER.map(l=>{ const b=myBest(l); const k=held.some(t=>t.lift===l); return '<div class="best'+(k?' king':'')+'"><span class="l">'+(k?I.crown:'')+LIFTS[l].short+'</span><span class="w">'+(b?W(b.weight_lb)+'<small>LB</small>':'<span class="muted">—</span>')+'</span><small class="d">'+(b?fmtDate(b.recorded_at):'No verified single')+'</small></div>'; }).join('')+'</div>'+
    (pending.length?'<section class="section"><div class="section-h"><h3 class="h-m">Pending review</h3><span class="chip chip-review">'+pending.length+' lift'+(pending.length>1?'s':'')+'</span></div><div class="list">'+pending.map(p=>row(p,reviewChip())).join('')+'</div></section>':'')+
    (rejected.length?'<section class="section"><div class="section-h"><h3 class="h-m">Not approved</h3><span class="muted" style="font-size:13px">'+rejected.length+'</span></div><div class="list">'+rejected.slice(0,5).map(p=>row(p,rejectedChip())).join('')+'</div></section>':'')+
    '<section class="section"><div class="section-h"><h3 class="h-m">Lift videos</h3><span class="muted" style="font-size:13px">'+(approved.length?'All verified':'')+'</span></div>'+(approved.length?'<div class="vgrid">'+approved.slice(0,12).map(r=>thumb(r,{cap:true,tag:held.some(t=>t.lift===r.lift&&+t.gym_id===+r.gym_id&&+t.weight_lb===+r.weight_lb)?'<span class="chip chip-gold">'+I.crown+'Title</span>':verifiedChip('')})).join('')+'</div>':'<div class="empty" style="padding:24px 0"><b>No verified lifts yet</b>Submit a lift with video. Once two reviewers approve it, it shows here and can take a title.</div><div style="padding:0 0 8px"><button class="btn btn-accent btn-block" data-nav="submit">Submit your first lift</button></div>')+'</section>'+
    '<div style="height:28px"></div>';
}
function vSettings(){
  const st=S.settings;
  return '<section class="card status-card" style="margin-bottom:12px;gap:10px"><div class="head"><b>Account</b><button class="chip chip-neutral" data-settings="0">Close</button></div>'+
    '<form id="profform" style="display:flex;flex-direction:column;gap:10px">'+
      '<div class="field"><label for="pname">Display name</label><div class="plain-in"><input id="pname" name="name" type="text" maxlength="40" value="'+esc(MEP.display_name)+'" style="font-size:16px;font-weight:600;font-family:var(--font-body)"></div></div>'+
      '<div class="two"><div class="field"><label for="pbw">Bodyweight</label><div class="plain-in"><input id="pbw" name="bw" type="number" inputmode="decimal" value="'+(MEP.bodyweight_lb?W(MEP.bodyweight_lb):'')+'" placeholder="lb"><span>LB</span></div></div>'+
      '<div class="field"><label for="pby">Birth year</label><div class="plain-in"><input id="pby" name="by" type="number" inputmode="numeric" min="1900" max="2100" value="'+(MEP.birth_year||'')+'" placeholder="1997"></div></div></div>'+
      (st.error?errBox(st.error):'')+
      '<button class="btn btn-accent btn-block" type="submit" '+(st.busy?'disabled':'')+'>Save</button>'+
    '</form>'+
    '<div style="display:flex;gap:8px"><button class="btn btn-ghost" style="flex:1" data-signout="1">Sign out</button>'+(st.confirmDelete?'<button class="btn btn-ghost" style="flex:1;border-color:#F27A6A;color:#F27A6A" data-deleteaccount="1" '+(st.busy?'disabled':'')+'>Yes, delete everything</button>':'<button class="btn btn-ghost" style="flex:1" data-confirmdelete="1">Delete account</button>')+'</div>'+
    (st.confirmDelete?'<p class="muted" style="font-size:13px;margin:0">This removes your account, lifts, titles and videos for good.</p>':'')+
  '</section>';
}
async function saveProfile(form){
  const st=S.settings; st.busy=true; st.error=null; render(false);
  try{
    const body={display_name:form.name.value.trim()||MEP.display_name, bodyweight_lb:form.bw.value?parseFloat(form.bw.value):null, birth_year:form.by.value?parseInt(form.by.value,10):null, updated_at:new Date().toISOString()};
    const out=await api('profiles?id=eq.'+MEP.id+'&select=*',{method:'PATCH', body}); MEP=out[0]||MEP; person(MEP.id,MEP);
    st.busy=false; st.open=false; toast('Saved'); render(false);
  } catch(e){ st.busy=false; st.error=e.message; render(false); }
}
async function setHomeGym(gid){
  if(!requireAuth({screen:'gym',extra:{gymId:+gid}})) return;
  try{ const out=await api('profiles?id=eq.'+MEP.id+'&select=*',{method:'PATCH', body:{home_gym_id:+gid, updated_at:new Date().toISOString()}}); MEP=out[0]||MEP; S.lb.key=null; toast('Home gym set'); render(false); } catch(e){ toast('Could not save: '+e.message); }
}
async function deleteAccount(){
  const st=S.settings; st.busy=true; render(false);
  try{
    const r=await fetch(API.url+'/functions/v1/delete-account',{method:'POST',headers:{apikey:API.key,Authorization:'Bearer '+SESSION.access_token}});
    const j=await r.json(); if(!r.ok||!j.deleted) throw new Error(j.error||'Could not delete account');
    await signOut(); st.busy=false; st.open=false; st.confirmDelete=false; toast('Account deleted'); go('discover');
  } catch(e){ st.busy=false; st.error=e.message; render(false); }
}

/* ---------- Verifier review queue ---------- */
async function loadQueue(force){
  if(!SESSION||!MEP||(MEP.role!=='verifier'&&MEP.role!=='admin')) return; if(S.review.queue && !force) return;
  try{ const rows=await rpc('review_queue',{lim:20}); S.review.queue=rows||[]; await Promise.all(S.review.queue.map(r=>GYM[r.gym_id]&&GYM[r.gym_id].name?null:gymById(r.gym_id))); const uids=[...new Set(S.review.queue.map(r=>r.user_id))]; if(uids.length){ const ps=await api('profiles?id=in.('+uids.join(',')+')&select=id,display_name,avatar_hue,bodyweight_lb,birth_year'); ps.forEach(p=>person(p.id,p)); } }
  catch(e){ S.review.queue=[]; }
  if(S.screen==='review'||S.screen==='profile') render(false);
}
async function signedUrl(path){ try{ const {data,error}=await sb.storage.from('videos').createSignedUrl(path, 3600); if(error) throw error; return data.signedUrl; } catch(e){ return null; } }
function vReview(){
  if(!SESSION) return '<div class="pad"><div class="empty"><b>Sign in</b>Verifier tools need an account.</div><button class="btn btn-accent btn-block" data-nav="auth">Sign in</button></div>';
  const r=S.review; if(!r.queue) loadQueue();
  const top='<div class="topbar"><button class="icon-btn" data-nav="profile" aria-label="Back">'+I.back+'</button><div class="grow"><div class="eyebrow">Verifier</div></div></div>';
  if(r.item){
    const it=r.item; const g=GYM[it.gym_id]; const p=person(it.user_id); const dm=it.distance_from_gym_m;
    return top+'<div class="pad" style="display:flex;flex-direction:column;gap:14px;padding-top:4px">'+
      '<div><h1 class="h-xl">'+LIFTS[it.lift].name+' · '+W(it.weight_lb)+' lb</h1><p class="sub" style="margin:6px 0 0">'+esc(p.name)+(it.bodyweight_lb?' · '+W(it.bodyweight_lb)+' lb bodyweight':'')+' · '+it.reps+' rep'+(it.reps>1?'s':'')+' · '+esc(gymLabel(g))+'</p></div>'+
      (r.videoUrl?'<video src="'+esc(r.videoUrl)+'" controls playsinline style="width:100%;border-radius:16px;background:#000;max-height:52vh"></video>':'<div class="loading-row"><i></i>Loading video…</div>')+
      '<div class="card" style="padding:12px 14px;display:flex;flex-direction:column;gap:6px;font-size:14px">'+
        '<div style="display:flex;justify-content:space-between"><span class="muted">Recorded</span><b>'+fmtDate(it.recorded_at)+'</b></div>'+
        '<div style="display:flex;justify-content:space-between"><span class="muted">Phone distance from gym</span><b>'+(dm==null?'Unknown':dm<250?Math.round(dm)+' m · at the gym':dm<2000?Math.round(dm)+' m · nearby':(dm/1000).toFixed(1)+' km · not at the gym')+'</b></div>'+
        '<div style="display:flex;justify-content:space-between"><span class="muted">Video length</span><b>'+(it.video_seconds?dur(it.video_seconds):'—')+'</b></div>'+
      '</div>'+
      '<div class="info-box">'+I.info+'<span>Approve only if you can see the plates, the full range of motion, and the weight matches what was entered. When in doubt, reject with a reason so the lifter can resubmit.</span></div>'+
      '<div class="seg"><button class="'+(r.verdict==='approve'?'on':'')+'" data-verdict="approve" style="'+(r.verdict==='approve'?'color:var(--accent)':'')+'">Approve</button><button class="'+(r.verdict==='reject'?'on':'')+'" data-verdict="reject" style="'+(r.verdict==='reject'?'color:#F27A6A':'')+'">Reject</button></div>'+
      (r.verdict==='reject'?'<div class="field"><label for="rreason">Reason <span>shown to the lifter</span></label><div class="plain-in" style="height:auto;padding:10px 14px"><input id="rreason" type="text" maxlength="140" placeholder="Plates not visible / depth / no lockout" value="'+esc(r.reason)+'" data-rreason="1" style="font-size:15px;font-weight:500;font-family:var(--font-body)"></div></div>':'')+
      (r.error?errBox(r.error):'')+
      '<div class="footer-btns" style="padding:0"><button class="btn btn-ghost" data-reviewback="1">'+I.back+'</button><button class="btn btn-accent" data-sendreview="1" '+(r.verdict&&!r.busy&&(r.verdict!=='reject'||r.reason.trim())?'':'disabled')+'>'+(r.busy?'Sending…':'Submit verdict')+'</button></div>'+
    '</div>';
  }
  const q=r.queue;
  return top+'<div class="pad" style="padding-top:4px"><h1 class="h-xl">Review queue</h1><p class="sub" style="margin:6px 0 14px">'+(q?q.length+' lift'+(q.length===1?'':'s')+' waiting. Oldest first.':'Loading…')+'</p>'+
    (q?(q.length?'<div class="list">'+q.map(it=>{ const p=person(it.user_id); const g=GYM[it.gym_id]; return '<button class="row" style="width:100%;text-align:left" data-reviewitem="'+it.id+'">'+av(p,'m')+'<div class="grow"><div class="name"><span class="t">'+esc(p.name)+'</span></div><div class="meta">'+LIFTS[it.lift].name+' × '+it.reps+' · '+esc(gymLabel(g))+' · '+ago(it.created_at)+'</div></div><div class="w">'+W(it.weight_lb)+'<small>LB</small></div></button>'; }).join('')+'</div>':'<div class="empty"><b>Queue is clear</b>Nothing is waiting for review right now.</div>'):'<div class="loading-row"><i></i>Loading…</div>')+
    '<div style="padding:12px 0"><button class="btn btn-ghost btn-block" data-refreshqueue="1">Refresh</button></div></div>';
}
async function openReviewItem(id){
  const it=(S.review.queue||[]).find(x=>x.id===+id); if(!it) return;
  S.review.item=it; S.review.verdict=null; S.review.reason=''; S.review.error=null; S.review.videoUrl=null; render(true);
  const url=await signedUrl(it.video_path); if(S.review.item&&S.review.item.id===it.id){ S.review.videoUrl=url; if(!url) S.review.error='Could not load the video.'; render(false); }
}
async function sendReview(){
  const r=S.review; if(!r.item||!r.verdict||r.busy) return; r.busy=true; r.error=null; render(false);
  try{
    await api('reviews',{method:'POST', body:{lift_id:r.item.id, reviewer_id:myId(), verdict:r.verdict, reason:r.verdict==='reject'?r.reason.trim():null}});
    const gid=r.item.gym_id; const v=r.verdict; r.item=null; r.busy=false; toast(v==='approve'?'Approved':'Rejected'); delete BOARD[gid]; r.queue=null; await loadQueue(true); render(true);
  } catch(e){ r.busy=false; r.error=e.message; render(false); }
}

/* ---------- Video modal ---------- */
function vVideo(){
  const x=VIDEOS[S.video]; if(!x) return '';
  const u=person(x.user_id); const verified=x.status==='approved'; const king=verified&&x.gym_id&&isKing(x.user_id,x.gym_id,x.lift)&&titleHolder(x.gym_id,x.lift).lift_id===x.lift_id;
  const rp=S.report;
  return '<div class="modal" id="modal"><div class="mtop"><div><div class="eyebrow">Lift video</div><div style="font-weight:600">'+esc(u.name)+' · '+LIFTS[x.lift].name+'</div></div><button class="icon-btn" data-closevideo="1" aria-label="Close">'+I.close+'</button></div>'+
    '<div class="player" id="player" style="--h:'+(u.h||200)+'">'+(S.videoUrl?'<video src="'+esc(S.videoUrl)+'" controls autoplay playsinline style="position:absolute;inset:0;width:100%;height:100%;object-fit:contain;background:#000;z-index:2"></video>':'<span class="bar"></span><div class="watermark">'+(verified?verifiedChip():x.status==='pending'?reviewChip():rejectedChip())+(king?'<span class="chip chip-gold">'+I.crown+LIFTS[x.lift].title+'</span>':'')+'</div><div class="pbtn" style="opacity:.92;width:auto;min-width:64px;padding:0 14px;border-radius:32px">'+(S.videoErr?'<span style="font-size:12px;font-family:var(--font-display);font-weight:700;letter-spacing:.04em;text-transform:uppercase">'+esc(S.videoErr)+'</span>':'<span class="loading-row" style="padding:0;color:#0f1012"><i style="border-color:#ccc;border-top-color:#0f1012"></i></span>')+'</div>')+'</div>'+
    '<div class="mdetail"><div class="head">'+av(u,'m',king)+'<div class="grow"><b>'+esc(u.name)+(x.user_id===myId()?' (You)':'')+'</b><small>'+(x.gym_id&&GYM[x.gym_id]?esc(gymLabel(GYM[x.gym_id]))+' · ':'')+fmtDate(x.recorded_at)+'</small></div><div class="big">'+W(x.weight_lb)+'<small>LB</small></div></div>'+
    '<div class="revs">'+(verified?'<span class="chip chip-neutral">Approved by 2 reviewers</span>':x.status==='pending'?'<span class="chip chip-neutral">Awaiting 2 reviewers</span>':'<span class="chip chip-neutral">Rejected by reviewers</span>')+'<span class="chip chip-neutral">'+x.reps+' rep'+(x.reps>1?'s':'')+'</span>'+
      (x.user_id!==myId()&&SESSION?(rp.done?'<span class="chip chip-verified">'+I.check+'Reported</span>':'<button class="chip chip-neutral" data-report="1">'+I.flag.replace('<svg','<svg style="width:12px;height:12px"')+'Report</button>'):'')+'</div>'+
    (rp.open&&!rp.done?'<div class="field" style="margin-top:8px"><label for="rreport">Why are you reporting this?</label><div class="plain-in" style="height:auto;padding:10px 14px"><input id="rreport" type="text" maxlength="140" placeholder="Fake plates, wrong gym, offensive…" value="'+esc(rp.reason)+'" data-reportreason="1" style="font-size:15px;font-weight:500;font-family:var(--font-body)"></div><div style="display:flex;gap:8px;margin-top:8px"><button class="btn btn-ghost btn-sm" data-report="0">Cancel</button><button class="btn btn-accent btn-sm" data-sendreport="1" '+(rp.reason.trim()?'':'disabled')+'>Send report</button></div></div>':'')+
    '</div></div>';
}
async function openVideo(id){
  const x=VIDEOS[id]; if(!x) return;
  S.video=id; S.videoUrl=null; S.videoErr=null; S.report={open:false,reason:'',done:false};
  repaintModal();
  if(!SESSION){ S.videoErr='Sign in to watch'; repaintModal(); return; }
  if(!x.video_path){ S.videoErr='Video unavailable'; repaintModal(); return; }
  const url=await signedUrl(x.video_path); if(S.video!==id) return;
  if(url) S.videoUrl=url; else S.videoErr='Could not load video'; repaintModal();
}
function repaintModal(){ const m=document.getElementById('modal'); if(m) m.remove(); if(S.video) document.getElementById('app').insertAdjacentHTML('beforeend', vVideo()); }
async function sendReport(){
  const x=VIDEOS[S.video]; if(!x) return;
  try{ await api('reports',{method:'POST', body:{reporter_id:myId(), lift_id:x.lift_id||null, reported_user_id:x.user_id, reason:S.report.reason.trim()}}); S.report.done=true; S.report.open=false; repaintModal(); toast('Report sent'); } catch(e){ toast('Could not send report'); }
}

/* ---------- Events ---------- */
function nearMe(){
  const done=(lat,lon,label)=>{ S.me=[lat,lon]; if(MEPIN) MEPIN.setLatLng(S.me); flyTo(lat,lon,13.5); toast(label); };
  if(navigator.geolocation && API.live){
    let settled=false; const fb=setTimeout(()=>{ if(!settled){ settled=true; done(DEFAULT_CENTER[0],DEFAULT_CENTER[1],'Location unavailable · centered on Lakewood, CA'); } },5000);
    navigator.geolocation.getCurrentPosition(p=>{ if(settled) return; settled=true; clearTimeout(fb); done(p.coords.latitude,p.coords.longitude,'Centered on your location'); }, ()=>{ if(settled) return; settled=true; clearTimeout(fb); done(DEFAULT_CENTER[0],DEFAULT_CENTER[1],'Location blocked · centered on Lakewood, CA'); }, {timeout:4500,maximumAge:60000});
  } else done(DEFAULT_CENTER[0],DEFAULT_CENTER[1],'Centered on Lakewood, CA');
}
document.addEventListener('click', e=>{
  const t=e.target.closest('[data-nav],[data-gym],[data-gymtab],[data-gymlb],[data-challenge],[data-lbscope],[data-lblift],[data-lbbw],[data-lbage],[data-lbopen],[data-slift],[data-sstep],[data-reps],[data-submit],[data-video],[data-closevideo],[data-share],[data-opencity],[data-closecity],[data-city],[data-authmode],[data-settings],[data-signout],[data-confirmdelete],[data-deleteaccount],[data-sethome],[data-reviewitem],[data-reviewback],[data-verdict],[data-sendreview],[data-refreshqueue],[data-report],[data-sendreport],[data-apple],[data-readall],#near');
  if(!t) return;
  const d=t.dataset;
  if(t.id==='near'){ nearMe(); return; }
  if(d.opencity!==undefined){ S.citySheet=true; const m=document.getElementById('modal'); if(m) m.remove(); document.getElementById('app').insertAdjacentHTML('beforeend', vCitySheet()); return; }
  if(d.closecity!==undefined){ S.citySheet=false; const m=document.getElementById('modal'); if(m) m.remove(); return; }
  if(d.city!==undefined){ const c=CITY[d.city];
    if(API.live===false && d.city!=='la'){ S.citySheet=false; const m=document.getElementById('modal'); if(m) m.remove(); toast('Offline preview covers the Lakewood area only'); return; }
    S.city=d.city; S.citySheet=false; S.search=''; S.searchHits=[];
    if(S.screen==='leaderboards'){ S.lb.key=null; render(false); }
    else { if(S.screen!=='discover') go('discover'); else { const m=document.getElementById('modal'); if(m) m.remove(); paintSearch(); const si=document.getElementById('search'); if(si) si.value=''; } flyTo(c.lat,c.lon,12); toast(c.name+' · '+c.gyms.toLocaleString()+' gyms'); }
    return; }
  if(d.closevideo!==undefined){ S.video=null; S.videoUrl=null; const m=document.getElementById('modal'); if(m) m.remove(); return; }
  if(d.video!==undefined){ openVideo(d.video); return; }
  if(d.report!==undefined){ S.report.open=d.report==='1'; repaintModal(); return; }
  if(d.sendreport!==undefined){ sendReport(); return; }
  if(d.share!==undefined){ const txt=location.href; if(navigator.clipboard&&navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(()=>toast('Link copied'),()=>toast('Copy the link from the address bar')); else toast('Copy the link from the address bar'); return; }
  if(d.apple!==undefined){ (async()=>{ const a=S.auth; if(a.busy) return; a.busy=true; a.error=null; render(false); try{ await signInWithApple(); await loadProfile(); a.busy=false; const n=S.authNext; S.authNext=null; toast('Signed in'); if(n&&n.screen==='submit'){ resetSubmit(S.submit.gymId, S.submit.lift); go('submit'); } else if(n&&n.screen) go(n.screen, n.extra||{}); else go('profile'); } catch(e){ a.busy=false; a.error=e.message||'Apple sign-in failed'; render(false); } })(); return; }
  if(d.authmode!==undefined && d.nav===undefined){ S.auth.mode=d.authmode; S.auth.error=null; S.auth.done=null; render(false); return; }
  if(d.nav!==undefined){
    if(d.nav==='submit'){ if(!requireAuth({screen:'submit'})) return; if(S.screen!=='submit'||S.submit.step===4) resetSubmit(S.screen==='gym'?S.gymId:(HOME()||null), null); go('submit'); return; }
    if(d.nav==='leaderboards'){ if(d.lbscope) S.lb.scope=d.lbscope; go('leaderboards'); return; }
    if(d.nav==='auth'){ S.auth.mode=d.authmode||'in'; S.auth.error=null; S.auth.done=null; go('auth'); return; }
    if(d.nav==='profile'){ if(SESSION) loadMine(); loadQueue(); go('profile'); return; }
    if(d.nav==='review'){ go('review'); return; }
    go(d.nav); return;
  }
  if(d.gym!==undefined && d.gymid===undefined){ openGym(d.gym); return; }
  if(d.gymtab!==undefined){ S.gymTab=d.gymtab; render(false); return; }
  if(d.gymlb!==undefined){ S.gymLbLift=d.gymlb; render(false); return; }
  if(d.sethome!==undefined){ setHomeGym(d.sethome); return; }
  if(d.challenge!==undefined){ if(!requireAuth({screen:'gym',extra:{gymId:+d.gymid}})) return; resetSubmit(d.gymid, d.challenge); go('submit'); return; }
  if(d.lbscope!==undefined){ S.lb.scope=d.lbscope; render(false); return; }
  if(d.lblift!==undefined){ S.lb.lift=d.lblift; render(false); return; }
  if(d.lbbw!==undefined){ S.lb.bwc=d.lbbw; render(false); return; }
  if(d.lbage!==undefined){ S.lb.age=d.lbage; render(false); return; }
  if(d.lbopen!==undefined){ S.lb.open=!S.lb.open; render(false); return; }
  if(d.slift!==undefined){ S.submit.lift=d.slift; render(false); return; }
  if(d.sstep!==undefined){ S.submit.step=parseInt(d.sstep,10); render(true); if(S.submit.step===2) setTimeout(()=>{const w=document.getElementById('w'); if(w&&!S.submit.weight) w.focus();},50); return; }
  if(d.reps!==undefined){ S.submit.reps=Math.max(1,Math.min(20,S.submit.reps+parseInt(d.reps,10))); render(false); return; }
  if(d.submit!==undefined){ submitLift(); return; }
  if(d.readall!==undefined){ (async()=>{ try{ await api('notifications?user_id=eq.'+myId()+'&read_at=is.null',{method:'PATCH', body:{read_at:new Date().toISOString()}}); MY.notes.forEach(n=>n.read_at=n.read_at||new Date().toISOString()); render(false); }catch(e){} })(); return; }
  if(d.settings!==undefined){ S.settings.open=d.settings==='1'; S.settings.confirmDelete=false; S.settings.error=null; render(false); return; }
  if(d.signout!==undefined){ signOut().then(()=>{ toast('Signed out'); go('discover'); }); return; }
  if(d.confirmdelete!==undefined){ S.settings.confirmDelete=true; render(false); return; }
  if(d.deleteaccount!==undefined){ deleteAccount(); return; }
  if(d.reviewitem!==undefined){ openReviewItem(d.reviewitem); return; }
  if(d.reviewback!==undefined){ S.review.item=null; S.review.videoUrl=null; render(true); return; }
  if(d.verdict!==undefined){ S.review.verdict=d.verdict; render(false); return; }
  if(d.sendreview!==undefined){ sendReview(); return; }
  if(d.refreshqueue!==undefined){ S.review.queue=null; render(false); loadQueue(true); return; }
});
document.addEventListener('submit', e=>{
  if(e.target.id==='authform'){ e.preventDefault(); handleAuth(e.target); }
  if(e.target.id==='profform'){ e.preventDefault(); saveProfile(e.target); }
});
document.addEventListener('change', e=>{ if(e.target.id==='vfile'){ pickFile(e.target.files[0]); } });
document.addEventListener('input', e=>{
  const t=e.target;
  if(t.id==='search'){ S.search=t.value; runSearch(); return; }
  if(t.dataset.rreason!==undefined){ S.review.reason=t.value; const b=document.querySelector('[data-sendreview]'); if(b){ if(t.value.trim()) b.removeAttribute('disabled'); else b.setAttribute('disabled',''); } return; }
  if(t.dataset.reportreason!==undefined){ S.report.reason=t.value; const b=document.querySelector('[data-sendreport]'); if(b){ if(t.value.trim()) b.removeAttribute('disabled'); else b.setAttribute('disabled',''); } return; }
  if(t.dataset.bind){ S.submit[t.dataset.bind]=t.value; const w=parseFloat(S.submit.weight)||0; const btn=document.querySelector('[data-sstep="3"]'); if(btn){ if(w>0) btn.removeAttribute('disabled'); else btn.setAttribute('disabled',''); } }
});
document.addEventListener('keydown', e=>{ if(e.key==='Escape' && (S.video||S.citySheet)){ S.video=null; S.citySheet=false; const m=document.getElementById('modal'); if(m) m.remove(); } });

/* ---------- Boot ---------- */
(async function boot(){
  render(true);
  await probe();
  await initAuth();
  if(S.screen==='discover') mountMap(); else render(false);
  render(false); if(S.screen==='discover') mountMap();
})();

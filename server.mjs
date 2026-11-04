import http from 'node:http';
import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {randomUUID,timingSafeEqual} from 'node:crypto';

const root=path.dirname(fileURLToPath(import.meta.url));
const dir=process.env.DATA_DIR || path.join(root,'data');
await mkdir(dir,{recursive:true});
let state;
try {state=JSON.parse(await readFile(path.join(dir,'state.json'),'utf8'));}
catch(e){if(e.code!=='ENOENT')throw e;state={customers:[],fields:[],drivers:[],tours:[],sessions:[]};}
const tokens=new Map();
const key=process.env.AGRITAB_KEY || 'agritab-local';
let queue=Promise.resolve();
const save=async()=>{await writeFile(path.join(dir,'state.tmp'),JSON.stringify(state));await rename(path.join(dir,'state.tmp'),path.join(dir,'state.json'));};
const required=(v,label)=>{if(typeof v!=='string'||!v.trim()||v.length>120)throw Error(label+' fehlt oder ist zu lang.');return v.trim();};
const statuses=['Arbeit','Warten','Pause'];
function change(body,driverId){
 const now=new Date().toISOString();
 const driver=state.drivers.find(x=>x.id===driverId);
 if(body.action==='profile'){driver.name=required(body.name,'Fahrername');if(!['tractor','harvester','truck'].includes(body.vehicle))throw Error('Fahrzeug ungültig');driver.vehicle=body.vehicle;}
 else if(body.action==='customer'){state.customers.push({id:randomUUID(),name:required(body.name,'Kundenname')});}
 else if(body.action==='field'){if(!state.customers.some(x=>x.id===body.customerId))throw Error('Kunde fehlt');state.fields.push({id:randomUUID(),name:required(body.name,'Koppelname'),customerId:body.customerId});}
 else if(body.action==='start'){
  if(state.sessions.some(x=>x.driverId===driverId&&!x.endedAt))throw Error('Bitte laufenden Einsatz zuerst stoppen.');
  if(!state.customers.some(x=>x.id===body.customerId))throw Error('Kunde fehlt');
  state.sessions.push({id:randomUUID(),driverId,customerId:body.customerId,startedAt:now,endedAt:null,events:[{status:'Arbeit',at:now}]});
 }else if(body.action==='status'||body.action==='stop'){
  const session=state.sessions.find(x=>x.driverId===driverId&&!x.endedAt);if(!session)throw Error('Kein laufender Einsatz');
  if(body.action==='stop')session.endedAt=now;
  else {if(!statuses.includes(body.status))throw Error('Status ungültig');if(session.events.at(-1).status!==body.status)session.events.push({status:body.status,at:now});}
 }else if(body.action==='tour'){
  const session=state.sessions.find(x=>x.driverId===driverId&&!x.endedAt);if(!session)throw Error('Bitte zuerst Einsatz starten.');
  const field=state.fields.find(x=>x.id===body.fieldId&&x.customerId===session.customerId);if(!field)throw Error('Bitte Koppel des Kunden wählen.');
  const weight=Number(body.weight);if(!Number.isFinite(weight)||weight<=0||weight>200000)throw Error('Gewicht muss zwischen 0 und 200.000 kg liegen.');
  if(state.tours.some(x=>x.id===body.id))return;
  state.tours.push({id:required(body.id,'Buchungs-ID'),sessionId:session.id,driverId,customerId:session.customerId,fieldId:field.id,weight,at:now});
 }else if(body.action==='location'){
  if(body.lat===null){driver.location=null;return;}
  if(!Number.isFinite(body.lat)||!Number.isFinite(body.lng)||Math.abs(body.lat)>90||Math.abs(body.lng)>180)throw Error('Standort ungültig');
  driver.location={lat:body.lat,lng:body.lng,accuracy:Number(body.accuracy)||0,at:now};
 }else throw Error('Aktion unbekannt');
}
const json=(res,code,value)=>{res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
const server=http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname.startsWith('/api/')){
   let body={};if(req.method==='POST'){let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>16384)throw Error('Anfrage zu groß');}body=JSON.parse(raw||'{}');}
   if(url.pathname==='/api/login'&&req.method==='POST'){
    const supplied=Buffer.from(String(body.key||'')),expected=Buffer.from(key);
    if(supplied.length!==expected.length||!timingSafeEqual(supplied,expected))return json(res,401,{error:'Betriebsschlüssel falsch.'});
    const name=required(body.name,'Fahrername');const token=randomUUID();const id=randomUUID();
    await (queue=queue.catch(()=>{}).then(async()=>{state.drivers.push({id,name,vehicle:'tractor',location:null});await save();}));
    tokens.set(token,id);return json(res,200,{token,driverId:id});
   }
   const driverId=tokens.get((req.headers.authorization||'').replace('Bearer ',''));
   if(!driverId)return json(res,401,{error:'Bitte anmelden. Nach einem Serverneustart ist eine neue Anmeldung nötig.'});
   if(url.pathname==='/api/state'&&req.method==='GET')return json(res,200,{...state,serverTime:new Date().toISOString()});
   if(url.pathname==='/api/action'&&req.method==='POST'){
    await(queue=queue.catch(()=>{}).then(async()=>{const before=structuredClone(state);try{change(body,driverId);await save();}catch(e){state=before;throw e;}}));
    return json(res,200,{ok:true});
   }
   return json(res,404,{error:'Nicht gefunden'});
  }
  const files={'/':'index.html','/app.js':'app.js','/style.css':'style.css','/manifest.webmanifest':'manifest.webmanifest','/icon.svg':'icon.svg','/sw.js':'sw.js'};
  const file=files[url.pathname];if(!file){res.writeHead(404);return res.end('Nicht gefunden');}
  const types={html:'text/html; charset=utf-8',js:'text/javascript; charset=utf-8',css:'text/css',webmanifest:'application/manifest+json',svg:'image/svg+xml'};
  res.writeHead(200,{'Content-Type':types[file.split('.').at(-1)],'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin'});res.end(await readFile(path.join(root,'public',file)));
 }catch(e){json(res,400,{error:e.message});}
});
server.listen(Number(process.env.PORT||3000),'0.0.0.0',()=>console.log('AgriTab bereit: http://localhost:'+ (process.env.PORT||3000)));

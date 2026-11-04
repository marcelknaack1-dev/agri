import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
test('two drivers share tours, customer time events and positions; records survive restart',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'agritab-test-'));
 let child;
 async function boot(){child=spawn(process.execPath,['server.mjs'],{env:{...process.env,DATA_DIR:dir,PORT:'3199',AGRITAB_KEY:'test-secret'},stdio:['ignore','pipe','pipe']});await new Promise((resolve,reject)=>{child.stdout.once('data',resolve);child.once('error',reject);child.once('exit',code=>reject(Error('Server exited '+code)));});}
 async function call(route,body,token){const r=await fetch('http://localhost:3199/api/'+route,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},...(body?{body:JSON.stringify(body)}:{})});return {code:r.status,...await r.json()};}
 async function stop(){const done=new Promise(resolve=>child.once('exit',resolve));child.kill();await done;}
 try{await boot();
 const page=await fetch('http://localhost:3199/');assert.equal(page.status,200);
 // Cross-origin map requests must identify this app without disclosing page paths.
 assert.equal(page.headers.get('referrer-policy'),'strict-origin-when-cross-origin');
 await page.text();
 assert.equal((await call('state')).code,401);assert.equal((await call('login',{name:'A',key:'bad'})).code,401);
 const a=await call('login',{name:'Fahrer A',key:'test-secret'}),b=await call('login',{name:'Fahrer B',key:'test-secret'});
 const act=body=>call('action',body,a.token);
 await act({action:'customer',name:'Hof Test'});let s=await call('state',null,b.token);const customerId=s.customers[0].id;
 await act({action:'field',name:'Nordkoppel',customerId});s=await call('state',null,b.token);const fieldId=s.fields[0].id;
 assert.equal((await act({action:'tour',id:'too-early',fieldId,weight:1000})).code,400);
 await act({action:'start',customerId});assert.equal((await act({action:'start',customerId})).code,400);
 assert.equal((await act({action:'tour',id:'bad-weight',fieldId,weight:-1})).code,400);
 await act({action:'tour',id:'load-1',fieldId,weight:18500});await act({action:'tour',id:'load-1',fieldId,weight:18500});
 await act({action:'status',status:'Warten'});await act({action:'status',status:'Pause'});await act({action:'status',status:'Arbeit'});
 await act({action:'location',lat:52.1,lng:9.2,accuracy:8});await act({action:'profile',name:'Fahrer A',vehicle:'harvester'});
 s=await call('state',null,b.token);assert.equal(s.tours.length,1);assert.equal(s.tours[0].weight,18500);assert.ok(Date.parse(s.tours[0].at));assert.deepEqual(s.sessions[0].events.map(x=>x.status),['Arbeit','Warten','Pause','Arbeit']);assert.equal(s.drivers.find(x=>x.id===a.driverId).location.lat,52.1);
 await act({action:'stop'});s=await call('state',null,b.token);assert.ok(s.sessions[0].endedAt);
 await stop();await boot();const c=await call('login',{name:'C',key:'test-secret'});s=await call('state',null,c.token);assert.equal(s.tours.length,1);assert.ok(s.sessions[0].endedAt);
 }finally{if(child?.exitCode===null)await stop();await rm(dir,{recursive:true,force:true});}
});

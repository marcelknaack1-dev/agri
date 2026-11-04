const $=s=>document.querySelector(s);
const icons={tractor:'🚜',harvester:'🌾',truck:'🚚'};
const vehicleNames={tractor:'Trecker',harvester:'Häcksler',truck:'LKW'};
// randomUUID requires HTTPS; getRandomValues also works for local HTTP previews.
const newTourId=()=>typeof crypto.randomUUID==='function'?crypto.randomUUID():Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join('');
let token=localStorage.getItem('agritab-token'),driverId=localStorage.getItem('agritab-driver');
let data={customers:[],fields:[],drivers:[],sessions:[],tours:[]},map,markers=[],watchId=null,position=null,offset=0,connected=false,busy=false,tourId;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const now=()=>Date.now()+offset;
const date=v=>new Date(v).toLocaleDateString('de-DE');
const time=v=>new Date(v).toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
const day=v=>new Date(v).toLocaleDateString('sv-SE');
const num=v=>Number(v).toLocaleString('de-DE',{maximumFractionDigits:2});
const lookup=(list,id)=>data[list].find(x=>x.id===id);
const me=()=>lookup('drivers',driverId);
const active=()=>data.sessions.find(x=>x.driverId===driverId&&!x.endedAt);
function toast(message){$('#toast').textContent=message;$('#toast').style.display='block';clearTimeout(toast.timeout);toast.timeout=setTimeout(()=>$('#toast').style.display='none',5000);}
async function api(url,body){const res=await fetch('/api/'+url,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},...(body?{body:JSON.stringify(body)}:{})});const result=await res.json();if(!res.ok){if(res.status===401&&url!=='login'){$('#login-dialog').showModal();token=null;localStorage.removeItem('agritab-token');}throw Error(result.error||'Anfrage fehlgeschlagen');}return result;}
async function sync(){if(!token)return;try{data=await api('state');offset=new Date(data.serverTime).getTime()-Date.now();connected=true;$('#connection').textContent='Verbunden · 5 s Abgleich';$('#connection').className='connection online';$('#last-sync').textContent='Letzter Abgleich '+time(data.serverTime);render();}catch(e){connected=false;$('#connection').textContent='Offline · Daten nicht aktuell';$('#connection').className='connection offline';}}
async function action(body){if(busy)throw Error('Bitte vorherige Speicherung abwarten.');busy=true;try{await api('action',body);await sync();}finally{busy=false;}}
function options(selector,list,placeholder){const el=$(selector),value=el.value;el.innerHTML=(placeholder?'<option value="">'+placeholder+'</option>':'')+list.map(x=>`<option value="${esc(x.id)}">${esc(x.name)}</option>`).join('');if(list.some(x=>x.id===value))el.value=value;}
function totals(session,onlyToday=false){const total={Arbeit:0,Warten:0,Pause:0};const midnight=new Date(now());midnight.setHours(0,0,0,0);session.events.forEach((e,i)=>{const start=Math.max(new Date(e.at).getTime(),onlyToday?midnight.getTime():0);const end=new Date(session.events[i+1]?.at||session.endedAt||now()).getTime();total[e.status]+=Math.max(0,end-start);});return total;}
const duration=ms=>`${Math.floor(ms/3600000)}:${String(Math.floor(ms/60000)%60).padStart(2,'0')}`;
function render(){
 const user=me(),session=active(),todayTours=data.tours.filter(x=>day(x.at)===day(now()));
 $('#profile-button').textContent=(user?.name||'F').split(' ').map(s=>s[0]).slice(0,2).join('').toUpperCase();
 $('#tour-count').textContent=todayTours.length;$('#total-weight').innerHTML=num(todayTours.reduce((a,x)=>a+x.weight,0)/1000)+' <em>t</em>';
 $('#active-count').textContent=new Set(data.sessions.filter(x=>!x.endedAt).map(x=>x.driverId)).size;
 options('#customer',data.customers,'Kunden auswählen');if(session)$('#customer').value=session.customerId;$('#customer').disabled=!!session;
 options('#field-customer',data.customers,'Kunden auswählen');
 $('#driver-label').textContent=user?`${icons[user.vehicle]} ${user.name} · ${vehicleNames[user.vehicle]}`:'Dein Fahrerprofil';
 $('#start-stop').textContent=session?'■ Einsatz stoppen':'▶ Einsatz starten';$('#shift-badge').textContent=session?session.events.at(-1).status:'Nicht gestartet';
 document.querySelectorAll('[data-status]').forEach(b=>{b.disabled=!session;b.classList.toggle('selected',session?.events.at(-1).status===b.dataset.status);});
 $('#recent-tours').innerHTML=tourTable([...data.tours].reverse().slice(0,5));renderTours();renderTimes();renderClock();
 $('#team').innerHTML=data.drivers.map(d=>{const s=data.sessions.find(x=>x.driverId===d.id&&!x.endedAt);const fresh=d.location&&now()-new Date(d.location.at).getTime()<30000;return `<div class="team-card"><span class="vehicle">${icons[d.vehicle]}</span><div><b>${esc(d.name)}${d.id===driverId?' · Du':''}</b><small>${esc(s?lookup('customers',s.customerId)?.name:'Kein laufender Einsatz')} · ${s?s.events.at(-1).status:'Gestoppt'}</small><small>${fresh?'● GPS aktuell':d.location?'GPS veraltet · '+time(d.location.at):'Standort nicht geteilt'}</small></div></div>`;}).join('')||'<div class="empty">Noch keine Fahrer angemeldet.</div>';
 $('#customer-list').innerHTML=data.customers.map(c=>`<div class="list-row"><b>${esc(c.name)}</b><span class="muted">${data.fields.filter(f=>f.customerId===c.id).length} Koppeln</span></div>`).join('')||'<p class="muted">Lege deinen ersten Kunden an.</p>';
 $('#field-list').innerHTML=data.fields.map(f=>`<div class="list-row"><b>${esc(f.name)}</b><span class="muted">${esc(lookup('customers',f.customerId)?.name)}</span></div>`).join('')||'<p class="muted">Noch keine Koppeln angelegt.</p>';
 renderMap();
}
function tourTable(tours){if(!tours.length)return '<div class="empty">Noch keine Touren erfasst.<br>Einsatz starten, Koppel auswählen und Waagengewicht speichern.</div>';return `<div class="table-wrap"><table><thead><tr><th>Zeitstempel</th><th>Fahrer</th><th>Kunde</th><th>Koppel</th><th>Gewicht</th><th>Status</th></tr></thead><tbody>${tours.map(t=>`<tr><td>${date(t.at)} <span class="muted">${time(t.at)}</span></td><td>${icons[lookup('drivers',t.driverId)?.vehicle]||'🚜'} ${esc(lookup('drivers',t.driverId)?.name)}</td><td>${esc(lookup('customers',t.customerId)?.name)}</td><td>${esc(lookup('fields',t.fieldId)?.name)}</td><td><strong>${num(t.weight)} kg</strong></td><td><span class="badge">Gespeichert</span></td></tr>`).join('')}</tbody></table></div>`;}
function filteredTours(){const q=$('#tour-search').value.toLowerCase(),d=$('#tour-date').value;return [...data.tours].reverse().filter(t=>(!d||day(t.at)===d)&&[lookup('drivers',t.driverId)?.name,lookup('customers',t.customerId)?.name,lookup('fields',t.fieldId)?.name].join(' ').toLowerCase().includes(q));}
function renderTours(){$('#tour-table').innerHTML=tourTable(filteredTours());}
function renderTimes(){$('#time-table').innerHTML=data.sessions.length?`<div class="table-wrap"><table><thead><tr><th>Kunde / Fahrer</th><th>Start</th><th>Stopp</th><th>Arbeit</th><th>Warten</th><th>Pause</th><th>Verlauf</th></tr></thead><tbody>${[...data.sessions].reverse().map(s=>{const t=totals(s);return `<tr><td><strong>${esc(lookup('customers',s.customerId)?.name)}</strong><br><span class="muted">${esc(lookup('drivers',s.driverId)?.name)}</span></td><td>${date(s.startedAt)}<br>${time(s.startedAt)}</td><td>${s.endedAt?date(s.endedAt)+'<br>'+time(s.endedAt):'<span class="badge">Läuft</span>'}</td><td>${duration(t.Arbeit)} h</td><td>${duration(t.Warten)} h</td><td>${duration(t.Pause)} h</td><td><details><summary>Zeitstempel</summary>${s.events.map(e=>`${esc(e.status)} · ${date(e.at)} ${time(e.at)}`).join('<br>')}</details></td></tr>`;}).join('')}</tbody></table></div>`:'<div class="empty">Noch keine Zeitbuchungen. Starte einen Einsatz für deinen Kunden.</div>';}
function renderClock(){const s=active(),elapsed=s?Math.max(0,now()-new Date(s.startedAt).getTime()):0;$('#timer').textContent=`${String(Math.floor(elapsed/3600000)).padStart(2,'0')}:${String(Math.floor(elapsed/60000)%60).padStart(2,'0')}:${String(Math.floor(elapsed/1000)%60).padStart(2,'0')}`;$('#work-time').innerHTML=duration(data.sessions.filter(x=>x.driverId===driverId).reduce((a,s)=>a+totals(s,true).Arbeit,0))+' <em>h</em>';}
function renderMap(){if(!map)return;markers.forEach(m=>m.remove());markers=[];for(const d of data.drivers){if(!d.location)continue;const fresh=now()-new Date(d.location.at).getTime()<30000;const marker=L.marker([d.location.lat,d.location.lng],{icon:L.divIcon({html:icons[d.vehicle],className:'map-vehicle'+(fresh?'':' stale'),iconSize:[40,40]})}).addTo(map).bindPopup(`<b>${esc(d.name)}</b><br>${vehicleNames[d.vehicle]}<br>Stand: ${time(d.location.at)}<br>Genauigkeit: ±${Math.round(d.location.accuracy)} m${fresh?'':'<br>Veralteter Standort'}`);markers.push(marker);}if(markers.length&&!renderMap.centered){map.fitBounds(L.featureGroup(markers).getBounds(),{maxZoom:14,padding:[35,35]});renderMap.centered=true;}}
function view(name){document.querySelectorAll('.view').forEach(v=>v.classList.toggle('hidden',v.id!==name));document.querySelectorAll('.nav').forEach(b=>b.classList.toggle('active',b.dataset.view===name));const labels={overview:['Übersicht','Alles im Blick. Gemeinsam voran.','Deine Touren, dein Team und jedes Kilo – an einem Ort.'],tours:['Touren & Gewichte','Jede Tour. Jedes Kilo.','Alle Ladungen und Waagengewichte deines Teams.'],times:['Zeiterfassung','Zeit, die nachvollziehbar bleibt.','Arbeit, Warten und Pause – für jeden Kunden.'],manage:['Betrieb','Dein Betrieb. Gut organisiert.','Kunden und Koppeln gemeinsam verwalten.']};$('#page-name').textContent=labels[name][0];$('#heading').textContent=labels[name][1];$('#subtitle').textContent=labels[name][2];if(name==='overview')setTimeout(()=>map?.invalidateSize(),50);}
document.querySelectorAll('.nav').forEach(b=>b.onclick=()=>view(b.dataset.view));$('#all-tours').onclick=()=>view('tours');
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>$('#'+b.dataset.close).close());
$('#today').textContent=new Date().toLocaleDateString('de-DE',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
$('#login-form').onsubmit=async e=>{e.preventDefault();try{const result=await api('login',Object.fromEntries(new FormData(e.target)));token=result.token;driverId=result.driverId;localStorage.setItem('agritab-token',token);localStorage.setItem('agritab-driver',driverId);$('#login-dialog').close();await sync();}catch(err){$('#login-error').textContent=err.message;}};
$('#customer-form').onsubmit=e=>submit(e,async values=>{await action({action:'customer',...values});toast('Kunde angelegt.');});
$('#field-form').onsubmit=e=>submit(e,async values=>{await action({action:'field',...values});toast('Koppel angelegt.');});
async function submit(e,fn){e.preventDefault();const button=e.target.querySelector('[type=submit],button:not([type=button])');if(button)button.disabled=true;try{await fn(Object.fromEntries(new FormData(e.target)));e.target.reset();}catch(err){toast(err.message);}finally{if(button)button.disabled=false;}}
$('#start-stop').onclick=async()=>{try{await action(active()?{action:'stop'}:{action:'start',customerId:$('#customer').value});toast(active()?'Einsatz gestartet.':'Einsatz gestoppt und Zeiten gespeichert.');}catch(err){toast(err.message);}};
document.querySelectorAll('[data-status]').forEach(b=>b.onclick=async()=>{try{await action({action:'status',status:b.dataset.status});toast(b.dataset.status+' mit Zeitstempel gespeichert.');}catch(err){toast(err.message);}});
$('#new-tour').onclick=()=>{const s=active();if(!s){toast('Wähle einen Kunden und starte zuerst deinen Einsatz.');view('overview');return;}const fields=data.fields.filter(f=>f.customerId===s.customerId);if(!fields.length){toast('Bitte zuerst eine Koppel für diesen Kunden anlegen.');view('manage');return;}options('#tour-field',fields,'Koppel auswählen');$('#tour-customer').textContent=lookup('customers',s.customerId)?.name;tourId=newTourId();$('#tour-dialog').showModal();};
$('#tour-form').onsubmit=e=>submit(e,async values=>{await action({action:'tour',id:tourId,...values});$('#tour-dialog').close();toast('Tour und Gewicht mit Zeitstempel gespeichert.');});
$('#profile-button').onclick=()=>{if(!me())return;const form=$('#profile-form');form.elements.name.value=me().name;form.elements.vehicle.value=me().vehicle;$('#profile-dialog').showModal();};
$('#profile-form').onsubmit=e=>submit(e,async values=>{await action({action:'profile',...values});$('#profile-dialog').close();toast('Fahrerprofil gespeichert.');});
$('#tour-search').oninput=renderTours;$('#tour-date').onchange=renderTours;
async function sendPosition(){if(!position||!token)return;await api('action',{action:'location',lat:position.coords.latitude,lng:position.coords.longitude,accuracy:position.coords.accuracy});}
$('#gps').onclick=async()=>{if(watchId!==null){navigator.geolocation.clearWatch(watchId);watchId=null;position=null;try{await action({action:'location',lat:null});}catch(e){toast(e.message);}$('#gps').textContent='◎ Standort teilen';$('#gps-note').textContent='Standortfreigabe ausgeschaltet.';return;}if(!window.isSecureContext||!navigator.geolocation){toast('Standort benötigt HTTPS (oder localhost) und einen Browser mit GPS-Freigabe.');return;}$('#gps-note').textContent='Standortfreigabe wird angefragt …';watchId=navigator.geolocation.watchPosition(p=>{position=p;$('#gps').textContent='■ Standort stoppen';$('#gps-note').textContent=`GPS erfasst · ±${Math.round(p.coords.accuracy)} m · Übertragung alle 5 Sekunden bei geöffneter App`;sendPosition().then(sync).catch(e=>toast(e.message));},err=>{toast('GPS: '+err.message);$('#gps-note').textContent='Kein GPS-Signal. Freigabe und Geräteeinstellungen prüfen.';},{enableHighAccuracy:true,maximumAge:5000,timeout:20000});};
function csv(filename,rows){const cell=x=>'"'+String(x??'').replace(/^[=+@-]/,"'").replace(/"/g,'""')+'"';const blob=new Blob(['\ufeff'+rows.map(r=>r.map(cell).join(';')).join('\r\n')],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('#export-tours').onclick=()=>csv('AgriTab-Touren.csv',[['Zeitstempel','Fahrer','Kunde','Koppel','Gewicht kg'],...filteredTours().map(t=>[t.at,lookup('drivers',t.driverId)?.name,lookup('customers',t.customerId)?.name,lookup('fields',t.fieldId)?.name,t.weight])]);
$('#export-times').onclick=()=>csv('AgriTab-Zeiten.csv',[['Kunde','Fahrer','Start','Stopp','Arbeit Minuten','Warten Minuten','Pause Minuten','Verlauf'],...data.sessions.map(s=>{const t=totals(s);return [lookup('customers',s.customerId)?.name,lookup('drivers',s.driverId)?.name,s.startedAt,s.endedAt,t.Arbeit/60000,t.Warten/60000,t.Pause/60000,s.events.map(e=>e.status+' '+e.at).join(' | ')];})]);
if(window.L){
 map=L.map('map').setView([52.7,9.4],7);
 L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{
  attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  // OSM requires an honest Referer. Send only the app origin to external servers,
  // including when an older running server still sends a same-origin policy.
  referrerPolicy:'strict-origin-when-cross-origin',
  maxZoom:19
 }).addTo(map);
}else $('#map').innerHTML='<div class="map-empty">Karte nicht verfügbar. Für Karten ist eine Internetverbindung nötig.</div>';
if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{});
if(!token)$('#login-dialog').showModal();else sync();
setInterval(async()=>{if(!token)return;try{await sendPosition();}catch{}await sync();},5000);
setInterval(renderClock,1000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)sync();});

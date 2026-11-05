import { MSC_CONFIG } from './config.js';
const $ = (selector, root=document) => root.querySelector(selector);
const $$ = (selector, root=document) => Array.from(root.querySelectorAll(selector));
const ready = /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(MSC_CONFIG.supabaseUrl) && MSC_CONFIG.supabasePublishableKey.length > 20;
let db=null, admin=null, selected='delegations', rows={delegations:[],hosts:[],registry:[]}, notification;

function alertUser(message){
  const t=$('#toast'); if(!t)return;
  t.textContent=message; t.classList.add('show'); clearTimeout(notification);
  notification=setTimeout(()=>t.classList.remove('show'),4200);
}
function message(id,text,ok=false){
  const el=$('#'+id); if(!el)return;
  el.textContent=text; el.classList.toggle('success',ok);
}
function pageRoute(){
  const part=(location.hash.match(/^#\/([a-z-]+)/)||[])[1]||'home';
  const route=['home','games','about','apply','registry','contact'].includes(part)?part:'home';
  $$('.page').forEach(e=>e.classList.toggle('page-active',e.dataset.page===route));
  $$('[data-nav]').forEach(e=>e.classList.toggle('active',e.dataset.nav===route));
  const titles={home:'MSC — Micronation Sports Championships',games:'The Games | MSC',about:'About MSC | MSC',apply:'Applications | MSC Games',registry:'Official Registry | MSC Games',contact:'Contact & Privacy | MSC Games'};
  document.title=titles[route];
  $('#mainNav').classList.remove('open');
  $('#menuToggle').setAttribute('aria-expanded','false');
  window.scrollTo({top:0,behavior:'instant'});
  if(route==='registry') checkSession();
}
function applicationTab(type){
  const host=type==='host';
  $('#hostPanel').classList.toggle('is-hidden',!host);
  $('#delegationPanel').classList.toggle('is-hidden',host);
  $('#tabHost').classList.toggle('active',host);
  $('#tabDelegation').classList.toggle('active',!host);
  $('#tabHost').setAttribute('aria-selected',String(host));
  $('#tabDelegation').setAttribute('aria-selected',String(!host));
  $('#formInfoTitle').textContent=host?'Bring the Games to your nation.':'Represent your micronation.';
  $('#formInfoText').textContent=host
    ? 'Share your hosting plan, digital capabilities and preferred future edition. Submission does not confer hosting rights.'
    : 'Tell the MSC committee who you represent and the events that interest you. This is an expression of interest, not confirmation of selection or eligibility.';
}
async function getDB(){
  if(!ready)return null;
  if(db)return db;
  try{
    const sdk=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.0/+esm');
    db=sdk.createClient(MSC_CONFIG.supabaseUrl,MSC_CONFIG.supabasePublishableKey,{
      auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
    });
    return db;
  }catch(error){console.error('Supabase initialization error',error);return null;}
}
function fields(form){
  const data=Object.fromEntries(new FormData(form).entries());
  delete data.consent;delete data.website;
  Object.keys(data).forEach(key=>{if(typeof data[key]==='string')data[key]=data[key].trim()});
  return data;
}
async function submitApplication(kind,form){
  const target=kind==='host'?'hostMessage':'delegationMessage';
  if(!form.reportValidity())return;
  if(form.elements.website && form.elements.website.value.trim())return;
  const client=await getDB();
  if(!client){message(target,'The MSC database is not yet connected. No application was submitted.');return;}
  const btn=$('[type=submit]',form), text=btn.innerHTML;
  btn.disabled=true;btn.textContent='Submitting…';
  try{
    const table=kind==='host'?'msc_host_applications':'msc_delegation_applications';
    const {error}=await client.from(table).insert(fields(form));
    if(error)throw error;
    form.reset();message(target,'Your expression of interest was received by the MSC registry.',true);
    alertUser('Application submitted successfully.');
  }catch(error){console.error(error);message(target,'Submission failed. Please try again or contact the MSC administration.');}
  finally{btn.disabled=false;btn.innerHTML=text;}
}
function showDashboard(visible){
  $('#registryLogin').classList.toggle('is-hidden',visible);
  $('#registryDashboard').classList.toggle('is-hidden',!visible);
  if(!visible){admin=null;$('#loginForm').elements.password.value='';}
}
async function checkSession(){
  const client=await getDB();
  if(!client){showDashboard(false);message('loginMessage','The administrator database is not configured. Sign-in is not yet available.');return;}
  try{
    const {data,error}=await client.auth.getUser();
    if(error||!data.user){showDashboard(false);return;}
    const {data:grant,error:grantError}=await client.from('msc_admins').select('user_id').eq('user_id',data.user.id).maybeSingle();
    if(grantError||!grant){await client.auth.signOut();showDashboard(false);message('loginMessage','This account does not have permission to access the MSC registry.');return;}
    admin=data.user;showDashboard(true);
    $('#adminIdentity').textContent=admin.email||'Registry administrator';
    await refresh();
  }catch(error){console.error(error);showDashboard(false);message('loginMessage','Unable to validate your administrator session.');}
}
async function login(form){
  if(!form.reportValidity())return;
  const client=await getDB();
  if(!client){message('loginMessage','MSC database has not been configured.');return;}
  const button=$('[type=submit]',form);button.disabled=true;message('loginMessage','');
  try{
    const {error}=await client.auth.signInWithPassword({email:form.elements.email.value.trim(),password:form.elements.password.value});
    if(error)throw error;
    await checkSession();
  }catch(error){console.warn('Sign-in failed',error);message('loginMessage','Unable to sign in. Please check the account and password.');}
  finally{button.disabled=false;}
}
async function refresh(){
  if(!db||!admin)return;
  try{
    const [d,h,r]=await Promise.all([
      db.from('msc_delegation_applications').select('*').order('created_at',{ascending:false}).limit(500),
      db.from('msc_host_applications').select('*').order('created_at',{ascending:false}).limit(500),
      db.from('msc_registry_entries').select('*').order('created_at',{ascending:false}).limit(500)
    ]);
    if(d.error||h.error||r.error)throw d.error||h.error||r.error;
    rows={delegations:d.data||[],hosts:h.data||[],registry:r.data||[]};
    $('#statDelegations').textContent=rows.delegations.length;
    $('#statHosts').textContent=rows.hosts.length;
    $('#statPending').textContent=[...rows.delegations,...rows.hosts].filter(x=>x.status==='pending').length;
    $('#statRegistry').textContent=rows.registry.length;
    renderTable();
  }catch(error){console.error(error);alertUser('Records could not be loaded. Check registry database permissions.');}
}
const mapping={delegations:'msc_delegation_applications',hosts:'msc_host_applications',registry:'msc_registry_entries'};
function escapeHTML(value){return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
function safe(value,max=110){const s=String(value??'');return escapeHTML(s.length>max?s.slice(0,max)+'…':s);}
function dateText(v){return v?new Date(v).toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'}):'—';}
function renderTable(){
  const query=$('#tableSearch').value.trim().toLowerCase();
  const filtered=(rows[selected]||[]).filter(row=>Object.values(row).some(value=>String(value??'').toLowerCase().includes(query)));
  const headings=selected==='delegations'?['Nation','Delegate / email','Sports','Date','Status','Review']:
    selected==='hosts'?['Nation','Contact / email','Host proposal','Edition','Status','Review']:
    ['Nation','Representative','Notes','Status','Manage'];
  $('#recordsHeader').innerHTML='<tr>'+headings.map(x=>'<th scope="col">'+x+'</th>').join('')+'</tr>';
  $('#recordsBody').innerHTML=filtered.map(row=>{
    const badge='<span class="pill-status '+safe(row.status,20)+'">'+safe(row.status,20)+'</span>';
    let actions='';
    if(selected==='registry'){
      actions=row.status==='active'?'<button data-record-action="inactive" data-id="'+row.id+'">Deactivate</button>':'<button data-record-action="active" data-id="'+row.id+'">Activate</button>';
    }else{
      actions=row.status==='pending'
        ?'<button data-record-action="approved" data-id="'+row.id+'">Approve</button> <button data-record-action="rejected" data-id="'+row.id+'">Reject</button>'
        :'<button data-record-action="pending" data-id="'+row.id+'">Reopen</button>';
    }
    let cells='';
    if(selected==='delegations')cells='<td><strong>'+safe(row.nation_name,90)+'</strong></td><td>'+safe(row.contact_name,75)+'<br>'+safe(row.email,110)+'</td><td>'+safe(row.sports,110)+'</td><td>'+dateText(row.created_at)+'</td>';
    else if(selected==='hosts')cells='<td><strong>'+safe(row.nation_name,90)+'</strong></td><td>'+safe(row.contact_name,75)+'<br>'+safe(row.email,110)+'</td><td>'+safe(row.proposal,140)+'<br><small>'+safe(row.hosting_format,60)+'</small></td><td>'+safe(row.preferred_edition,65)+'</td>';
    else cells='<td><strong>'+safe(row.nation_name,90)+'</strong></td><td>'+safe(row.representative,110)+'</td><td>'+safe(row.notes,120)+'</td>';
    return '<tr>'+cells+'<td>'+badge+'</td><td>'+actions+'</td></tr>';
  }).join('');
  $('#emptyRecords').classList.toggle('is-hidden',filtered.length>0);
  $('#registryEditor').classList.toggle('is-hidden',selected!=='registry');
}
async function setStatus(id,status){
  if(!admin||!db)return;
  const allowed=selected==='registry'?['active','inactive']:['pending','approved','rejected'];
  if(!allowed.includes(status))return;
  try{
    const {error}=await db.from(mapping[selected]).update({status,reviewed_at:new Date().toISOString()}).eq('id',id);
    if(error)throw error;
    alertUser('Registry record updated.');await refresh();
  }catch(error){console.error(error);alertUser('Record update failed.');}
}
async function addRegistryEntry(form){
  if(!admin||!db||!form.reportValidity())return;
  try{
    const {error}=await db.from('msc_registry_entries').insert(fields(form));
    if(error)throw error;
    form.reset();message('registryMessage','Registry entry created.',true);alertUser('Registry entry added.');await refresh();
  }catch(error){console.error(error);message('registryMessage','Unable to add this registry entry.');}
}
function csvCell(v){
  let value=String(v??'');if(/^\s*[=+\-@]/.test(value))value="'"+value;
  return '"'+value.replace(/"/g,'""')+'"';
}
function exportCSV(){
  if(!admin)return;
  const data=rows[selected]||[];
  if(!data.length){alertUser('No records to export.');return;}
  const keys=Object.keys(data[0]);
  const csv=[keys.map(csvCell).join(','),...data.map(row=>keys.map(k=>csvCell(row[k])).join(','))].join('\r\n');
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
  const a=document.createElement('a');a.href=url;a.download='msc-'+selected+'-'+new Date().toISOString().slice(0,10)+'.csv';
  document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function setup(){
  $('#footerYear').textContent=new Date().getFullYear();
  addEventListener('hashchange',pageRoute);pageRoute();
  $('#menuToggle').addEventListener('click',()=>{
    const n=$('#mainNav'),open=n.classList.toggle('open');
    $('#menuToggle').setAttribute('aria-expanded',String(open));
  });
  $('#tabDelegation').addEventListener('click',()=>applicationTab('delegation'));
  $('#tabHost').addEventListener('click',()=>applicationTab('host'));
  $('#delegationForm').addEventListener('submit',event=>{event.preventDefault();submitApplication('delegation',event.currentTarget);});
  $('#hostForm').addEventListener('submit',event=>{event.preventDefault();submitApplication('host',event.currentTarget);});
  $('#loginForm').addEventListener('submit',event=>{event.preventDefault();login(event.currentTarget);});
  $('#signOutButton').addEventListener('click',async()=>{
    if(db)await db.auth.signOut();showDashboard(false);alertUser('Signed out.');
  });
  $$('[data-dash-tab]').forEach(button=>button.addEventListener('click',()=>{
    selected=button.dataset.dashTab;
    $$('[data-dash-tab]').forEach(b=>b.classList.toggle('active',b===button));
    $('#tableSearch').value='';renderTable();
  }));
  $('#tableSearch').addEventListener('input',renderTable);
  $('#refreshButton').addEventListener('click',refresh);
  $('#exportButton').addEventListener('click',exportCSV);
  $('#registryForm').addEventListener('submit',event=>{event.preventDefault();addRegistryEntry(event.currentTarget);});
  $('#recordsBody').addEventListener('click',event=>{
    const btn=event.target.closest('[data-record-action]');
    if(btn)setStatus(btn.dataset.id,btn.dataset.recordAction);
  });
}
setup();

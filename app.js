import { MSC_CONFIG } from './config.js';
const $ = (selector, root=document) => root.querySelector(selector);
const $$ = (selector, root=document) => Array.from(root.querySelectorAll(selector));
const ready = /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(MSC_CONFIG.supabaseUrl) && MSC_CONFIG.supabasePublishableKey.length > 20;
let db=null, admin=null, member=null, selected='delegations', rows={delegations:[],hosts:[],registry:[]}, notification;
let editionsLoaded = false;

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
  if(route==='games') loadEditionRecords();
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
    const payload=fields(form);
    const {data:{user}}=await client.auth.getUser();
    if(user?.id)payload.user_id=user.id;
    const {error}=await client.from(table).insert(payload);
    if(error)throw error;
    form.reset();message(target,'Your expression of interest was received by the MSC registry.',true);
    alertUser('Application submitted successfully.');
    if(member)loadMemberData(member);
  }catch(error){console.error(error);message(target,'Submission failed. Please try again or contact the MSC administration.');}
  finally{btn.disabled=false;btn.innerHTML=text;}
}

function showRegistryView(which){
  $('#registryLogin').classList.toggle('is-hidden',which!=='login');
  $('#registryDashboard').classList.toggle('is-hidden',which!=='admin');
  $('#memberDashboard').classList.toggle('is-hidden',which!=='member');
  if(which!=='admin')admin=null;
  if(which!=='member')member=null;
}
function selectAuthTab(which){
  const signup=which==='signup';
  $('#loginForm').classList.toggle('is-hidden',signup);
  $('#signupForm').classList.toggle('is-hidden',!signup);
  $('#signInTab').classList.toggle('active',!signup);
  $('#signUpTab').classList.toggle('active',signup);
  $('#signInTab').setAttribute('aria-selected',String(!signup));
  $('#signUpTab').setAttribute('aria-selected',String(signup));
  $('#authHeading').textContent=signup?'Join the registry.':'Welcome back.';
  $('#authSubheading').textContent=signup?'Create a member account for your micronation.':'Sign in to access your member account or the administrator registry.';
  message('loginMessage','');message('signupMessage','');
}
async function checkSession(){
  const client=await getDB();
  if(!client){showRegistryView('login');message('loginMessage','The database is temporarily unavailable. Please try again.');return;}
  try{
    const {data,error}=await client.auth.getUser();
    if(error||!data?.user){showRegistryView('login');return;}
    const {data:grant,error:grantError}=await client.from('msc_admins').select('user_id').eq('user_id',data.user.id).maybeSingle();
    if(grantError)throw grantError;
    if(grant){
      admin=data.user;
      showRegistryView('admin');
      $('#adminIdentity').textContent=data.user.email||'Registry administrator';
      await refresh();
    }else{
      member=data.user;
      showRegistryView('member');
      $('#memberIdentity').textContent=data.user.email||'MSC member';
      await loadMemberData(data.user);
    }
  }catch(error){
    console.error('Registry session failed',error);
    showRegistryView('login');
    message('loginMessage','Unable to load your account. Please try again.');
  }
}
async function login(form){
  if(!form.reportValidity())return;
  const client=await getDB();
  if(!client){message('loginMessage','The MSC authentication service could not be reached.');return;}
  const button=$('[type=submit]',form);
  button.disabled=true;
  message('loginMessage','');
  try{
    const {data,error}=await client.auth.signInWithPassword({email:form.elements.email.value.trim(),password:form.elements.password.value});
    if(error)throw error;
    if(!data?.session)throw new Error('A valid session was not returned.');
    form.elements.password.value='';
    await checkSession();
  }catch(error){
    console.warn('Sign-in failed',error);
    const text=/email not confirmed/i.test(error.message||'')?'Please confirm your email before signing in.':/invalid login credentials/i.test(error.message||'')?'Incorrect email or password, or this account has not been created yet.':String(error.message||'Sign-in failed.');
    message('loginMessage',text);
  }finally{button.disabled=false;}
}
async function signup(form){
  if(!form.reportValidity())return;
  if(form.elements.password.value!==form.elements.confirm_password.value){
    message('signupMessage','The passwords do not match.');return;
  }
  const client=await getDB();
  if(!client){message('signupMessage','The MSC authentication service could not be reached.');return;}
  const button=$('[type=submit]',form);button.disabled=true;
  message('signupMessage','');
  const payload=fields(form);
  try{
    const {data,error}=await client.auth.signUp({
      email:payload.email,
      password:payload.password,
      options:{
        data:{nation_name:payload.nation_name,representative:payload.representative},
        emailRedirectTo:location.origin+location.pathname+'#/registry'
      }
    });
    if(error)throw error;
    if(data?.session&&data?.user){
      form.reset();
      alertUser('Member account created.');
      await checkSession();
    }else if(data?.user){
      form.reset();
      message('signupMessage','Account request received. Check your inbox for a confirmation link if one was sent. If you do not receive one, contact MSC support.',true);
    }else{
      message('signupMessage','The service did not confirm account creation. Please try again.');
    }
  }catch(error){
    console.warn('Registration failed',error);
    message('signupMessage',String(error.message||'Unable to register right now.'));
  }finally{button.disabled=false;}
}
async function loadMemberData(user){
  const client=await getDB();
  if(!client||!user)return;
  try{
    let {data:profile,error}=await client.from('msc_member_profiles').select('nation_name,representative').eq('user_id',user.id).maybeSingle();
    if(error)throw error;
    const meta=user.user_metadata||{};
    if(!profile&&meta.nation_name&&meta.representative){
      const created=await client.from('msc_member_profiles').insert({user_id:user.id,nation_name:String(meta.nation_name).slice(0,120),representative:String(meta.representative).slice(0,120)});
      if(created.error)console.warn('Initial profile creation:',created.error.message);
      else profile={nation_name:meta.nation_name,representative:meta.representative};
    }
    const form=$('#memberProfileForm');
    form.elements.nation_name.value=profile?.nation_name||'';
    form.elements.representative.value=profile?.representative||'';
    $('#memberGreeting').textContent=profile?.nation_name?'Welcome, '+profile.nation_name+'.':'Welcome to the MSC registry.';
    const [delegations,hosts]=await Promise.all([
      client.from('msc_delegation_applications').select('nation_name,status,created_at').eq('user_id',user.id).order('created_at',{ascending:false}).limit(30),
      client.from('msc_host_applications').select('nation_name,status,created_at').eq('user_id',user.id).order('created_at',{ascending:false}).limit(30)
    ]);
    if(delegations.error||hosts.error)throw delegations.error||hosts.error;
    const merged=[...(delegations.data||[]).map(x=>({...x,kind:'Delegation'})),...(hosts.data||[]).map(x=>({...x,kind:'Hosting'}))].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
    $('#memberApplications').innerHTML=merged.length?merged.map(x=>'<div class="member-application"><div><strong>'+safe(x.nation_name)+'</strong><small>'+safe(x.kind)+' · '+dateText(x.created_at)+'</small></div><span class="pill-status '+safe(x.status,20)+'">'+safe(x.status,20)+'</span></div>').join(''):'<p class="member-empty">No applications are linked to your account. Submit an application while signed in to track it here.</p>';
  }catch(error){console.error('Member profile failed',error);message('memberProfileMessage','Your profile could not be loaded. Please retry.');}
}
async function saveMemberProfile(form){
  if(!member||!form.reportValidity())return;
  const client=await getDB();
  if(!client)return;
  const p=fields(form);
  try{
    const {data:exists,error:checkError}=await client.from('msc_member_profiles').select('user_id').eq('user_id',member.id).maybeSingle();
    if(checkError)throw checkError;
    const res=exists
      ? await client.from('msc_member_profiles').update({nation_name:p.nation_name,representative:p.representative,updated_at:new Date().toISOString()}).eq('user_id',member.id)
      : await client.from('msc_member_profiles').insert({user_id:member.id,nation_name:p.nation_name,representative:p.representative});
    if(res.error)throw res.error;
    message('memberProfileMessage','Your profile has been saved.',true);
    $('#memberGreeting').textContent='Welcome, '+p.nation_name+'.';
  }catch(error){console.error(error);message('memberProfileMessage','Unable to save the profile. '+String(error.message||''));}
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
async function loadEditionRecords(){
  if(editionsLoaded)return;
  const output=$('#liveEditions');if(!output)return;
  const client=await getDB();
  if(!client){output.textContent='The Games database is temporarily unavailable.';return;}
  try{
    const [editions,disciplines]=await Promise.all([
      client.from('msc_editions').select('slug,title,period_label,host_nation,status,summary,source_url').order('period_label',{ascending:false}),
      client.from('msc_disciplines').select('edition_slug,name,programme_status').order('name')
    ]);
    if(editions.error||disciplines.error)throw editions.error||disciplines.error;
    const statusLabels={postponed:'Postponed',host_search:'Replacement host sought',announced:'Announced',scheduled:'Scheduled',completed:'Completed',cancelled:'Cancelled'};
    const all=editions.data||[];
    if(!all.length){output.textContent='No Games entries have been published.';return;}
    output.innerHTML=all.map(e=>{
      const sports=(disciplines.data||[]).filter(s=>s.edition_slug===e.slug).map(s=>'<span class="sport-chip">'+escapeHTML(s.name)+(s.programme_status==='historical_proposal'?' · proposed':'')+'</span>').join('');
      const link=String(e.source_url||'').startsWith('https://')?'<a href="'+escapeHTML(e.source_url)+'" target="_blank" rel="noopener noreferrer">View cited source ↗</a>':'';
      return '<article class="edition-card"><div class="edition-top"><span>'+escapeHTML(e.period_label)+'</span><span class="edition-status">'+escapeHTML(statusLabels[e.status]||e.status)+'</span></div><h3>'+escapeHTML(e.title)+'</h3><p>'+escapeHTML(e.summary)+'</p>'+(e.host_nation?'<small>Original host: '+escapeHTML(e.host_nation)+'</small>':'')+(sports?'<div class="sport-chips">'+sports+'</div>':'')+'<div class="edition-source">'+link+'</div></article>';
    }).join('');
    editionsLoaded=true;
  }catch(error){console.warn('Live Games data unavailable',error);output.textContent='The live Games records are unavailable. The documented timeline below remains accessible.';}
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
  $('#signupForm').addEventListener('submit',event=>{event.preventDefault();signup(event.currentTarget);});
  $('#signInTab').addEventListener('click',()=>selectAuthTab('login'));
  $('#signUpTab').addEventListener('click',()=>selectAuthTab('signup'));
  $('#memberProfileForm').addEventListener('submit',event=>{event.preventDefault();saveMemberProfile(event.currentTarget);});
  $('#memberSignOut').addEventListener('click',async()=>{if(db)await db.auth.signOut();showRegistryView('login');selectAuthTab('login');alertUser('Signed out.');});
  $('img[data-logo-fallback]').forEach(img=>img.addEventListener('error',()=>{
    const fallback=img.dataset.logoFallback;
    if(fallback&&img.getAttribute('src')!==fallback)img.src=fallback;
  }));
  $('#signOutButton').addEventListener('click',async()=>{
    if(db)await db.auth.signOut();showRegistryView('login');selectAuthTab('login');alertUser('Signed out.');
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

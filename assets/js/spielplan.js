"use strict";
const SUPABASE_URL="https://apsarswjmsrmffoyxsgr.supabase.co";
const SUPABASE_PUBLISHABLE_KEY="sb_publishable_yN9CDCZEHrCkCVMb87SkRg_hQjPjNmj";
const sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY);
let user=null, profile=null, memberships=[], matches=[], selectedMatch=null, editingId=null, icsEvents=[];
let playerAccounts=[], currentPlayerIds=[], currentPlayerTeams=[], currentPlayerTeamIds=[], linkedPlayers=[], adminTeams=[], adminTeamLabels=new Map();
let scheduleClubs=[], scheduleClubTeams=[], managedClubIds=[];
let venueBook=[], venueBookTeams=[], editingVenueId=null;
const isPlayer=()=>profile?.role==='player';
const $=id=>document.getElementById(id);

const customSelects=new WeakMap();
function syncCustomSelect(select){
  const ui=customSelects.get(select);if(!ui)return;
  const options=[...select.options];
  ui.button.textContent=options[select.selectedIndex]?.textContent||'Bitte auswählen';
  ui.button.disabled=select.disabled;
  ui.menu.innerHTML=options.map((option,index)=>`<button type="button" class="bo-select-option ${option.selected?'is-selected':''}" role="option" aria-selected="${option.selected?'true':'false'}" data-index="${index}" ${option.disabled?'disabled':''}><span>${esc(option.textContent)}</span>${option.selected?'<span class="bo-select-check">✓</span>':''}</button>`).join('');
  ui.menu.querySelectorAll('.bo-select-option').forEach(item=>item.addEventListener('click',()=>{
    const option=select.options[Number(item.dataset.index)];
    if(!option||option.disabled)return;
    select.value=option.value;
    select.dispatchEvent(new Event('change',{bubbles:true}));
    syncCustomSelect(select);
    ui.wrapper.classList.remove('is-open');
    ui.button.setAttribute('aria-expanded','false');
  }));
}
function enhanceSelect(select){
  if(!(select instanceof HTMLSelectElement)||select.classList.contains('ics-team-native')||customSelects.has(select))return;
  const wrapper=document.createElement('div');wrapper.className='bo-select';
  const button=document.createElement('button');button.type='button';button.className='bo-select-trigger';button.setAttribute('aria-haspopup','listbox');button.setAttribute('aria-expanded','false');
  const menu=document.createElement('div');menu.className='bo-select-menu';menu.setAttribute('role','listbox');
  wrapper.append(button,menu);
  select.insertAdjacentElement('afterend',wrapper);
  select.classList.add('bo-select-source');
  customSelects.set(select,{wrapper,button,menu});
  button.addEventListener('click',()=>{
    if(button.disabled)return;
    document.querySelectorAll('.bo-select.is-open').forEach(other=>{if(other!==wrapper){other.classList.remove('is-open');other.querySelector('.bo-select-trigger')?.setAttribute('aria-expanded','false')}});
    const open=wrapper.classList.toggle('is-open');button.setAttribute('aria-expanded',String(open));
    if(open){syncCustomSelect(select);const active=menu.querySelector('.is-selected');active?.scrollIntoView({block:'nearest'});}
  });
  select.addEventListener('change',()=>syncCustomSelect(select));
  syncCustomSelect(select);
}
function enhanceAllSelects(root=document){
  root.querySelectorAll('select').forEach(enhanceSelect);
}
document.addEventListener('click',event=>{
  if(event.target.closest('.bo-select'))return;
  document.querySelectorAll('.bo-select.is-open').forEach(wrapper=>{wrapper.classList.remove('is-open');wrapper.querySelector('.bo-select-trigger')?.setAttribute('aria-expanded','false')});
});
document.addEventListener('keydown',event=>{
  if(event.key==='Escape')document.querySelectorAll('.bo-select.is-open').forEach(wrapper=>{wrapper.classList.remove('is-open');wrapper.querySelector('.bo-select-trigger')?.setAttribute('aria-expanded','false')});
});
const selectObserver=new MutationObserver(records=>{
  for(const record of records){
    if(record.type==='childList'){
      if(record.target instanceof HTMLSelectElement)syncCustomSelect(record.target);
      record.addedNodes.forEach(node=>{if(node.nodeType===1){if(node.matches?.('select'))enhanceSelect(node);enhanceAllSelects(node);}});
    }
  }
});
document.addEventListener('DOMContentLoaded',()=>{
  enhanceAllSelects();
  selectObserver.observe(document.body,{childList:true,subtree:true});
});

const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmtDate=d=>d?new Date(d+"T12:00:00").toLocaleDateString("de-DE"):"–";
const fmtStatus=s=>s==='live'?'<span class="badge live">LIVE</span>':s==='finished'?'<span class="badge done">Beendet</span>':'<span class="badge">Geplant</span>';
function msg(t,kind=""){const e=$("message");e.style.display="block";e.className="status "+kind;e.textContent=t;}
function isAdmin(){return profile?.role==='admin';}
function hasManagerAccess(){return isAdmin()||managedClubIds.length>0||memberships.some(x=>x.role==='team_manager');}
function togglePanel(id,button){const panel=$(id);if(!panel)return;const open=panel.hidden;panel.hidden=!open;button.setAttribute('aria-expanded',String(open));const mark=button.querySelector('.toggle-mark');if(mark)mark.textContent=open?'−':'＋';}
function canManageVenueBook(){return isAdmin()||managedClubIds.length>0||memberships.some(x=>x.role==='team_manager');}
async function loadVenueBook(){
  const section=$('venueBookSection'); if(section)section.style.display=canManageVenueBook()?'block':'none';
  const [{data,error},{data:links,error:linkError}]=await Promise.all([sb.from('venue_book').select('id,label,address').order('label',{ascending:true}),sb.from('venue_book_teams').select('venue_id,team')]);
  if(error){console.warn('Adressbuch konnte nicht geladen werden:',error.message);venueBook=[];return;}
  if(linkError){console.warn('Mannschaftszuordnungen konnten nicht geladen werden:',linkError.message);venueBookTeams=[];}else venueBookTeams=links||[];
  venueBook=data||[];renderVenueBook();refreshVenueSelect();
}
function renderVenueBook(){
  const el=$('venueBookList');if(!el)return;
  const teams=['SG Hamminkeln-Wesel 1','SG Hamminkeln-Wesel 2','SG Hamminkeln-Wesel 3'];
  el.innerHTML=venueBook.length?venueBook.map(v=>{const assigned=venueBookTeams.filter(x=>Number(x.venue_id)===Number(v.id)).map(x=>x.team);return `<div class="venue-row"><strong>${esc(v.label)}</strong><span>${esc(v.address)}</span>${canManageVenueBook()?`<button class="secondary" onclick="editVenue(${v.id})">Ändern</button><button class="danger" onclick="deleteVenue(${v.id})">Löschen</button>`:''}<div class="venue-teams"><button type="button" class="secondary" onclick="openVenueTeams(${v.id})">Mannschaften zuordnen (${assigned.length})</button><span class="small">${assigned.length?esc(assigned.join(', ')):'Keine Mannschaft zugeordnet'}</span></div></div>`}).join(''):'<div class="status">Noch keine Austragungsorte angelegt.</div>';
}
let activeVenueTeamsId=null;
window.openVenueTeams=id=>{if(!canManageVenueBook())return;const v=venueBook.find(x=>Number(x.id)===Number(id));if(!v)return;activeVenueTeamsId=v.id;$('venueTeamsVenueName').textContent=v.label+' — '+v.address;const teams=['SG Hamminkeln-Wesel 1','SG Hamminkeln-Wesel 2','SG Hamminkeln-Wesel 3'];const assigned=venueBookTeams.filter(x=>Number(x.venue_id)===Number(id)).map(x=>x.team);$('venueTeamsChoices').innerHTML=teams.map(t=>`<label style="display:flex;align-items:center;gap:10px;padding:10px;border:1px solid var(--line);border-radius:8px"><input style="width:auto" type="checkbox" ${assigned.includes(t)?'checked':''} onchange="setVenueTeam(${id},this)">${esc(t)}</label>`).join('');$('venueTeamsModal').style.display='flex';};
window.closeVenueTeams=()=>{$('venueTeamsModal').style.display='none';activeVenueTeamsId=null;renderVenueBook();};
function refreshVenueSelect(){const sel=$('venueSelect');if(!sel)return;const current=sel.value;sel.innerHTML='<option value="">Ort auswählen …</option>'+venueBook.map(v=>`<option value="${v.id}">${esc(v.label)} — ${esc(v.address)}</option>`).join('');if(current)sel.value=current;}
window.setVenueTeam=async(venueId,input)=>{if(!canManageVenueBook()){input.checked=!input.checked;return}const team=input.parentElement.textContent.trim();if(!team)return;input.disabled=true;let result;if(input.checked){result=await sb.from('venue_book_teams').insert({venue_id:venueId,team});}else{result=await sb.from('venue_book_teams').delete().eq('venue_id',venueId).eq('team',team)}if(result.error){alert('Mannschaftszuordnung konnte nicht gespeichert werden: '+result.error.message);input.checked=!input.checked;}else{if(input.checked){if(!venueBookTeams.some(x=>Number(x.venue_id)===Number(venueId)&&x.team===team))venueBookTeams.push({venue_id:venueId,team});}else venueBookTeams=venueBookTeams.filter(x=>!(Number(x.venue_id)===Number(venueId)&&x.team===team));}input.disabled=false;const count=venueBookTeams.filter(x=>Number(x.venue_id)===Number(venueId)).length;const v=venueBook.find(x=>Number(x.id)===Number(venueId));if(v){const modal=$('venueTeamsModal');if(modal&&modal.style.display==='flex')$('venueTeamsVenueName').textContent=v.label+' — '+v.address;const row=[...$('venueBookList').querySelectorAll('.venue-row')].find(r=>r.querySelector('strong')?.textContent===v.label);if(row){const btn=row.querySelector('.venue-teams button');if(btn)btn.textContent='Mannschaften zuordnen ('+count+')';const summary=row.querySelector('.venue-teams .small');if(summary)summary.textContent=count?venueBookTeams.filter(x=>Number(x.venue_id)===Number(venueId)).map(x=>x.team).join(', '):'Keine Mannschaft zugeordnet';}}};
function selectVenueFromText(value){const v=venueBook.find(x=>`${x.label} — ${x.address}`===value||x.address===value||x.label===value);$('venueSelect').value=v?String(v.id):'';}
function rolesForTeam(t){const rec=scheduleClubTeams.find(x=>String(x.id)===String(t)||x.name===t);return memberships.filter(x=>(rec&&x.team_id&&String(x.team_id)===String(rec.id))||x.team===t).map(x=>x.role)}
function canManage(t){const rec=scheduleClubTeams.find(x=>String(x.id)===String(t)||x.name===t);return isAdmin()||(rec&&managedClubIds.includes(String(rec.club_id)))||rolesForTeam(t).includes('team_manager')}
function teamRecordForName(name){const matches=seasonScopedTeams().filter(t=>t.name===name&&(!selectedClubId()||String(t.club_id)===String(selectedClubId())));return matches.length===1?matches[0]:null}
function teamNameForId(id){return scheduleClubTeams.find(t=>String(t.id)===String(id))?.name||''}
function normalizeTeamLabel(value){return String(value||'').normalize('NFKC').toLocaleLowerCase('de').replace(/[–—]/g,'-').replace(/\s*-\s*/g,'-').replace(/\s+/g,' ').trim()}
function visibleTeams(){
  return [...new Set(adminTeams.filter(Boolean))].sort((a,b)=>a.localeCompare(b,"de",{numeric:true}));
}
function selectedClubId(){return $('clubFilter')?.value||'';}
function selectedTeamName(){return $('teamFilter')?.value||'';}
function seasonScopedTeams(rows=scheduleClubTeams){
  const season=String($('seasonFilter')?.value||'').trim();
  return rows.filter(t=>!season||!t.season||String(t.season)===season);
}
function applyAdminSearch(){
  const query=String($('adminScheduleSearch')?.value||'').trim().toLocaleLowerCase('de');
  const clubSelect=$('clubFilter'),teamSelect=$('teamFilter');
  if(!clubSelect||!teamSelect)return;
  const currentClub=clubSelect.value,currentTeam=teamSelect.value;
  const seasonTeams=seasonScopedTeams();
  const clubs=scheduleClubs.filter(c=>!query||`${c.name} ${c.city||''}`.toLocaleLowerCase('de').includes(query)||
    seasonTeams.some(t=>String(t.club_id)===String(c.id)&&t.name.toLocaleLowerCase('de').includes(query)));
  clubSelect.innerHTML='<option value="">Verein auswählen …</option>'+clubs.map(c=>`<option value="${esc(c.id)}">${esc(c.name)}${c.city?' · '+esc(c.city):''}</option>`).join('');
  if(clubs.some(c=>String(c.id)===String(currentClub)))clubSelect.value=currentClub;
  const activeClub=clubSelect.value;
  const teams=seasonTeams.filter(t=>(!activeClub||String(t.club_id)===String(activeClub))&&
    (!query||`${t.name} ${scheduleClubs.find(c=>String(c.id)===String(t.club_id))?.name||''}`.toLocaleLowerCase('de').includes(query)));
  teamSelect.innerHTML='<option value="">Alle Mannschaften</option>'+teams.map(t=>`<option value="${esc(t.name)}">${esc(t.name)}${t.season?' · '+esc(t.season):''}</option>`).join('');
  if(teams.some(t=>t.name===currentTeam))teamSelect.value=currentTeam;
  adminTeams=[...new Set(teams.map(t=>t.name))];
  adminTeamLabels=new Map(teams.map(t=>[t.name,`${scheduleClubs.find(c=>String(c.id)===String(t.club_id))?.name||'Verein'} · ${t.name}`]));
}
async function loadScheduleClubs(){
  const clubSelect=$('clubFilter'),teamSelect=$('teamFilter');
  if(!clubSelect||!teamSelect)return;
  const [{data:clubs,error:clubError},{data:clubTeams,error:teamError},{data:managerRows,error:managerError}]=await Promise.all([
    sb.from('clubs').select('id,name,city,archived_at').is('archived_at',null).order('name'),
    sb.from('club_teams').select('id,name,season,club_id,is_active').eq('is_active',true).order('name'),
    user?sb.from('club_managers').select('club_id').eq('user_id',user.id):Promise.resolve({data:[],error:null})
  ]);
  const error=clubError||teamError||managerError;
  if(error){msg('Vereine oder Mannschaften konnten nicht geladen werden: '+error.message,'bad');return;}
  const allClubs=clubs||[];
  const allTeams=clubTeams||[];
  managedClubIds=(managerRows||[]).map(x=>String(x.club_id));
  let allowedClubs;
  if(isAdmin()) allowedClubs=allClubs;
  else {
    const teamNames=new Set([...memberships.map(x=>x.team),...currentPlayerTeams]);
    const roleClubIds=memberships.map(x=>String(x.club_id||'')).filter(Boolean);
    const inferredClubIds=allTeams.filter(t=>teamNames.has(t.name)||memberships.some(x=>String(x.team_id||'')===String(t.id))).map(t=>String(t.club_id));
    const ids=new Set([...managedClubIds,...inferredClubIds,...roleClubIds]);
    allowedClubs=allClubs.filter(c=>ids.has(String(c.id)));
  }
  scheduleClubs=allowedClubs;
  const allowedIds=new Set(allowedClubs.map(c=>String(c.id)));
  scheduleClubTeams=allTeams.filter(t=>allowedIds.has(String(t.club_id)));
  if(!isAdmin()&&!scheduleClubTeams.length){
    // Fallback für ältere team_memberships, die nicht aus club_teams stammen.
    const names=[...new Set([...memberships.map(x=>x.team),...currentPlayerTeams])];
    scheduleClubTeams=names.map(name=>({id:name,name,club_id:'',season:''}));
  }
  const previousClub=clubSelect.value;
  clubSelect.innerHTML='<option value="">Alle Vereine</option>'+scheduleClubs.map(c=>`<option value="${esc(c.id)}">${esc(c.name)}${c.city?' · '+esc(c.city):''}</option>`).join('');
  if(scheduleClubs.some(c=>String(c.id)===String(previousClub)))clubSelect.value=previousClub;
  $('adminSearchWrap').hidden=!isAdmin();
  if(isAdmin()) applyAdminSearch();
  else {
    const previousTeam=teamSelect.value;
    teamSelect.innerHTML='<option value="">Alle Mannschaften</option>'+seasonScopedTeams().map(t=>`<option value="${esc(t.name)}">${esc(t.name)}${t.season?' · '+esc(t.season):''}</option>`).join('');
    if(scheduleClubTeams.some(t=>t.name===previousTeam))teamSelect.value=previousTeam;
    adminTeams=[...new Set(scheduleClubTeams.map(t=>t.name))];
  }
  buildTeamFilter();
  applySavedScheduleSelection();
}
async function loadAdminTeams(){return loadScheduleClubs();}
function otherTeam(m,t){return m.home_team===t?m.away_team:m.home_team;}
async function loadUser(){
  const {data:{user:u}}=await sb.auth.getUser();user=u;if(!u){showLoggedOut();return;}
  const [pr,ms,pa,tr,cm]=await Promise.all([
    sb.from('profiles').select('id,display_name,role').eq('id',u.id).maybeSingle(),
    sb.from('team_memberships').select('team,role').eq('user_id',u.id),
    sb.from('player_accounts').select('player_id,is_primary,active').eq('user_id',u.id).eq('active',true),
    sb.from('club_team_user_roles').select('team_id,club_id,role,status').eq('user_id',u.id).eq('status','active'),
    sb.from('club_managers').select('club_id').eq('user_id',u.id)
  ]);
  profile=pr.data;
  const legacy=ms.data||[];
  const roleRows=tr.data||[];
  managedClubIds=(cm.data||[]).map(x=>String(x.club_id));
  let roleTeams=[];
  const roleTeamIds=[...new Set(roleRows.map(x=>x.team_id))];
  if(roleTeamIds.length){const {data:rt}=await sb.from('club_teams').select('id,name,club_id,season').in('id',roleTeamIds);roleTeams=rt||[];}
  memberships=[...legacy,...roleRows.map(r=>{const t=roleTeams.find(x=>String(x.id)===String(r.team_id));return {team:t?.name||'',team_id:r.team_id,club_id:r.club_id,role:r.role};})];
  if(pa.error){playerAccounts=[];if(profile?.role==='player')console.warn('Spielerkonten konnten nicht geladen werden:',pa.error.message);}else playerAccounts=pa.data||[];
  currentPlayerIds=[...new Set(playerAccounts.map(x=>Number(x.player_id)).filter(Number.isFinite))];
  currentPlayerTeamIds=[];currentPlayerTeams=[];linkedPlayers=[];
  if(currentPlayerIds.length){
    const {data:linked}=await sb.from('players').select('id,name').in('id',currentPlayerIds);
    const {data:assignments}=await sb.from('club_team_players').select('team_id,player_id').in('player_id',currentPlayerIds);
    const ids=[...new Set((assignments||[]).map(x=>x.team_id))];
    let playerTeams=[];
    if(ids.length){const {data:teams}=await sb.from('club_teams').select('id,name,club_id,season').in('id',ids);playerTeams=teams||[];currentPlayerTeamIds=ids;currentPlayerTeams=[...new Set(playerTeams.map(x=>x.name))];}
    linkedPlayers=(linked||[]).map(p=>{const a=(assignments||[]).find(x=>Number(x.player_id)===Number(p.id));const t=playerTeams.find(x=>String(x.id)===String(a?.team_id));return {...p,team_id:a?.team_id||null,team:t?.name||''};});
  }
  await loadScheduleClubs();
  showLoggedIn();
}
function syncMoreMenuAccess(){
  const roles=new Set([String(profile?.role||'').toLowerCase(),...memberships.map(x=>String(x.role||'').toLowerCase())]);
  const loggedIn=!!user;
  document.querySelectorAll('#moreMenu a[data-roles]').forEach(a=>{
    const allowed=(a.dataset.roles||'').split(',').some(r=>roles.has(r));
    a.hidden=!loggedIn||!allowed;
  });
  const title=document.querySelector('#moreMenu .menu-title');
  if(title)title.hidden=!loggedIn;
}
function showLoggedOut(){
  syncMoreMenuAccess();
  $('accessInfo').hidden=false;
  $('accessInfoText').textContent='Bitte melde dich über das Profil-Symbol oben rechts an, um Zugriff auf den Spielplan zu erhalten.';
  $('controls').style.display='none';$('scheduleCard').style.display='none';$('availabilityModal').style.display='none';
  const menu=$('profileMenu');if(menu){$('profileLogin').hidden=false;$('profileLogout').hidden=true;}
}
function showLoggedIn(){
  syncMoreMenuAccess();
  const teams=visibleTeams();
  $('accessInfo').hidden=!!(isAdmin()||teams.length);
  $('controls').style.display='block';
  $('scheduleCard').style.display='block';
  if(isAdmin()&&!teams.length){
    $('accessInfo').hidden=false;
    $('accessInfoText').textContent='Du bist als Admin angemeldet. Aktuell konnten jedoch keine Mannschaften oder Begegnungen aus den vorhandenen Spielplandaten ermittelt werden.';
  }else if(!isAdmin()&&!teams.length){
    $('accessInfo').hidden=false;
    $('accessInfoText').textContent=isPlayer()
      ?'Du bist angemeldet, aber deinem Konto ist noch kein Spielerprofil bzw. keine Mannschaft zugeordnet. Bitte wende dich an deine Vereinsverwaltung.'
      :'Du bist angemeldet, aber keinem Verein bzw. keiner Mannschaft zugeordnet. Bitte wende dich an deine Vereinsverwaltung.';
    $('controls').style.display='none';$('scheduleCard').style.display='none';
  }
  $('roleInfo').textContent=isAdmin()?'Admin · alle Mannschaften':isPlayer()?(teams.length?'Spieler · '+teams.join(' | '):'Keine Mannschaft zugeordnet'):(memberships.length?memberships.map(x=>x.team+' · '+x.role).join(' | '):'Keine Mannschaftszuordnung');
  const managerControls=isAdmin()||managedClubIds.length>0||memberships.some(x=>x.role==='team_manager');
  $('newBtn').style.display=managerControls?'':'none';$('turnierPlaydataOpen').style.display=managerControls?'':'none';$('icsFile').disabled=!managerControls;$('icsFile').parentElement.style.display=managerControls?'':'none';$('exportBtn').style.display='';
  const menu=$('profileMenu');if(menu){$('profileLogin').hidden=true;$('profileLogout').hidden=false;}
  buildTeamFilter();updateTurnierPlaydataButton();loadVenueBook();if(teams.length||isAdmin())loadMatches();
}
function buildTeamFilter(){
  const teamSelect=$('teamFilter');
  if(!teamSelect)return;
  const teams=visibleTeams();
  const current=teamSelect.value;
  teamSelect.innerHTML='<option value="">Mannschaft auswählen …</option>'+teams.map(t=>`<option value="${esc(t)}">${esc(adminTeamLabels.get(t)||t)}</option>`).join('');
  if(teams.includes(current))teamSelect.value=current;
}
function schedulePreferenceKey(){return `badminone-schedule-selection:${user?.id||'guest'}`;}
function readSchedulePreference(){try{return JSON.parse(localStorage.getItem(schedulePreferenceKey())||'{}')}catch{return {};}}
function saveSchedulePreference(){try{localStorage.setItem(schedulePreferenceKey(),JSON.stringify({clubId:selectedClubId(),teamName:selectedTeamName()}));}catch{}}
function applySavedScheduleSelection(useSaved=true){
  const clubSelect=$('clubFilter'),teamSelect=$('teamFilter');if(!clubSelect||!teamSelect)return;
  const pref=readSchedulePreference(),scoped=seasonScopedTeams();
  const validClub=id=>scheduleClubs.some(c=>String(c.id)===String(id));
  let club=clubSelect.value,team=teamSelect.value;
  if(useSaved&&!club&&pref.clubId&&validClub(pref.clubId))club=String(pref.clubId);
  if(useSaved&&!team&&pref.teamName&&scoped.some(t=>t.name===pref.teamName&&(!club||String(t.club_id)===String(club))))team=pref.teamName;
  if(!club&&scheduleClubs.length===1)club=String(scheduleClubs[0].id);
  let options=scoped.filter(t=>!club||String(t.club_id)===String(club));
  if(team&&!options.some(t=>t.name===team))team='';
  if(!team&&options.length===1)team=options[0].name;
  if(!team&&scoped.length===1){team=scoped[0].name;if(scoped[0].club_id)club=String(scoped[0].club_id);}
  if(team){const rec=scoped.find(t=>t.name===team&&(!club||String(t.club_id)===String(club)));if(rec?.club_id)club=String(rec.club_id);}
  if(club&&validClub(club))clubSelect.value=club;
  options=scoped.filter(t=>!club||String(t.club_id)===String(club));
  teamSelect.innerHTML='<option value="">Mannschaft auswählen …</option>'+options.map(t=>`<option value="${esc(t.name)}">${esc(adminTeamLabels.get(t.name)||t.name)}${t.season?' · '+esc(t.season):''}</option>`).join('');
  if(team&&options.some(t=>t.name===team))teamSelect.value=team;
  saveSchedulePreference();
}
async function loadMatches(){
  if(!selectedTeamName()){matches=[];renderMatches();return;}
  let q=sb.from('matches').select('id,home_team,away_team,home_team_id,away_team_id,managed_by_team,managed_by_team_id,match_date,match_time,venue,status,season,is_public,ics_uid,schedule_version,updated_at').order('match_date',{ascending:true}).order('match_time',{ascending:true});
  const sf=$('seasonFilter').value.trim();if(sf)q=q.eq('season',sf);
  const {data,error}=await q;if(error){msg('Spielplan konnte nicht geladen werden: '+error.message,'bad');return;}
  const teams=visibleTeams();
  const selectedTeam=selectedTeamName();
  const selectedRecord=selectedTeam?teamRecordForName(selectedTeam):null;
  const allowedTeamIds=new Set([
    ...memberships.map(x=>x.team_id).filter(Boolean).map(String),
    ...currentPlayerTeamIds.map(String),
    ...scheduleClubTeams.filter(t=>managedClubIds.includes(String(t.club_id))).map(t=>String(t.id))
  ]);
  const filteredTeamIds=new Set(selectedRecord?[String(selectedRecord.id)]:seasonScopedTeams().filter(t=>!selectedClubId()||String(t.club_id)===String(selectedClubId())).map(t=>String(t.id)));
  const base=(data||[]).filter(m=>{
    const homeId=String(m.home_team_id||''),awayId=String(m.away_team_id||'');
    if(isAdmin())return !selectedTeam&&!selectedClubId() || filteredTeamIds.has(homeId)||filteredTeamIds.has(awayId);
    const own=allowedTeamIds.has(homeId)||allowedTeamIds.has(awayId)||teams.includes(m.home_team)||teams.includes(m.away_team);
    if(!own)return false;
    if(selectedTeam)return (selectedRecord?(homeId===String(selectedRecord.id)||awayId===String(selectedRecord.id)):(filteredTeamIds.has(homeId)||filteredTeamIds.has(awayId)))||(!homeId&&!awayId&&(m.home_team===selectedTeam||m.away_team===selectedTeam));
    if(selectedClubId())return filteredTeamIds.has(homeId)||filteredTeamIds.has(awayId);
    return true;
  });
  const ids=base.map(m=>m.id);

  // Für Manager/Admin automatisch offene Status für alle aktiven Spieler anlegen.
  // Spieler lesen nur ihre bereits vorhandenen Status.
  let avs=[];
  if(ids.length){
    if(hasManagerAccess()){
      const teamIds=[...new Set(base.flatMap(m=>[m.home_team_id,m.away_team_id]).filter(Boolean))];
      let assignments=[],playersForAvailability=[],teamMap=new Map();
      if(teamIds.length){
        const {data:as,error:asError}=await sb.from('club_team_players').select('team_id,player_id').in('team_id',teamIds);
        if(asError){msg('Mannschaftskader konnten nicht geladen werden: '+asError.message,'bad');return;}
        assignments=as||[];
        const pids=[...new Set(assignments.map(a=>a.player_id))];
        const {data:ts}=await sb.from('club_teams').select('id,name').in('id',teamIds);(ts||[]).forEach(t=>teamMap.set(String(t.id),t.name));
        if(pids.length){const {data:ps,error:pe}=await sb.from('players').select('id,user_id,active').in('id',pids).eq('active',true);if(pe){msg('Spieler konnten nicht geladen werden: '+pe.message,'bad');return;}playersForAvailability=ps||[];}
      }
      const {data:existing,error:ea}=await sb.from('match_availability')
        .select('id,match_id,player_id,user_id,team,status,is_substitute')
        .in('match_id',ids);
      if(ea){msg('Spielstatus konnte nicht geladen werden: '+ea.message,'bad');return;}
      const existingKeys=new Set((existing||[]).map(a=>`${a.match_id}:${a.player_id}`));
      const pmap=new Map(playersForAvailability.map(p=>[Number(p.id),p]));
      const needed=[];
      for(const m of base){
        for(const a of assignments.filter(x=>x.team_id===m.home_team_id||x.team_id===m.away_team_id)){
          const p=pmap.get(Number(a.player_id));if(!p)continue;
          const key=`${m.id}:${p.id}`;if(existingKeys.has(key))continue;
          needed.push({match_id:m.id,player_id:p.id,user_id:p.user_id||null,team:teamMap.get(String(a.team_id))||'',status:'pending',is_substitute:false});
          existingKeys.add(key);
        }
      }
      for(const row of needed){const {error:ie}=await sb.from('match_availability').insert(row);if(ie&&ie.code!=='23505'){msg('Spielstatus konnte nicht initialisiert werden: '+ie.message,'bad');return;}}
    }

    const {data:a,error:ae}=await sb.from('match_availability')
      .select('match_id,user_id,player_id,team,status,is_substitute')
      .in('match_id',ids);
    if(ae){msg('Spielstatus konnte nicht geladen werden: '+ae.message,'bad');return;}
    avs=a||[];
  }
  // Tatsächliche Teilnahme unabhängig von vorheriger Zu-/Absage laden.
  let playedRows=[];
  if(ids.length){
    const {data:games,error:ge}=await sb.from('match_games')
      .select('match_id,player1,player2,opponent_player1,opponent_player2')
      .in('match_id',ids);
    if(ge){console.warn('Aufstellungen nicht lesbar:',ge.message);}
    else playedRows=games||[];
  }
  let reports=[];
  if(ids.length){
    const {data:reportRows,error:re}=await sb.from('match_reports').select('match_id,confirmed,pdf_path,pdf_generated_at').in('match_id',ids);
    if(!re) reports=reportRows||[];
  }
  matches=base.map(m=>({...m,_avs:avs.filter(a=>a.match_id===m.id),_games:playedRows.filter(g=>g.match_id===m.id),_report:reports.find(r=>r.match_id===m.id)||null}));
  const releasedIds=new Set((avs||[]).filter(a=>a.user_id===user.id&&a.is_substitute).map(a=>a.match_id));
  matches.forEach(m=>{m._releasedToMe=releasedIds.has(m.id);m._subTeam=m._avs.find(a=>a.user_id===user.id&&a.is_substitute)?.team||null});
  // Keine serverseitige Teilnahmeauswertung aus dem Spieler-Frontend aufrufen.
  // Abschlussstatus werden durch die Datenbank-Trigger bei relevanten Änderungen
  // verarbeitet. Vorhandene Verfügbarkeiten bleiben unverändert und werden
  // aus der zuvor geladenen match_availability-Abfrage angezeigt.
  renderMatches();
  renderVenueBook();
}
function availabilityLabel(a){
  if(!a)return '<span class="badge pill-warn">Offen</span>';
  if(a.status==='accepted')return '<span class="badge pill-ok">Zugesagt</span>';
  if(a.status==='declined')return '<span class="badge pill-bad">Abgesagt</span>';
  return '<span class="badge pill-warn">Offen</span>';
}
function currentUserAvailability(m){
  let a=(m._avs||[]).find(x=>x.user_id===user.id);
  if(!a && isPlayer() && currentPlayerIds.length){
    a=(m._avs||[]).find(x=>currentPlayerIds.includes(Number(x.player_id)));
  }
  return a;
}
function normalizePlayerName(s){return String(s||'').trim().replace(/\s+/g,' ').toLocaleLowerCase('de-DE');}
function actualParticipation(m,player){
  if(m.status!=='finished'||!player)return null;
  if(!Array.isArray(m._games)||!m._games.length)return null; // Keine Aufstellung: unbekannt
  const home=player.team===m.home_team, away=player.team===m.away_team;
  if(!home&&!away)return null;
  const fields=home?['player1','player2']:['opponent_player1','opponent_player2'];
  const name=normalizePlayerName(player.name);
  return m._games.some(g=>fields.some(f=>normalizePlayerName(g[f])===name));
}
function myParticipation(m){
  if(!isPlayer()||m.status!=='finished')return null;
  const mine=linkedPlayers.filter(p=>currentPlayerIds.includes(Number(p.id)) && (p.team===m.home_team||p.team===m.away_team||m._releasedToMe));
  if(!mine.length)return null;
  const outcomes=mine.map(p=>actualParticipation(m,p));
  return outcomes.includes(true)?true:outcomes.every(x=>x===false)?false:null;
}
function participationLabel(a,m,player=null){
  const played=player?actualParticipation(m,player):myParticipation(m);
  if(played===true)return '<span class="badge pill-ok">Teilgenommen</span>';
  if(played===false)return '<span class="badge pill-bad">Nicht eingesetzt</span>';
  if(m.status==='finished')return '<span class="badge">Teilnahme nicht ermittelbar</span>';
  return availabilityLabel(a);
}
function managerSummary(m){const a=(m._avs||[]).filter(x=>!x.is_substitute);const ok=a.filter(x=>x.status==='accepted').length,bad=a.filter(x=>x.status==='declined').length,open=a.filter(x=>x.status==='pending').length;return `${ok} zugesagt · ${bad} abgesagt · ${open} offen`;}
function renderMatches(){
  const filter=$('teamFilter').value;
  if(!filter){$('scheduleCard').style.display='none';$('schedule').innerHTML='';$('count').textContent='';return;}
  $('scheduleCard').style.display='block';
  // Spieler sehen grundsätzlich alle Begegnungen ihrer Mannschaft.
  // Die Verfügbarkeit ist keine Voraussetzung dafür, dass eine Begegnung
  // angezeigt wird: Gerade neue/offene Spiele können noch keinen Status
  // für den Spieler besitzen.
  const filterRecord=filter?teamRecordForName(filter):null;
  const filterId=filterRecord?String(filterRecord.id):'';
  const normalizedFilter=normalizeTeamLabel(filter);
  let list=matches.filter(m=>!filter||
    (filterId && (String(m.home_team_id||'')===filterId || String(m.away_team_id||'')===filterId || String(m.managed_by_team_id||'')===filterId)) ||
    normalizeTeamLabel(m.home_team)===normalizedFilter || normalizeTeamLabel(m.away_team)===normalizedFilter ||
    normalizeTeamLabel(m.managed_by_team)===normalizedFilter || m._releasedToMe);
  if(isPlayer()&&!hasManagerAccess()){
    list=list.filter(m=>m._releasedToMe || currentPlayerTeams.includes(m.home_team) || currentPlayerTeams.includes(m.away_team));
  }
  const groups={};
  const ownTeams=[...new Set([...visibleTeams(),...currentPlayerTeams])];
  list.forEach(m=>{
    const released=m._releasedToMe;
    // Auswärtsspiele ebenfalls unter der eigenen SG-Mannschaft gruppieren.
    const belongsToFilter=!!filter&&((filterId&&(String(m.home_team_id||'')===filterId||String(m.away_team_id||'')===filterId||String(m.managed_by_team_id||'')===filterId))||normalizeTeamLabel(m.home_team)===normalizedFilter||normalizeTeamLabel(m.away_team)===normalizedFilter||normalizeTeamLabel(m.managed_by_team)===normalizedFilter);
    const assignedTeam=belongsToFilter?filter:ownTeams.find(t=>normalizeTeamLabel(m.home_team)===normalizeTeamLabel(t)||normalizeTeamLabel(m.away_team)===normalizeTeamLabel(t));
    const t=released?'Freigeschaltete Spiele':(assignedTeam||m.home_team);
    (groups[t]??=[]).push(m);
  });
  let html='';
  if(isPlayer()&&!hasManagerAccess()){
    const mine=list.filter(m=>!m._releasedToMe);
    const accepted=mine.filter(m=>m.status!=='finished'&&currentUserAvailability(m)?.status==='accepted').length;
    const declined=mine.filter(m=>m.status!=='finished'&&currentUserAvailability(m)?.status==='declined').length;
    const open=mine.filter(m=>m.status!=='finished'&&(!currentUserAvailability(m)||currentUserAvailability(m)?.status==='pending')).length;
    const played=mine.filter(m=>myParticipation(m)===true).length;
    const notPlayed=mine.filter(m=>myParticipation(m)===false).length;
    const released=list.filter(m=>m._releasedToMe).length;
    html+=`<div class="player-banner"><strong>👤 Meine Spielübersicht</strong><div class="small">Du bist mit ${currentPlayerIds.length||'keinem'} Spielerprofil${currentPlayerIds.length===1?'':'en'} verknüpft.${currentPlayerTeams.length?' Mannschaft: '+esc(currentPlayerTeams.join(' · ')):''}</div><div class="player-status-grid"><div class="player-stat"><strong>${accepted}</strong><span>zugesagt</span></div><div class="player-stat"><strong>${declined}</strong><span>abgesagt</span></div><div class="player-stat"><strong>${open}</strong><span>offen</span></div></div><div class="small" style="margin-top:9px">Beendete Spiele: ${played} teilgenommen · ${notPlayed} nicht eingesetzt</div>${released?`<div class="player-match-note">${released} freigeschaltete${released===1?'s':' Spiele'} als Ersatzspieler</div>`:''}</div>`;
  }
  Object.entries(groups).forEach(([team,arr])=>{
    const isReleasedGroup=team==='Freigeschaltete Spiele';
    const groupId='teamMatches_'+Object.keys(groups).indexOf(team);html+=`<div class="teamblock ${isReleasedGroup?'substitute-group':''}"><button class="team-toggle" type="button" aria-expanded="true" onclick="togglePanel('${groupId}',this)">${esc(team)} <span class="small">· ${arr.length} Begegnung${arr.length===1?'':'en'}</span><span class="toggle-mark">−</span></button><div id="${groupId}" class="collapsible-panel">`;
    arr.forEach(m=>{
      const myAv=currentUserAvailability(m);
      const manage=isAdmin()||canManage(m.managed_by_team_id||m.managed_by_team||m.home_team_id||m.home_team);
      const availabilityAllowed=manage || m.status!=='finished';
      const ownGame=isPlayer() && !m._releasedToMe;
      const statusText=manage?`<span class="badge">${managerSummary(m)}</span>`:(isPlayer()&&m.status==='finished'?participationLabel(myAv,m):m._releasedToMe?'<span class="badge">Ersatzspieler freigeschaltet</span>':availabilityLabel(myAv));
      const highlight=isPlayer()&&myAv?.status==='accepted'?' player-highlight':'';
      const note=(isPlayer()&&!hasManagerAccess())?(m.status==='finished'?(myParticipation(m)===true?' · Tatsächlich gespielt':myParticipation(m)===false?' · Nicht eingesetzt':' · Aufstellung nicht verfügbar'):(m._releasedToMe?' · Ersatzspieler':(myAv?.status==='accepted'?' · Du bist dabei':myAv?.status==='declined'?' · Du hast abgesagt':' · Deine Antwort offen'))):'';
      html+=`<div class="match${highlight}"><div class="matchdate">${fmtDate(m.match_date)}<br><span class="small">${esc(m.match_time||'')}</span></div><div class="matchmain"><strong>${esc(m.home_team)} – ${esc(m.away_team)}</strong><span>${m.venue?esc(m.venue)+' · ':''}${fmtStatus(m.status)} · ${statusText} · ${m.is_public?'🌐 Öffentlich · ':''}Saison ${esc(m.season||'–')}${note?`<br><span class="player-match-note">${esc(note.replace(/^ · /,''))}</span>`:''}</span></div><div class="actions">${manage?`<button class="secondary" onclick="editMatch('${m.id}')">Bearbeiten</button>`:''}${availabilityAllowed?`<button class="secondary" onclick="showAvailability('${m.id}')">${manage?'Spielerstatus':m._releasedToMe?'Ersatzspieler-Status':'Meine Zu-/Absage'}</button>`:`<button class="secondary" disabled>Beendet · keine Änderung</button>`}${m._report?.pdf_path?`<button class="secondary" onclick="downloadReport('${m.id}')">📄 Spielbericht</button>`:(m._report?.confirmed?`<button class="secondary" onclick="openReport('${m.id}')">📋 Spielbericht</button>`:'')}</div></div>`;
    });
    html+='</div></div>';
  });
  $('schedule').innerHTML=html||'<div class="status">Keine für dich relevanten Begegnungen gefunden.</div>';
  $('count').textContent=list.length+' Begegnung'+(list.length===1?'':'en');
}
function openEdit(m){
  editingId=m?.id||null;$('editTitle').textContent=m?'Begegnung bearbeiten':'Neue Begegnung';
  const selected=$('teamFilter').value;
  const selectedRecord=selected?teamRecordForName(selected):null;
  const selectedId=selectedRecord?String(selectedRecord.id):'';
  const selectedIsHome=!!m&&((selectedId&&String(m.home_team_id||'')===selectedId)||normalizeTeamLabel(m.home_team)===normalizeTeamLabel(selected));
  const selectedIsAway=!!m&&((selectedId&&String(m.away_team_id||'')===selectedId)||normalizeTeamLabel(m.away_team)===normalizeTeamLabel(selected));
  const own=selected&&(selectedIsHome||selectedIsAway)?selected:(m?.managed_by_team||m?.home_team||selected||'');
  const opponent=m?(selectedIsHome?m.away_team:m.home_team):'';
  $('matchType').value=m?(selectedIsHome?'home':'away'):'home';$('opponent').value=opponent;
  $('season').value=m?.season||$('seasonFilter').value||'';$('date').value=m?.match_date||'';$('time').value=m?.match_time||'';$('venue').value=m?.venue||'';$('isPublic').checked=!!m?.is_public;
  refreshVenueSelect();selectVenueFromText(m?.venue||'');$('deleteMatch').style.display=m?'inline-block':'none';$('editModal').style.display='flex';
}
window.editMatch=id=>{const m=matches.find(x=>x.id===id);if(m)openEdit(m)};
$('newBtn').onclick=()=>openEdit(null);$('closeEdit').onclick=()=>$('editModal').style.display='none';
$('venueSelect').onchange=()=>{const v=venueBook.find(x=>String(x.id)===$('venueSelect').value);if(v)$('venue').value=`${v.label} — ${v.address}`;};
$('saveMatch').onclick=async()=>{
  const selected=$('teamFilter').value;const old=editingId?matches.find(x=>x.id===editingId):null;
  const own=selected||old?.managed_by_team||old?.home_team||'';
  const ownTeam=teamRecordForName(own)||scheduleClubTeams.find(t=>String(t.id)===String(old?.managed_by_team_id));
  const opponent=$('opponent').value.trim();if(!own||!ownTeam||!opponent||own===opponent){alert('Bitte eine eindeutige Mannschaft im ausgewählten Verein und einen anderen Gegner eingeben.');return;}
  const type=$('matchType').value;const home=type==='home'?own:opponent,away=type==='home'?opponent:own;
  const payload={home_team:home,away_team:away,home_team_id:type==='home'?ownTeam.id:(old&&old.home_team===home?old.home_team_id:null),away_team_id:type==='away'?ownTeam.id:(old&&old.away_team===away?old.away_team_id:null),managed_by_team:own,managed_by_team_id:old?.managed_by_team_id||ownTeam.id,season:$('season').value.trim()||ownTeam.season||null,match_date:$('date').value||null,match_time:$('time').value||null,venue:$('venue').value.trim()||null};
  let savedMatchId=editingId;
  if(editingId){if(!(isAdmin()||canManage(payload.managed_by_team_id))){alert('Keine Berechtigung für die verwaltende Mannschaft.');return}const res=await sb.from('matches').update(payload).eq('id',editingId);if(res.error){alert(res.error.message);return}}
  else{if(!(isAdmin()||canManage(ownTeam.id))){alert('Du bist der ausgewählten Mannschaft nicht als Mannschaftsführer zugeordnet.');return}payload.status='planned';payload.created_by=user.id;const res=await sb.from('matches').insert(payload).select('id').single();if(res.error){alert(res.error.message);return}savedMatchId=res.data.id;}
  const wantsPublic=$('isPublic').checked,wasPublic=!!old?.is_public;
  if(wantsPublic!==wasPublic){const {error:publishError}=await sb.rpc('publish_match',{p_match_id:savedMatchId,p_is_public:wantsPublic});if(publishError){alert('Begegnung wurde gespeichert, aber die Veröffentlichung konnte nicht geändert werden: '+publishError.message);}}
  $('editModal').style.display='none';msg(editingId?'Begegnung gespeichert.':'Begegnung angelegt.','ok');await loadMatches();
};
function resetVenueForm(){editingVenueId=null;$('venueLabel').value='';$('venueAddress').value='';$('saveVenueBtn').textContent='＋ Austragungsort speichern';$('cancelVenueEditBtn').style.display='none';}
window.editVenue=id=>{if(!canManageVenueBook())return;const v=venueBook.find(x=>Number(x.id)===Number(id));if(!v)return;editingVenueId=v.id;$('venueLabel').value=v.label||'';$('venueAddress').value=v.address||'';$('saveVenueBtn').textContent='Änderungen speichern';$('cancelVenueEditBtn').style.display='inline-block';$('venueLabel').focus();};
$('cancelVenueEditBtn').onclick=resetVenueForm;
$('saveVenueBtn').onclick=async()=>{const label=$('venueLabel').value.trim(),address=$('venueAddress').value.trim();if(!label||!address){alert('Bitte Titel und Adresse ausfüllen.');return}if(!canManageVenueBook()){alert('Keine Berechtigung.');return}let query;if(editingVenueId!==null){query=sb.from('venue_book').update({label,address}).eq('id',editingVenueId);}else{query=sb.from('venue_book').insert({label,address,created_by:user.id});}const {error}=await query;if(error){alert('Austragungsort konnte nicht '+(editingVenueId!==null?'geändert':'gespeichert')+' werden: '+error.message);return}resetVenueForm();await loadVenueBook();};
window.deleteVenue=async id=>{if(!canManageVenueBook()||!confirm('Austragungsort wirklich aus dem Adressbuch löschen? Bereits angelegte Begegnungen bleiben unverändert.'))return;const {error}=await sb.from('venue_book').delete().eq('id',id);if(error)alert('Austragungsort konnte nicht gelöscht werden: '+error.message);else await loadVenueBook();};
$('deleteMatch').onclick=async()=>{if(!editingId)return;if(!confirm('Begegnung wirklich löschen?'))return;const m=matches.find(x=>x.id===editingId);if(!(isAdmin()||canManage(m.managed_by_team_id||m.managed_by_team||m.home_team_id||m.home_team))){alert('Keine Berechtigung.');return}const {error}=await sb.from('matches').delete().eq('id',editingId);if(error)alert(error.message);else{$('editModal').style.display='none';await loadMatches()}};
function teamNumber(team){const m=String(team||'').match(/(?:^|\s)(\d+)\s*$/);return m?Number(m[1]):null;}
async function loadAvailabilityData(id){
  const match=matches.find(m=>String(m.id)===String(id));if(!match)throw new Error('Begegnung nicht gefunden.');
  const baseIds=[match.home_team_id,match.away_team_id].filter(Boolean);
  const ownTeamId=match.managed_by_team_id||baseIds.find(x=>canManage(x));
  const ownTeam=scheduleClubTeams.find(t=>String(t.id)===String(ownTeamId));
  const extraIds=ownTeam?seasonScopedTeams().filter(t=>String(t.club_id)===String(ownTeam.club_id)&&teamNumber(t.name)>teamNumber(ownTeam.name)).map(t=>t.id):[];
  const teamIds=[...new Set([...baseIds,...extraIds])];
  let assignments=[],players=[];
  if(teamIds.length){
    const {data:as,error:ae}=await sb.from('club_team_players').select('team_id,player_id').in('team_id',teamIds);if(ae)throw ae;assignments=as||[];
    const pids=[...new Set(assignments.map(a=>a.player_id))];
    if(pids.length){const {data:ps,error:pe}=await sb.from('players').select('id,name,ranking_position,gender,active,user_id').in('id',pids).eq('active',true);if(pe)throw pe;const teamMap=new Map(scheduleClubTeams.map(t=>[String(t.id),t.name]));players=(ps||[]).map(p=>({...p,team_id:assignments.find(a=>Number(a.player_id)===Number(p.id))?.team_id,team:teamMap.get(String(assignments.find(a=>Number(a.player_id)===Number(p.id))?.team_id))||''}));}
  }
  const {data:avs,error:ae}=await sb.from('match_availability').select('*').eq('match_id',id);if(ae)throw ae;
  return {players,avs:avs||[]};
}
function playerDisplay(name,uid){return name || (uid===user?.id?(profile?.display_name||user?.email):'Spieler');}
function playerSort(a,b){
  const ga=String(a.gender||'').toUpperCase()==='H'?0:String(a.gender||'').toUpperCase()==='D'?1:2;
  const gb=String(b.gender||'').toUpperCase()==='H'?0:String(b.gender||'').toUpperCase()==='D'?1:2;
  if(ga!==gb)return ga-gb;
  const ar=Number.isFinite(Number(a.ranking_position))?Number(a.ranking_position):Number.POSITIVE_INFINITY;
  const br=Number.isFinite(Number(b.ranking_position))?Number(b.ranking_position):Number.POSITIVE_INFINITY;
  if(ar!==br)return ar-br;
  return String(a.name||'').localeCompare(String(b.name||''),'de',{sensitivity:'base'});
}
async function showAvailability(id){
  selectedMatch=matches.find(m=>m.id===id); if(!selectedMatch)return;
  try{
    const {players,avs}=await loadAvailabilityData(id);
    const teams=[{id:selectedMatch.home_team_id,name:selectedMatch.home_team},{id:selectedMatch.away_team_id,name:selectedMatch.away_team}];
    const manager=isAdmin()||canManage(selectedMatch.managed_by_team_id||selectedMatch.home_team_id||selectedMatch.away_team_id);
    const availabilityAllowed=manager || String(selectedMatch.status||'').toLowerCase()!=='finished';
    $('availabilityTitle').textContent=`Spieler-Zu-/Absagen · ${selectedMatch.home_team} – ${selectedMatch.away_team} · ${fmtDate(selectedMatch.match_date)}`;
    let html='';
    for(const t of teams){
      const ownTeam=!!t.id && (canManage(t.id)||isAdmin());
      const ps=players.filter(x=>String(x.team_id)===String(t.id) && (manager || !isPlayer() || currentPlayerIds.includes(Number(x.id)))).sort(playerSort);
      html+=`<div class="teamblock"><div class="teamtitle">${esc(t.name)} <span class="small">${ownTeam?'· eigene Mannschaft':'· gegnerische Mannschaft'}</span></div>`;
      if(!ps.length) html+='<div class="status">Keine Spieler in den Stammdaten gefunden.</div>';
      for(const p of ps){
        const a=avs.find(x=>x.player_id===p.id || (p.user_id && x.user_id===p.user_id));
        const editable=ownTeam || (isPlayer() && currentPlayerIds.includes(Number(p.id))) || p.user_id===user.id || isAdmin();
        const uid=p.user_id||'';
        html+=`<div class="playerrow"><div class="playername"><strong>${esc(p.name)}</strong><span>${p.ranking_position?`Rang ${esc(p.ranking_position)} · `:''}${esc(p.gender||'')}${a?.is_substitute?' · Ersatzspieler':''}</span></div><div>${participationLabel(a,selectedMatch,p)}</div><div>${editable&&availabilityAllowed?`<select onchange="setAvailability('${id}',${p.id},'${esc(p.team)}',this.value,${!!a?.is_substitute},'${uid}')"><option value="pending" ${(!a||a.status==='pending')?'selected':''}>Offen</option><option value="accepted" ${a?.status==='accepted'?'selected':''}>Zugesagt</option><option value="declined" ${a?.status==='declined'?'selected':''}>Abgesagt</option></select>`:(editable&&!availabilityAllowed?'<span class="badge">Beendet</span>':'')}</div></div>`;
      }
      if(ownTeam && availabilityAllowed){
        const n=teamNumber(t.name);
        const eligible=players.filter(p=>p.active && p.team_id!==t.id && n!==null && teamNumber(p.team)!==null && teamNumber(p.team)>n && !teams.some(x=>String(x.id)===String(p.team_id))).sort(playerSort);
        html+=`<div class="subbox"><strong>Ersatzspieler freischalten</strong><div class="small">Spieler aus Mannschaften mit höherer Mannschaftsnummer können für diese Begegnung freigeschaltet werden.</div>`;
        if(!eligible.length) html+='<div class="status">Keine passenden Ersatzspieler gefunden.</div>';
        for(const p of eligible){
          const a=avs.find(x=>x.player_id===p.id || (p.user_id && x.user_id===p.user_id));
          const released=!!a?.is_substitute;
          html+=`<div class="subrow"><div><strong>${esc(p.name)}</strong><div class="small">${esc(p.team)} · Rang ${esc(p.ranking_position||'–')} · ${released?'freigeschaltet':'nicht freigeschaltet'}</div></div><div><button class="${released?'danger':'primary'}" onclick="toggleSubstitute('${id}',${p.id},'${esc(p.team)}',${released},'${p.user_id||''}')">${released?'Sperren':'Freischalten'}</button></div></div>`;
        }
        html+='</div>';
      }
      html+='</div>';
    }
    if(!availabilityAllowed) html=`<div class="status warn">Diese Begegnung ist bereits beendet. Offene Spieler-Status werden anhand der Aufstellung automatisch als Teilnahme bzw. Nicht eingesetzt gewertet.</div>`+html;
    const mine=players.find(p=>p.user_id===user.id);
    const mineAv=mine?avs.find(x=>x.player_id===mine.id || x.user_id===user.id):avs.find(x=>x.user_id===user.id);
    if(!manager && !mine && !avs.some(x=>x.user_id===user.id)){html=`<div class="status">Du bist dieser Begegnung nicht als Spieler zugeordnet.</div>`+html;}
    $('availabilityContent').innerHTML=html;
    $('availabilityModal').style.display='flex';
  }catch(e){alert('Spielerstatus konnte nicht geladen werden: '+e.message)}
}
window.setAvailability=async(id,playerId,team,status,isSub=false,uid='')=>{
  const match=matches.find(m=>String(m.id)===String(id));
  const manager=isAdmin()||canManage(match?.managed_by_team_id||match?.home_team_id||match?.away_team_id);
  if(match?.status==='finished'){alert('Diese Begegnung ist bereits beendet. Offene Spieler-Status werden anhand der Aufstellung automatisch als Teilnahme bzw. Nicht eingesetzt gewertet.');return;}
  const {data:matchRow,error:me}=await sb.from('matches').select('status').eq('id',id).maybeSingle();
  if(me){alert('Begegnungsstatus konnte nicht geprüft werden: '+me.message);return;}
  if(matchRow?.status==='finished' && !manager){alert('Diese Begegnung ist bereits beendet. Der Spieler kann den Status nicht mehr ändern.');return;}
  const base={match_id:id,player_id:Number(playerId),user_id:(isPlayer() && currentPlayerIds.includes(Number(playerId)) ? user.id : (uid||null)),team,status,is_substitute:isSub,updated_at:new Date().toISOString()};
  const {data:existing}=await sb.from('match_availability').select('id').eq('match_id',id).eq('player_id',Number(playerId)).maybeSingle();
  let r=existing?.id?await sb.from('match_availability').update(base).eq('id',existing.id):await sb.from('match_availability').insert(base);
  if(r.error)alert(r.error.message);else{await loadMatches();await showAvailability(id)}
};
window.toggleSubstitute=async(id,playerId,team,released,uid='')=>{
  const match=matches.find(m=>String(m.id)===String(id));
  const manager=isAdmin()||canManage(match?.managed_by_team_id||match?.home_team_id||match?.away_team_id);
  if(match?.status==='finished'){alert('Diese Begegnung ist bereits beendet. Ersatzspieler können nicht mehr geändert werden.');return;}
  const {data:matchRow,error:me}=await sb.from('matches').select('status').eq('id',id).maybeSingle();
  if(me){alert('Begegnungsstatus konnte nicht geprüft werden: '+me.message);return;}
  if(matchRow?.status==='finished' && !manager){alert('Diese Begegnung ist bereits beendet.');return;}
  if(released){const r=await sb.from('match_availability').delete().eq('match_id',id).eq('player_id',Number(playerId));if(r.error){alert(r.error.message);return}}
  else{const r=await sb.from('match_availability').upsert({match_id:id,player_id:Number(playerId),user_id:uid||null,team,status:'pending',is_substitute:true,released_by:user.id,released_at:new Date().toISOString()},{onConflict:'match_id,player_id'});if(r.error){alert(r.error.message);return}}
  await loadMatches();await showAvailability(id)
};
window.openReport=id=>{location.href='spielbericht.html?match='+encodeURIComponent(id)};
window.downloadReport=async id=>{
  const m=matches.find(x=>x.id===id); if(!m?._report?.pdf_path)return;
  const {data,error}=await sb.storage.from('match-reports').createSignedUrl(m._report.pdf_path,300);
  if(error){alert('Spielbericht konnte nicht geöffnet werden: '+error.message);return;}
  const a=document.createElement('a');a.href=data.signedUrl;a.target='_blank';a.rel='noopener';a.click();
};
$('closeAvailability').onclick=()=>$('availabilityModal').style.display='none';
$('clubFilter').onchange=()=>{
  $('teamFilter').value='';
  if(isAdmin())applyAdminSearch();
  else {
    const cid=selectedClubId();
    const rows=seasonScopedTeams().filter(t=>!cid||String(t.club_id)===String(cid));
    $('teamFilter').innerHTML='<option value="">Alle Mannschaften</option>'+rows.map(t=>`<option value="${esc(t.name)}">${esc(t.name)}${t.season?' · '+esc(t.season):''}</option>`).join('');
  }
  applySavedScheduleSelection(false);saveSchedulePreference();updateTurnierPlaydataButton();loadMatches();
};
$('teamFilter').onchange=()=>{saveSchedulePreference();updateTurnierPlaydataButton();loadMatches();};
$('adminScheduleSearch').oninput=()=>{
  const oldClub=selectedClubId(),oldTeam=selectedTeamName();
  applyAdminSearch();
  if(oldClub!==selectedClubId()||oldTeam!==selectedTeamName()){updateTurnierPlaydataButton();loadMatches();}
};
$('seasonFilter').onchange=async()=>{
  if(isAdmin())applyAdminSearch();
  else {
    const cid=selectedClubId();
    const rows=seasonScopedTeams().filter(t=>!cid||String(t.club_id)===String(cid));
    $('teamFilter').innerHTML='<option value="">Alle Mannschaften</option>'+rows.map(t=>`<option value="${esc(t.name)}">${esc(t.name)}${t.season?' · '+t.season:''}</option>`).join('');
  }
  applySavedScheduleSelection();saveSchedulePreference();
  await loadMatches();
};
if($('scheduleLoginForm')) $('scheduleLoginForm').addEventListener('submit',async event=>{
  event.preventDefault();
  const button=$('scheduleLoginSubmit'),message=$('scheduleAuthMessage');
  button.disabled=true;message.hidden=true;
  const {error}=await sb.auth.signInWithPassword({email:$('scheduleEmail').value.trim(),password:$('schedulePassword').value});
  button.disabled=false;
  if(error){message.hidden=false;message.className='status bad';message.textContent='Anmeldung fehlgeschlagen: '+error.message;return;}
  $('authModal').style.display='none';$('schedulePassword').value='';await loadUser();
});
if($('closeAuthModal')) $('closeAuthModal').onclick=()=>$('authModal').style.display='none';
if($('profileBtn') && $('profileMenu')) $('profileBtn').addEventListener('click',event=>{
  event.preventDefault();
  event.stopPropagation();
  const menu=$('profileMenu');
  menu.hidden=!menu.hidden;
  $('profileBtn').setAttribute('aria-expanded',String(!menu.hidden));
});
if($('profileLogin')) $('profileLogin').onclick=()=>{
  $('profileMenu').hidden=true;$('profileBtn').setAttribute('aria-expanded','false');
  if($('scheduleAuthMessage')) $('scheduleAuthMessage').hidden=true;
  $('authModal').style.display='flex';
};
if($('profileLogout')) $('profileLogout').onclick=async()=>{
  $('profileMenu').hidden=true;$('profileBtn').setAttribute('aria-expanded','false');
  await sb.auth.signOut();user=null;profile=null;memberships=[];managedClubIds=[];currentPlayerIds=[];currentPlayerTeams=[];currentPlayerTeamIds=[];linkedPlayers=[];playerAccounts=[];adminTeams=[];scheduleClubTeams=[];showLoggedOut();
};
document.addEventListener('click',event=>{
  const wrap=document.querySelector('#platformNav .pn-profile-wrap');
  const menu=$('profileMenu'),button=$('profileBtn');
  if(wrap&&menu&&button&&!wrap.contains(event.target)&&!menu.hidden){
    menu.hidden=true;button.setAttribute('aria-expanded','false');
  }
});

// ICS Import – mobile Vorschau mit Auswahl und Dublettenprüfung.
$('icsFile').onchange=e=>{const f=e.target.files?.[0];if(f)readIcs(f);e.target.value=''};
$('icsPickerButton').addEventListener('click',async e=>{
  e.preventDefault();
  if(typeof window.showOpenFilePicker==='function'){
    try{
      const handles=await window.showOpenFilePicker({
        multiple:false,
        startIn:'downloads',
        types:[{description:'iCalendar-Datei',accept:{'text/calendar':['.ics'],'application/ics':['.ics']}}]
      });
      if(handles?.[0]){
        const file=await handles[0].getFile();
        await readIcs(file);
      }
      return;
    }catch(error){
      if(error?.name==='AbortError')return;
      console.warn('Erweiterte Dateiauswahl nicht verfügbar; verwende Standardauswahl.',error);
    }
  }
  $('icsFile').click();
});
function unfoldIcs(s){return s.replace(/\r?\n[ \t]/g,'')}
function parseIcsDate(v){
  const m=String(v||'').match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/);
  if(!m)return null;
  return {date:`${m[1]}-${m[2]}-${m[3]}`,time:m[4]?`${m[4]}:${m[5]}`:'',utc:!!m[7]};
}
function parseIcs(text){
  const lines=unfoldIcs(text).split(/\r?\n/),ev=[];let cur=null;
  for(const line of lines){
    if(line==='BEGIN:VEVENT'){cur={};continue}
    if(line==='END:VEVENT'){if(cur)ev.push(cur);cur=null;continue}
    if(!cur)continue;
    const i=line.indexOf(':');if(i<0)continue;
    const key=line.slice(0,i).split(';')[0].toUpperCase(),v=line.slice(i+1);
    cur[key]=v;
  }
  return ev.map((x,i)=>{
    const st=parseIcsDate(x.DTSTART||''),en=parseIcsDate(x.DTEND||'');
    let home='',away='';const summary=x.SUMMARY||'';
    if(/\bAuswärts\b/i.test(summary)){home=summary.replace(/.*Auswärts\s*/i,'').trim();}
    else if(/\bHeimspiel\b/i.test(summary)){away=summary.replace(/.*Heimspiel\s*/i,'').trim();}
    else away=summary;
    return {uid:x.UID||`ics-${Date.now()}-${i}`,date:st?.date||'',time:st?.time||'',end:en?.time||'',summary,home,away,venue:x.LOCATION||'',description:x.DESCRIPTION||'',selected:true};
  });
}
function normalizeIcsText(value){return String(value||'').trim().replace(/\s+/g,' ').toLocaleLowerCase('de-DE')}
function icsTeamRecord(){return scheduleClubTeams.find(t=>String(t.id)===String($('icsTeam').value))||null}
function isExistingIcsEvent(event,team){
  const uid=String(event.uid||'').trim();
  const home=normalizeIcsText(event.home),away=normalizeIcsText(event.away);
  return matches.some(m=>{
    if(uid&&m.ics_uid&&String(m.ics_uid)===uid)return true;
    return String(m.match_date||'')===String(event.date||'') &&
      normalizeIcsText(m.home_team)===home &&
      normalizeIcsText(m.away_team)===away &&
      (!event.time||!m.match_time||String(m.match_time).slice(0,5)===String(event.time).slice(0,5));
  });
}
function updateIcsSelectionSummary(){
  const team=icsTeamRecord()?.name||'';
  const duplicates=icsEvents.filter(e=>isExistingIcsEvent(e,team)).length;
  const invalid=icsEvents.filter(e=>!e.date||!e.home||!e.away||normalizeIcsText(e.home)===normalizeIcsText(e.away)||(!normalizeIcsText(e.home).includes(normalizeIcsText(team))&&!normalizeIcsText(e.away).includes(normalizeIcsText(team)))).length;
  const selected=icsEvents.filter(e=>e.selected&&!isExistingIcsEvent(e,team)).length;
  $('icsImportSummary').innerHTML=`<strong>${icsEvents.length} Begegnungen erkannt</strong><div class="ics-summary-counts"><span><b>${selected}</b> ausgewählt</span><span><b>${duplicates}</b> bereits vorhanden</span><span><b>${invalid}</b> zu prüfen</span></div>`;
  $('importIcs').textContent=`${selected} Begegnungen importieren`;
  $('importIcs').disabled=selected===0;
  const selectAll=$('icsSelectAll');
  if(selectAll){
    const eligible=icsEvents.filter(e=>!isExistingIcsEvent(e,team)&&!(!e.date||!e.home||!e.away||normalizeIcsText(e.home)===normalizeIcsText(e.away)||(!normalizeIcsText(e.home).includes(normalizeIcsText(team))&&!normalizeIcsText(e.away).includes(normalizeIcsText(team)))));
    selectAll.checked=eligible.length>0&&eligible.every(e=>e.selected);
    selectAll.indeterminate=eligible.some(e=>e.selected)&&!selectAll.checked;
    selectAll.disabled=eligible.length===0;
  }
}
function renderIcsTeamPicker(){
  const select=$('icsTeam'),picker=$('icsTeamPicker'),label=$('icsTeamPickerLabel'),menu=$('icsTeamPickerMenu');
  if(!select||!picker||!label||!menu)return;
  const current=select.options[select.selectedIndex];
  label.textContent=current?.textContent||'Mannschaft auswählen';
  menu.innerHTML=[...select.options].map(option=>`<button type="button" class="ics-team-option ${option.selected?'is-current':''}" data-team-id="${esc(option.value)}"><span>${esc(option.textContent)}</span>${option.selected?'<span class="ics-team-check">✓</span>':''}</button>`).join('');
  menu.querySelectorAll('[data-team-id]').forEach(button=>button.addEventListener('click',()=>{
    select.value=button.dataset.teamId;
    picker.open=false;
    renderIcsTeamPicker();
    renderIcsRows();
  }));
}
function openIcsPreview(events){
  icsEvents=events;
  const teamSelect=$('icsTeam'),teams=seasonScopedTeams();
  teamSelect.innerHTML=teams.map(t=>`<option value="${esc(t.id)}">${esc(t.name)}${t.season?' · '+esc(t.season):''}</option>`).join('');
  const selected=teams.find(t=>t.name===selectedTeamName())||teams[0];
  if(selected)teamSelect.value=String(selected.id);
  renderIcsTeamPicker();
  $('icsSeason').value=$('seasonFilter').value||selected?.season||'';
  renderIcsRows();
  $('icsModal').style.display='flex';
}
function renderIcsRows(){
  const openEditors=[...$('icsRows').querySelectorAll('.ics-edit-details')].map((node,i)=>node.open?i:-1).filter(i=>i>=0);
  const team=icsTeamRecord()?.name||'';
  icsEvents.forEach(e=>{
    if(/\bAuswärts\b/i.test(e.summary)){e.home=e.home||e.summary.replace(/.*Auswärts\s*/i,'').trim();e.away=team}
    else if(/\bHeimspiel\b/i.test(e.summary)){e.home=team;e.away=e.away||e.summary.replace(/.*Heimspiel\s*/i,'').trim()}
  });
  $('icsRows').innerHTML=icsEvents.map((e,i)=>{
    const duplicate=isExistingIcsEvent(e,team);
    const invalid=!e.date||!e.home||!e.away||normalizeIcsText(e.home)===normalizeIcsText(e.away)||(!normalizeIcsText(e.home).includes(normalizeIcsText(team))&&!normalizeIcsText(e.away).includes(normalizeIcsText(team)));
    if(duplicate)e.selected=false;
    const dateLabel=e.date?new Date(e.date+'T12:00:00').toLocaleDateString('de-DE',{weekday:'short',day:'2-digit',month:'2-digit',year:'numeric'}):'Datum fehlt';
    const timeLabel=e.time?e.time+' Uhr':'Uhrzeit offen';
    const status=duplicate?'Bereits vorhanden':invalid?'Bitte prüfen':e.selected?'Ausgewählt':'Nicht ausgewählt';
    return `<article class="ics-match-card ics-compact-card ${duplicate?'is-duplicate':''} ${invalid?'needs-review':''}">
      <div class="ics-compact-top">
        <label class="ics-select"><input type="checkbox" data-i="${i}" data-k="selected" ${e.selected&&!duplicate?'checked':''} ${duplicate||invalid?'disabled':''} aria-label="Begegnung auswählen"></label>
        <div class="ics-match-main">
          <div class="ics-match-date">${esc(dateLabel)} <span>· ${esc(timeLabel)}</span></div>
          <div class="ics-match-teams"><strong>${esc(e.home||'Heimteam fehlt')}</strong><span class="ics-vs">–</span><strong>${esc(e.away||'Gastteam fehlt')}</strong></div>
          <div class="ics-match-venue">${esc(e.venue||'Austragungsort nicht angegeben')}</div>
        </div>
        <span class="ics-state ${duplicate?'duplicate':invalid?'review':e.selected?'selected':'unselected'}">${status}</span>
      </div>
      <details class="ics-edit-details">
        <summary>Begegnung bearbeiten</summary>
        <div class="ics-edit-grid">
          <label>Datum<input data-i="${i}" data-k="date" value="${esc(e.date)}" type="date"></label>
          <label>Beginn<input data-i="${i}" data-k="time" value="${esc(e.time)}" type="time"></label>
          <label>Ende<input data-i="${i}" data-k="end" value="${esc(e.end)}" type="time"></label>
          <label>Heim<input data-i="${i}" data-k="home" value="${esc(e.home)}"></label>
          <label>Gast<input data-i="${i}" data-k="away" value="${esc(e.away)}"></label>
          <label class="ics-edit-wide">Austragungsort<input data-i="${i}" data-k="venue" value="${esc(e.venue)}"></label>
        </div>
        ${duplicate?'<p class="ics-card-note">Diese Begegnung ist bereits im Spielplan.</p>':invalid?'<p class="ics-card-note">Bitte Datum, Heim-/Gastmannschaft und die Zuordnung zur ausgewählten Mannschaft prüfen.</p>':''}
      </details>
      <button type="button" class="ics-remove" data-remove="${i}">Begegnung entfernen</button>
      <input data-i="${i}" data-k="uid" value="${esc(e.uid)}" type="hidden">
    </article>`;
  }).join('');
  $('icsRows').querySelectorAll('.ics-edit-details').forEach((node,i)=>{if(openEditors.includes(i))node.open=true});
  $('icsRows').querySelectorAll('input[data-i]').forEach(input=>{
    input.addEventListener('change',()=>{
      const event=icsEvents[Number(input.dataset.i)],key=input.dataset.k;
      event[key]=key==='selected'?input.checked:input.value;
      if(key!=='selected')renderIcsRows();else updateIcsSelectionSummary();
    });
  });
  $('icsRows').querySelectorAll('[data-remove]').forEach(button=>button.addEventListener('click',()=>{
    icsEvents.splice(Number(button.dataset.remove),1);renderIcsRows();
  }));
  updateIcsSelectionSummary();
}
window.removeIcs=i=>{icsEvents.splice(i,1);renderIcsRows()};
$('icsTeam').onchange=()=>{renderIcsTeamPicker();renderIcsRows()};
$('icsSelectAll').onchange=()=>{
  const team=icsTeamRecord()?.name||'';
  icsEvents.forEach(e=>{
    const duplicate=isExistingIcsEvent(e,team);
    const invalid=!e.date||!e.home||!e.away||normalizeIcsText(e.home)===normalizeIcsText(e.away)||(!normalizeIcsText(e.home).includes(normalizeIcsText(team))&&!normalizeIcsText(e.away).includes(normalizeIcsText(team)));
    if(!duplicate&&!invalid)e.selected=$('icsSelectAll').checked;
  });
  renderIcsRows();
};
$('closeIcs').onclick=$('cancelIcs').onclick=()=>{$('icsModal').style.display='none'};
async function readIcs(file){
  try{
    let text='';
    if(typeof file.text==='function')text=await file.text();
    else text=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result||'');r.onerror=()=>reject(r.error||new Error('Datei konnte nicht gelesen werden'));r.readAsText(file)});
    const events=parseIcs(String(text));
    if(!events.length){msg('In dieser Datei wurden keine Begegnungen gefunden. Bitte eine gültige ICS-Datei auswählen.','bad');return}
    openIcsPreview(events);
  }catch(e){console.error(e);msg('ICS-Datei konnte nicht gelesen werden: '+(e?.message||e),'bad')}
}
$('importIcs').onclick=async()=>{
  const teamRec=icsTeamRecord(),team=teamRec?.name||'',season=$('icsSeason').value.trim()||null;
  if(!team||!teamRec){msg('Bitte zuerst eine Mannschaft auswählen.','bad');return}
  const selected=icsEvents.filter(e=>e.selected&&!isExistingIcsEvent(e,team));
  if(!selected.length){msg('Keine neuen Begegnungen zum Import ausgewählt.','warn');return}
  let ok=0,skipped=0,errors=[];
  $('importIcs').disabled=true;
  for(const e of selected){
    const home=String(e.home||'').trim(),away=String(e.away||'').trim();
    const isHome=normalizeIcsText(home)===normalizeIcsText(team),isAway=normalizeIcsText(away)===normalizeIcsText(team);
    if(!e.date||!home||!away||normalizeIcsText(home)===normalizeIcsText(away)||(!isHome&&!isAway)){skipped++;continue}
    const p={home_team:home,away_team:away,home_team_id:isHome?teamRec.id:null,away_team_id:isAway?teamRec.id:null,managed_by_team:team,managed_by_team_id:teamRec.id,match_date:e.date,match_time:e.time||null,venue:String(e.venue||'').trim()||null,season,ics_uid:String(e.uid||'').trim()||null,status:'planned',created_by:user.id};
    const {error}=await sb.from('matches').upsert(p,{onConflict:'ics_uid'});
    if(error)errors.push((p.match_date||'?')+' '+p.home_team+' – '+p.away_team+': '+error.message);else ok++;
  }
  $('icsModal').style.display='none';
  if(errors.length){console.error('ICS-Import-Fehler',errors);msg('ICS: '+ok+' importiert, '+errors.length+' Fehler. '+errors[0],'bad')}
  else msg(ok+' neue Begegnung'+(ok===1?'':'en')+' aus ICS importiert.'+(skipped?' '+skipped+' übersprungen.':''),'ok');
  await loadMatches();
};
// ICS Export für den aktuell gewählten Mannschaftsfilter.
$('exportBtn').onclick=()=>{const team=$('teamFilter').value;const list=matches.filter(m=>!team||m.home_team===team||m.away_team===team||m.managed_by_team===team||m._releasedToMe);if(!list.length){alert('Keine Begegnungen zum Exportieren.');return}const stamp=new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');let out=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Badminton Mannschaftsplan//DE','CALSCALE:GREGORIAN'];for(const m of list){const uid=m.ics_uid||('match-'+m.id+'@badminton');const start=(m.match_date||'').replaceAll('-','')+'T'+(m.match_time||'18:00').replace(':','')+'00';let end=start;if(m.match_time){const [h,min]=m.match_time.split(':').map(Number);const d=new Date(2000,0,1,h,min);d.setHours(d.getHours()+2);end=(m.match_date||'').replaceAll('-','')+'T'+String(d.getHours()).padStart(2,'0')+String(d.getMinutes()).padStart(2,'0')+'00'}out.push('BEGIN:VEVENT','UID:'+uid,'DTSTAMP:'+stamp,'DTSTART:'+start,'DTEND:'+end,'SUMMARY:'+escapeIcs('Badminton – '+m.home_team+' – '+m.away_team));if(m.venue)out.push('LOCATION:'+escapeIcs(m.venue));out.push('END:VEVENT')}out.push('END:VCALENDAR');const blob=new Blob([out.join('\r\n')+'\r\n'],{type:'text/calendar;charset=utf-8'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='spielplan.ics';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)};
function escapeIcs(s){return String(s||'').replace(/\\/g,'\\\\').replace(/;/g,'\\;').replace(/,/g,'\\,').replace(/\r?\n/g,'\\n')}

sb.auth.onAuthStateChange((_event,session)=>{user=session?.user||null;if(user)loadUser();else showLoggedOut()});
// DBV Turnier Playdata: Vorschau und manueller Import ohne Ergebnisdaten.
let turnierPlaydataMatches=[];
let turnierPlaydataBusy=false;
function selectedTurnierPlaydataTeam(){
  const clubId=$('clubFilter')?.value||'';
  const teamName=$('teamFilter')?.value||'';
  if(!clubId||!teamName)return null;
  const team=teamRecordForName(teamName);
  if(!team||String(team.club_id)!==String(clubId)||!canManage(team.id))return null;
  return team;
}
function updateTurnierPlaydataButton(){
  const launch=$('turnierPlaydataOpen');
  if(launch)launch.disabled=!selectedTurnierPlaydataTeam();
}
function turnierPlaydataStatus(message,kind=''){
  const el=$('turnierPlaydataStatus');el.hidden=false;el.className='status '+kind;el.textContent=message;
}
function turnierPlaydataNormalizeTeamName(value){
  return String(value||'').normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toLocaleLowerCase('de')
    .replace(/[^a-z0-9]/g,'');
}
function turnierPlaydataIsOwnTeam(value,team){
  return turnierPlaydataNormalizeTeamName(value)===turnierPlaydataNormalizeTeamName(team?.name);
}
function turnierPlaydataDateTime(value){
  const m=String(value||'').match(/(\d{1,2})\.(\d{1,2})\.(\d{4})\s+(\d{1,2}):(\d{2})/);
  if(!m)return null;
  return {date:`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`,time:`${m[4].padStart(2,'0')}:${m[5]}`};
}
function turnierPlaydataDuplicate(item){
  const dt=turnierPlaydataDateTime(item.dateTime);
  if(!dt)return true;
  return matches.some(m=>m.match_date===dt.date&&String(m.match_time||'').slice(0,5)===dt.time&&m.home_team===item.homeTeam&&m.away_team===item.awayTeam);
}
function renderTurnierPlaydataRows(){
  const rows=$('turnierPlaydataRows');
  rows.innerHTML=turnierPlaydataMatches.map((m,i)=>{
    const dt=turnierPlaydataDateTime(m.dateTime),duplicate=turnierPlaydataDuplicate(m),valid=!!dt&&!!m.homeTeam&&!!m.awayTeam;
    return `<label class="turnier-playdata-row ${duplicate?'is-duplicate':''}"><input type="checkbox" class="turnier-playdata-check" data-index="${i}" ${valid&&!duplicate?'checked':''} ${!valid||duplicate?'disabled':''}><span><strong>${esc(dt?fmtDate(dt.date)+' · '+dt.time:m.dateTime||'Termin unbekannt')}</strong><span>${esc(m.homeTeam)} – ${esc(m.awayTeam)}</span><small>${esc([m.league,m.matchday,m.venue].filter(Boolean).join(' · '))}</small>${duplicate?'<em>Bereits vorhanden – wird übersprungen</em>':!valid?'<em>Unvollständiger Termin – nicht importierbar</em>':''}</span></label>`;
  }).join('');
  const fresh=turnierPlaydataMatches.filter(m=>!turnierPlaydataDuplicate(m)&&turnierPlaydataDateTime(m.dateTime));
  $('turnierPlaydataCount').textContent=`${fresh.length} neue von ${turnierPlaydataMatches.length} Begegnungen`;
  $('turnierPlaydataResults').hidden=false;
}
function updateTurnierPlaydataViewport(){
  const modal=$('turnierPlaydataModal');if(!modal)return;
  const height=window.visualViewport?.height||window.innerHeight;
  modal.style.setProperty('--turnier-vh',`${height/100}px`);
}
function scrollTurnierPlaydataInputIntoView(){
  const input=$('turnierPlaydataUrl');
  requestAnimationFrame(()=>requestAnimationFrame(()=>input?.scrollIntoView({block:'center',behavior:'smooth'})));
}
window.visualViewport?.addEventListener('resize',updateTurnierPlaydataViewport);
window.addEventListener('resize',updateTurnierPlaydataViewport);
$('turnierPlaydataUrl').addEventListener('focus',scrollTurnierPlaydataInputIntoView);
$('turnierPlaydataOpen').addEventListener('click',()=>{
  if(!selectedTurnierPlaydataTeam())return;$('turnierPlaydataStatus').hidden=true;$('turnierPlaydataResults').hidden=true;$('turnierPlaydataUrl').value='';turnierPlaydataMatches=[];
  updateTurnierPlaydataViewport();$('turnierPlaydataModal').style.display='flex';
});
$('turnierPlaydataClose').addEventListener('click',()=>{$('turnierPlaydataModal').style.display='none';});
$('turnierPlaydataSelectAll').addEventListener('change',()=>{
  $('turnierPlaydataRows').querySelectorAll('.turnier-playdata-check:not(:disabled)').forEach(c=>c.checked=$('turnierPlaydataSelectAll').checked);
});
$('turnierPlaydataPreview').addEventListener('click',async()=>{
  if(turnierPlaydataBusy)return;
  const team=selectedTurnierPlaydataTeam(),url=$('turnierPlaydataUrl').value.trim();
  if(!team){turnierPlaydataStatus('Bitte zuerst eine Mannschaft auswählen.','bad');return;}
  if(!url){turnierPlaydataStatus('Bitte den DBV-Turnier-Link einfügen.','bad');return;}
  if(!/^https:\/\/(?:[^/]+\.)?turnier\.de\//i.test(url)){turnierPlaydataStatus('Bitte einen gültigen HTTPS-Link von turnier.de verwenden.','bad');return;}
  turnierPlaydataBusy=true;$('turnierPlaydataPreview').disabled=true;$('turnierPlaydataResults').hidden=true;
  turnierPlaydataStatus('DBV-Spielplan wird geladen …');
  try{
    const {data:{session},error:sessionError}=await sb.auth.getSession();if(sessionError||!session?.access_token)throw new Error('Deine Anmeldung ist abgelaufen. Bitte erneut anmelden.');
    const {data,error}=await sb.functions.invoke('turnier-playdata',{body:{url,clubId:team.club_id}});
    if(error){
      let detail='';
      try{if(error.context instanceof Response){const body=await error.context.clone().json();detail=body?.error||body?.message||'';}}catch{}
      throw new Error(detail||error.message||'Die Turnier-Vorschau konnte nicht geladen werden.');
    }
    if(!data?.success)throw new Error(data?.error||'Turnier konnte keine Spielplandaten liefern.');
    turnierPlaydataMatches=Array.isArray(data.matches)?data.matches:[];
    if(!turnierPlaydataMatches.length){turnierPlaydataStatus('Die Seite wurde geladen, aber es wurden keine Begegnungen erkannt. Bitte prüfe, ob der Link auf die Mannschafts-Spielplanseite zeigt.','warn');return;}
    renderTurnierPlaydataRows();
    turnierPlaydataStatus(`${turnierPlaydataMatches.length} Begegnungen gefunden. Ergebnisse werden nicht importiert. Bitte Auswahl prüfen.`,'ok');
  }catch(e){turnierPlaydataStatus('Importvorschau fehlgeschlagen: '+(e.message||String(e)),'bad');}
  finally{turnierPlaydataBusy=false;$('turnierPlaydataPreview').disabled=false;}
});
function turnierPlaydataConfirm(count){
  return new Promise(resolve=>{
    const modal=$('turnierPlaydataConfirmModal');
    const text=$('turnierPlaydataConfirmText');
    const yes=$('turnierPlaydataConfirmYes');
    const no=$('turnierPlaydataConfirmNo');
    if(!modal||!yes||!no){resolve(false);return;}
    text.textContent=`Möchtest du die ${count} ausgewählten Begegnungen wirklich importieren?`;
    modal.hidden=false; modal.setAttribute('aria-hidden','false');
    const finish=value=>{modal.hidden=true;modal.setAttribute('aria-hidden','true');yes.removeEventListener('click',onYes);no.removeEventListener('click',onNo);modal.removeEventListener('click',onBackdrop);document.removeEventListener('keydown',onKey);resolve(value);};
    const onYes=()=>finish(true),onNo=()=>finish(false),onBackdrop=e=>{if(e.target===modal)finish(false);},onKey=e=>{if(e.key==='Escape')finish(false);};
    yes.addEventListener('click',onYes);no.addEventListener('click',onNo);modal.addEventListener('click',onBackdrop);document.addEventListener('keydown',onKey);
    yes.focus();
  });
}

$('turnierPlaydataImport').addEventListener('click',async()=>{
  const team=selectedTurnierPlaydataTeam();
  if(!team){turnierPlaydataStatus('Keine Berechtigung für diese Mannschaft.','bad');return;}
  const selected=[...$('turnierPlaydataRows').querySelectorAll('.turnier-playdata-check:checked')].map(c=>turnierPlaydataMatches[Number(c.dataset.index)]).filter(Boolean);
  if(!selected.length){turnierPlaydataStatus('Bitte mindestens eine neue Begegnung auswählen.','warn');return;}
  const payloads=selected.map(m=>{
    const dt=turnierPlaydataDateTime(m.dateTime);if(!dt)return null;
    const ownIsHome=turnierPlaydataIsOwnTeam(m.homeTeam,team),ownIsAway=turnierPlaydataIsOwnTeam(m.awayTeam,team);
    if(!ownIsHome&&!ownIsAway)return null;
    return {home_team:m.homeTeam,away_team:m.awayTeam,home_team_id:ownIsHome?team.id:null,away_team_id:ownIsAway?team.id:null,managed_by_team:team.name,managed_by_team_id:team.id,season:team.season||$('seasonFilter').value.trim()||null,match_date:dt.date,match_time:dt.time,venue:m.venue||null,status:'planned',created_by:user.id};
  }).filter(Boolean);
  if(payloads.length!==selected.length){turnierPlaydataStatus('Einige ausgewählte Begegnungen passen nicht eindeutig zur gewählten Mannschaft oder haben kein gültiges Datum. Bitte Auswahl prüfen.','bad');return;}
  // Zweite Duplikatprüfung unmittelbar vor dem Schreiben.
  const unique=payloads.filter(p=>!matches.some(m=>m.match_date===p.match_date&&String(m.match_time||'').slice(0,5)===p.match_time&&m.home_team===p.home_team&&m.away_team===p.away_team));
  if(!unique.length){turnierPlaydataStatus('Alle ausgewählten Begegnungen sind bereits vorhanden. Es wurde nichts gespeichert.','warn');return;}
  if(!await turnierPlaydataConfirm(unique.length))return;
  $('turnierPlaydataImport').disabled=true;
  try{
    const {error}=await sb.from('matches').insert(unique);
    if(error)throw error;
    $('turnierPlaydataResults').hidden=true;
    turnierPlaydataStatus(`${unique.length} Begegnung(en) erfolgreich importiert.`,'ok');
    await loadMatches();
  }catch(e){turnierPlaydataStatus('Speichern fehlgeschlagen: '+(e.message||String(e)),'bad');}
  finally{$('turnierPlaydataImport').disabled=false;}
});

loadUser();

(function(){
  const key='badminton-theme';
  function systemTheme(){return window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}
  let saved=null;try{saved=localStorage.getItem(key)}catch(e){}
  document.documentElement.dataset.theme=saved==='dark'||saved==='light'?saved:systemTheme();
  if(window.matchMedia){
    const mq=window.matchMedia('(prefers-color-scheme: dark)');
    const changed=()=>{let v=null;try{v=localStorage.getItem(key)}catch(e){}if(v!=='dark'&&v!=='light')document.documentElement.dataset.theme=systemTheme()};
    if(mq.addEventListener)mq.addEventListener('change',changed);else if(mq.addListener)mq.addListener(changed);
  }
})();

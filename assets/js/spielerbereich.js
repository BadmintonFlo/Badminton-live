(() => {
"use strict";
const URL="https://apsarswjmsrmffoyxsgr.supabase.co";
const KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFwc2Fyc3dqbXNybWZmb3l4c2dyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA1MjAwMzgsImV4cCI6MjEwNjA5NjAzOH0.YaT2RG0BiZbrWFj6RWIvmu88ttBmnV64FhwqNOKZn7o";
const sb=window.supabase?.createClient(URL,KEY);const $=id=>document.getElementById(id);let user=null,playerIds=[],players=[],teams=[],matches=[],availability=[],games=[];
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
const dateLabel=(d,t)=>{if(!d)return "Termin offen";const x=new Date(`${d}T${t||"12:00"}`);return new Intl.DateTimeFormat('de-DE',{weekday:'short',day:'2-digit',month:'2-digit',year:'numeric',hour:t?'2-digit':undefined,minute:t?'2-digit':undefined}).format(x)+(t?' Uhr':'')};
function message(text,error=false){const el=$('pageMessage');el.textContent=text;el.hidden=false;el.classList.toggle('error',error)}
function hideMessage(){$('pageMessage').hidden=true}
function outcomeForGame(g){const sets=[];for(let i=1;i<=3;i++){const h=g[`set${i}_home`],a=g[`set${i}_away`];if(Number.isFinite(Number(h))&&Number.isFinite(Number(a))&&h!==null&&a!==null&&Number(h)!==Number(a))sets.push([Number(h),Number(a)])}let h=0,a=0;sets.forEach(([x,y])=>x>y?h++:a++);return h>a?'home':a>h?'away':null}
function renderPublicClubs(clubs){$('clubFinder').innerHTML=clubs.length?clubs.slice(0,6).map(c=>`<article class="club-card"><strong>${esc(c.name)}</strong><small>${esc(c.city||'')}</small></article>`).join(''):'<p class="empty-state">Aktuell sind keine öffentlich gelisteten Vereine verfügbar.</p>'}
async function loadPublic(){const {data,error}=await sb.from('clubs').select('id,name,city').eq('is_published',true).is('archived_at',null).order('name').limit(6);if(error){$('clubFinder').innerHTML='<p class="empty-state">Vereine konnten gerade nicht geladen werden.</p>';return}renderPublicClubs(data||[])}
async function start(){if(!sb){message('Die Verbindung zu BadminOne ist gerade nicht verfügbar.',true);return}await loadPublic();const {data:{session}}=await sb.auth.getSession();user=session?.user||null;if(!user){$('playerGreeting').textContent='Willkommen im Spielerprofil';$('playerIntro').textContent='Entdecke Vereine oder melde dich über das Profilsymbol an.';$('unlinkedPanel').hidden=false;return}await loadLinkedDashboard();}
async function loadLinkedDashboard(){hideMessage();$('playerGreeting').textContent='Dein Spielerprofil';$('playerIntro').textContent='Deine Spielerdaten, Vereinszuordnungen, Begegnungen und Trainingszeiten.';
 const {data:accounts,error:ae}=await sb.from('player_accounts').select('player_id,is_primary,active').eq('user_id',user.id).eq('active',true);if(ae){message('Spielerzuordnung konnte nicht geprüft werden: '+ae.message,true);$('unlinkedPanel').hidden=false;return}
 playerIds=[...new Set((accounts||[]).map(a=>Number(a.player_id)).filter(Number.isFinite))];
 if(!playerIds.length){$('unlinkedPanel').hidden=false;$('linkedDashboard').hidden=true;return}
 const {data:ps,error:pe}=await sb.from('players').select('id,name,team,club_id,active').in('id',playerIds).eq('active',true);if(pe){message('Spielerprofil konnte nicht geladen werden: '+pe.message,true);return}players=ps||[];
 if(players.length>1)$('playerGreeting').textContent='Deine Spielerprofile';
 if(!players.length){$('unlinkedPanel').hidden=false;return}
 $('unlinkedPanel').hidden=true;$('linkedDashboard').hidden=false;
 const clubIds=[...new Set(players.map(p=>p.club_id).filter(Boolean))];
 const [ct,cl]=await Promise.all([sb.from('club_team_players').select('team_id,club_id,player_id,assignment_role').in('player_id',playerIds),sb.from('clubs').select('id,name,city').in('id',clubIds)]);
 if(ct.error)message('Teamzuordnungen konnten nicht vollständig geladen werden: '+ct.error.message,true);
 const assignments=ct.data||[];const clubMap=new Map((cl.data||[]).map(c=>[c.id,c]));teams=[...new Set(assignments.map(a=>a.team_id).filter(Boolean))];
 const teamLabels=players.map(p=>{const c=clubMap.get(p.club_id);return {club:c?.name||'Verein',team:p.team||'Team nicht hinterlegt',name:p.name}});
 $('memberships').innerHTML=teamLabels.length?teamLabels.map(x=>`<div class="list-card"><div class="list-main"><strong>${esc(x.club)}</strong><span class="list-meta">${esc(x.team)} · ${esc(x.name)}</span></div></div>`).join(''):'<p class="empty-state">Noch keine Teamzuordnung hinterlegt.</p>';
 await loadMatches(assignments,clubMap);
 await loadTraining(clubIds);
}
async function loadMatches(assignments,clubMap){
 const {data:all,error:me}=await sb.from('matches').select('id,home_team,away_team,match_date,match_time,status,season,venue,home_team_id,away_team_id,managed_by_team_id').gte('match_date',today()).order('match_date').limit(100);
 if(me){message('Spielplan konnte nicht geladen werden: '+me.message,true);return}
 const assignedIds=new Set(assignments.map(a=>a.team_id));
 const ownPlayers=new Set(playerIds);
 const {data:released,error:re}=await sb.from('match_availability').select('id,match_id,player_id,user_id,status,is_substitute,team').in('player_id',playerIds).eq('is_substitute',true);
 if(re)message('Freigaben für höhere Teams konnten nicht geladen werden: '+re.message,true);
 const releaseRows=released||[];const releaseMatchIds=new Set(releaseRows.map(a=>a.match_id));
 const future=(all||[]).filter(m=>assignedIds.has(m.home_team_id)||assignedIds.has(m.away_team_id)||releaseMatchIds.has(m.id));
 const ids=future.map(m=>m.id);
 let av=[];if(ids.length){const ar=await sb.from('match_availability').select('id,match_id,player_id,user_id,status,is_substitute,team').in('match_id',ids).in('player_id',playerIds);if(ar.error)message('Rückmeldungen konnten nicht geladen werden: '+ar.error.message,true);av=ar.data||[]}
 availability=av;matches=future;
 renderMatches(clubMap);
}
function renderMatches(clubMap){const rows=matches.slice().sort((a,b)=>String(a.match_date).localeCompare(String(b.match_date)));if(!rows.length){$('upcomingMatches').innerHTML='<p class="empty-state">Für deine Teams sind aktuell keine kommenden Begegnungen eingetragen.</p>';return}
 $('upcomingMatches').innerHTML=rows.map(m=>{const my=availability.filter(a=>a.match_id===m.id);const isSub=my.some(a=>a.is_substitute);const teamLabel=isSub?'Freigabe als Ersatzspieler':(m.home_team_id?'Teambegegnung':'Begegnung');const own=my.find(a=>a.user_id===user.id)||my.find(a=>playerIds.includes(Number(a.player_id)));const status=own?.status||'Noch offen';const actions=own?`<button class="btn accept" data-rsvp="accepted" data-id="${m.id}" ${own.status==='accepted'?'disabled':''}>Zusagen</button><button class="btn decline" data-rsvp="declined" data-id="${m.id}" ${own.status==='declined'?'disabled':''}>Absagen</button>`:'<span class="list-meta">Rückmeldung derzeit nicht verfügbar</span>';
 return `<article class="list-card"><div class="list-main"><strong>${esc(m.home_team)} – ${esc(m.away_team)}</strong><span class="list-meta">${esc(dateLabel(m.match_date,m.match_time))} · ${esc(m.venue||'Spielort offen')}<br>${esc(teamLabel)} · Rückmeldung: ${esc(status)}</span></div><div class="list-actions">${actions}</div></article>`}).join('');
 $('upcomingMatches').querySelectorAll('[data-rsvp]').forEach(b=>b.addEventListener('click',()=>respond(b.dataset.id,b.dataset.rsvp,b)));
}
async function respond(matchId,status,button){button.disabled=true;const existing=availability.find(a=>a.match_id===matchId&&playerIds.includes(Number(a.player_id)));let result;
 if(existing?.id){result=await sb.from('match_availability').update({status,user_id:user.id}).eq('id',existing.id)}
 else{const match=matches.find(m=>m.id===matchId);const player=players[0];result=await sb.from('match_availability').insert({match_id:matchId,player_id:playerIds[0],user_id:user.id,team:player.team||match?.home_team||'',status,is_substitute:false})}
 if(result.error){message('Deine Rückmeldung konnte nicht gespeichert werden: '+result.error.message,true);button.disabled=false;return}
 message(status==='accepted'?'Deine Zusage wurde gespeichert.':'Deine Absage wurde gespeichert.');await loadLinkedDashboard();
}
async function loadTraining(clubIds){if(!clubIds.length){$('trainingList').innerHTML='<p class="empty-state">Keine Vereinszuordnung vorhanden.</p>';return}
 const {data:loc,error}=await sb.from('club_training_locations').select('id,club_id,name,address,city').in('club_id',clubIds);if(error){$('trainingList').innerHTML='<p class="empty-state">Trainingsorte sind für dein Konto derzeit nicht freigegeben.</p>';return}
 const ids=(loc||[]).map(x=>x.id);if(!ids.length){$('trainingList').innerHTML='<p class="empty-state">Noch keine Trainingszeiten hinterlegt.</p>';return}
 const {data:sessions,error:se}=await sb.from('club_training_sessions').select('location_id,group_name,weekday,start_time,end_time').in('location_id',ids).order('weekday').order('start_time');if(se){$('trainingList').innerHTML='<p class="empty-state">Trainingszeiten konnten nicht geladen werden.</p>';return}
 const names=['','Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag','Sonntag'];const lm=new Map(loc.map(x=>[x.id,x]));$('trainingList').innerHTML=(sessions||[]).length?sessions.map(s=>{const l=lm.get(s.location_id);return `<article class="list-card"><div class="list-main"><strong>${esc(s.group_name)}</strong><span class="list-meta">${esc(names[s.weekday]||'')} · ${esc(String(s.start_time).slice(0,5))}–${esc(String(s.end_time).slice(0,5))} Uhr<br>${esc(l?.name||'')} · ${esc(l?.city||'')}</span></div></article>`}).join(''):'<p class="empty-state">Noch keine Trainingszeiten hinterlegt.</p>';
}
sb?.auth.onAuthStateChange((_event,session)=>{const next=session?.user||null;if(next?.id!==user?.id){user=next;if(user)loadLinkedDashboard();else{ $('linkedDashboard').hidden=true;$('unlinkedPanel').hidden=false; }}});
start().catch(e=>message(e.message||'Spielerprofil konnte nicht geladen werden.',true));
})();
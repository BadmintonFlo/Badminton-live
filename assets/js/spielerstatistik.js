
const SUPABASE_URL='https://apsarswjmsrmffoyxsgr.supabase.co';
const SUPABASE_PUBLISHABLE_KEY='sb_publishable_yN9CDCZEHrCkCVMb87SkRg_hQjPjNmj';
const sb=supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY);
let user=null,profile=null,memberships=[],playerAccounts=[],linkedPlayers=[],matches=[],games=[],availability=[],adminTeams=[];
const $=id=>document.getElementById(id), esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const isAdmin=()=>profile?.role==='admin', isManager=t=>isAdmin()||memberships.some(x=>x.team===t&&x.role==='team_manager'), isPlayer=()=>profile?.role==='player';
const teams=()=>isPlayer()?[...new Set(linkedPlayers.map(p=>p.team).filter(Boolean))]:(isAdmin()?[...new Set(adminTeams)]:[...new Set(memberships.map(x=>x.team).filter(Boolean))]);
const fmtDate=d=>d?new Date(d+'T12:00:00').toLocaleDateString('de-DE'):'–';
function normalize(s){return String(s||'').trim().replace(/\s+/g,' ').toLocaleLowerCase('de-DE')}
function msg(t,kind=''){const e=$('msg');e.textContent=t;e.className='msg '+kind;e.classList.remove('hidden')}
function loginMsg(t){const e=$('loginMsg');e.textContent=t;e.className='msg bad';e.classList.remove('hidden')}
function badge(v){if(v==='accepted')return '<span class="pill">Zugesagt</span>';if(v==='declined')return '<span class="pill">Abgesagt</span>';if(v==='pending')return '<span class="pill">Offen</span>';return '<span class="pill">–</span>'}
function completedSetScore(x,y){if(x==null||y==null)return false;x=Number(x);y=Number(y);if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x>30||y>30||x===y)return false;const hi=Math.max(x,y),lo=Math.min(x,y);return (hi===21&&lo<=19)||(hi>=22&&hi<=29&&hi-lo===2)||(hi===30&&lo>=28)}
function setTally(g){let h=0,a=0,ph=0,pa=0;for(let n=1;n<=3;n++){const x=g['set'+n+'_home'],y=g['set'+n+'_away'];if(x!=null&&y!=null){ph+=Number(x)||0;pa+=Number(y)||0;if(completedSetScore(x,y)){if(+x>+y)h++;else a++}}}return {h,a,ph,pa,winner:h>=2?'home':a>=2?'away':null}}
function gameSideFor(g,p,m){const home=p.team===m.home_team;const names=home?[g.player1,g.player2]:[g.opponent_player1,g.opponent_player2];return names.some(n=>normalize(n)===normalize(p.name))?(home?'home':'away'):null}
function playedFor(m,p){
 const home=p.team===m.home_team, fields=home?['player1','player2']:['opponent_player1','opponent_player2'];
 const gs=games.filter(g=>g.match_id===m.id);
 if(m.status!=='finished'||!gs.length)return null;
 const n=normalize(p.name); return gs.some(g=>fields.some(f=>normalize(g[f])===n));
}
function avFor(m,p){return availability.find(a=>a.match_id===m.id&&Number(a.player_id)===Number(p.id))||availability.find(a=>a.match_id===m.id&&p.user_id&&a.user_id===p.user_id)}
async function load(){
 const {data:{user:u}}=await sb.auth.getUser();user=u;if(!u)return showLoggedOut();
 const [pr,ms,pa]=await Promise.all([
  sb.from('profiles').select('id,display_name,role').eq('id',u.id).maybeSingle(),
  sb.from('team_memberships').select('team,role').eq('user_id',u.id),
  sb.from('player_accounts').select('player_id,is_primary,active').eq('user_id',u.id).eq('active',true)
 ]);
 profile=pr.data;memberships=ms.data||[];playerAccounts=pa.data||[];
 if(isPlayer()&&playerAccounts.length){const ids=playerAccounts.map(x=>Number(x.player_id)).filter(Number.isFinite);const r=await sb.from('players').select('id,team,name,user_id,active').in('id',ids);linkedPlayers=r.data||[]}
 if(isAdmin()){const r=await sb.from('players').select('team').eq('active',true);adminTeams=[...new Set((r.data||[]).map(x=>x.team).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'de',{numeric:true}))}
 if(!isPlayer() && !isAdmin() && !memberships.some(x=>x.role==='team_manager')){msg('Für die Statistik ist eine Mannschaftszuordnung erforderlich.','bad')}
 $('who').textContent='Angemeldet: '+(profile?.display_name||user.email)+' · '+(profile?.role||'Benutzer');
 $('loginCard').classList.add('hidden');$('app').classList.remove('hidden');setupFilters();await loadData();
}
async function loadData(){
 let q=sb.from('matches').select('id,home_team,away_team,match_date,status,season').order('match_date',{ascending:true});
 const {data:m,error:me}=await q;if(me){msg('Begegnungen konnten nicht geladen werden: '+me.message,'bad');return}
 const allowed=teams(); matches=(m||[]).filter(x=>isAdmin()||allowed.includes(x.home_team)||allowed.includes(x.away_team));
 const ids=matches.map(x=>x.id);
 if(!ids.length){games=[];availability=[];await populatePlayers();populateSeasons();syncView();render();return}
 const [gr,ar]=await Promise.all([
  sb.from('match_games').select('*').in('match_id',ids),
  sb.from('match_availability').select('match_id,player_id,user_id,team,status,is_substitute').in('match_id',ids)
 ]);
 if(gr.error){msg('Aufstellungen konnten nicht geladen werden: '+gr.error.message,'bad');return}
 if(ar.error){msg('Zu-/Absagen konnten nicht geladen werden: '+ar.error.message,'bad');return}
 games=gr.data||[];availability=ar.data||[];populateSeasons();await populatePlayers();syncView();render();
}
function setupFilters(){
 $('viewFilter').onchange=()=>{syncView();render()};$('teamFilter').onchange=render;$('playerFilter').onchange=render;$('seasonFilter').onchange=render;
 populateTeams();syncView();
}
function syncView(){const playerMode=$('viewFilter').value==='player';$('playerBox').classList.toggle('hidden',!playerMode);$('teamBox').classList.toggle('hidden',playerMode);$('teamView').classList.toggle('hidden',playerMode);$('playerView').classList.toggle('hidden',!playerMode)}
function populateTeams(){const ts=teams().slice().sort((a,b)=>String(a).localeCompare(String(b),'de',{numeric:true}));const old=$('teamFilter').value;$('teamFilter').innerHTML=ts.length?ts.map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join(''):'<option value="">Keine Mannschaften</option>';if(ts.includes(old))$('teamFilter').value=old;}
function populateSeasons(){const s=[...new Set(matches.map(m=>m.season).filter(Boolean))].sort((a,b)=>String(b).localeCompare(String(a),'de',{numeric:true}));const old=$('seasonFilter').value;$('seasonFilter').innerHTML='<option value="">Alle Saisons</option>'+s.map(x=>`<option>${esc(x)}</option>`).join('');if(s.includes(old))$('seasonFilter').value=old}
function eligiblePlayers(){
 if(isPlayer())return linkedPlayers;
 return linkedPlayers.filter(p=>isAdmin()||memberships.some(x=>x.team===p.team&&x.role==='team_manager'));
}
async function populatePlayers(){
 if(!isPlayer()){
  let q=sb.from('players').select('id,team,name,user_id,active').eq('active',true);
  if(!isAdmin())q=q.in('team',memberships.filter(x=>x.role==='team_manager').map(x=>x.team));
  const r=await q;if(r.error){msg('Spieler konnten nicht geladen werden: '+r.error.message,'bad');return}linkedPlayers=r.data||[];
 }
 const ps=eligiblePlayers().sort((a,b)=>String(a.name).localeCompare(String(b.name),'de'));
 const old=$('playerFilter').value;
 $('playerFilter').innerHTML=ps.length?ps.map(p=>`<option value="${p.id}">${esc(p.name)}${isAdmin()||!isPlayer()?` · ${esc(p.team)}`:''}</option>`).join(''):'<option value="">Keine Spieler</option>';
 if(ps.some(p=>String(p.id)===old))$('playerFilter').value=old;
 $('playerBox').classList.toggle('hidden',$('viewFilter').value!=='player'||!ps.length);
}
function matchOutcome(m){const gs=games.filter(g=>g.match_id===m.id);let home=0,away=0;gs.forEach(g=>{const z=setTally(g);if(z.winner==='home')home++;else if(z.winner==='away')away++});return home>away?'home':away>home?'away':null}
function renderTeamSummary(own,team){
 const heading=document.querySelector('#teamView h2');if(heading)heading.textContent=team?`Gesamtübersicht ${team}`:'Gesamtübersicht Mannschaft';
 const finished=own.filter(m=>m.status==='finished'&&matchOutcome(m)!==null);let wins=0,losses=0,setsFor=0,setsAgainst=0,pointsFor=0,pointsAgainst=0;
 const disciplines={};
 finished.forEach(m=>{const gs=games.filter(g=>g.match_id===m.id);let mh=0,ma=0;gs.forEach(g=>{const z=setTally(g);if(!z.winner)return;if(z.winner==='home')mh++;if(z.winner==='away')ma++;setsFor+=z.h;setsAgainst+=z.a;pointsFor+=z.ph;pointsAgainst+=z.pa;const key=String(g.position||'Unbekannt');if(!disciplines[key])disciplines[key]={w:0,l:0,sf:0,sa:0,pf:0,pa:0};const d=disciplines[key];if(z.winner==='home')d.w++;if(z.winner==='away')d.l++;d.sf+=z.h;d.sa+=z.a;d.pf+=z.ph;d.pa+=z.pa});if(mh>ma)wins++;else if(ma>mh)losses++});
 const total=wins+losses, winPct=total?Math.round(wins/total*100):0, setPct=setsFor+setsAgainst?Math.round(setsFor/(setsFor+setsAgainst)*100):0, pointPct=pointsFor+pointsAgainst?Math.round(pointsFor/(pointsFor+pointsAgainst)*100):0;
 $('teamKpis').innerHTML=[['Begegnungen',finished.length],['Gewonnen',wins],['Verloren',losses],['Siegquote',winPct+' %'],['Sätze gewonnen / verloren',setsFor+' / '+setsAgainst],['Satzgewinnquote',setPct+' %'],['Punkte erzielt / abgegeben',pointsFor+' / '+pointsAgainst],['Punktgewinnquote',pointPct+' %']].map(x=>`<div class="kpi"><div class="label">${esc(x[0])}</div><div class="value">${esc(x[1])}</div></div>`).join('');
 const order=['HD1','HD2','DD','HE1','HE2','HE3','DE','GD'];$('disciplineRows').innerHTML=order.filter(k=>disciplines[k]).map(k=>{const d=disciplines[k],n=d.w+d.l,pct=n?Math.round(d.w/n*100):0,pp=d.pf+d.pa?Math.round(d.pf/(d.pf+d.pa)*100):0;return `<tr><td>${esc(k)}</td><td class="good">${d.w}</td><td class="bad">${d.l}</td><td>${pct}%</td><td>${d.sf} : ${d.sa}</td><td>${d.pf} : ${d.pa}</td><td>${pp}%</td></tr>`}).join('')||'<tr><td colspan="7">Für diese Auswahl liegen noch keine abgeschlossenen Spielergebnisse vor.</td></tr>';
 const av=availability.filter(a=>own.some(m=>m.id===a.match_id));const responses=av.filter(a=>a.status==='accepted'||a.status==='declined');const accepted=responses.filter(a=>a.status==='accepted').length,declined=responses.filter(a=>a.status==='declined').length;const avg=responses.length?Math.round(accepted/responses.length*100):0;const declinedPct=responses.length?Math.round(declined/responses.length*100):0;const open=av.filter(a=>!a.status||a.status==='pending').length;const playedNames=finished.flatMap(m=>games.filter(g=>g.match_id===m.id).flatMap(g=>[g.player1,g.player2,g.opponent_player1,g.opponent_player2]).filter(Boolean));const playerCount=new Set(playedNames.map(normalize)).size;
 $('teamParticipation').textContent=`Beteiligung über alle erfassten Rückmeldungen: Zusagen ${avg}% · Absagen ${declinedPct}% · noch offen ${open} Rückmeldungen. Erfasste unterschiedliche Namen in Aufstellungen: ${playerCount}.`;
}
function render(){
 const season=$('seasonFilter').value;
 const relevant=matches.filter(m=>(!season||m.season===season)&&m.status!=='live');
 const allowed=teams();
 const selectedTeam=$('teamFilter').value;const teamMatches=relevant.filter(m=>selectedTeam&&(m.home_team===selectedTeam||m.away_team===selectedTeam)&&(isAdmin()||allowed.includes(m.home_team)||allowed.includes(m.away_team)));
 renderTeamSummary(teamMatches,selectedTeam);
 if($('viewFilter').value!=='player')return;
 const ps=eligiblePlayers();let p=ps.find(x=>String(x.id)===$('playerFilter').value)||ps[0];if(!p){$('headline').textContent='Keine Spielerdaten';$('kpis').innerHTML='<div class="empty">Keine Spieler für diese Auswahl gefunden.</div>';$('availabilityStats').innerHTML='<div class="empty">Keine Daten verfügbar.</div>';$('participationStats').innerHTML='<div class="empty">Keine Daten verfügbar.</div>';$('detailRows').innerHTML='<tr><td colspan="5">Keine Spielerdaten vorhanden.</td></tr>';return}
 const ownAll=relevant.filter(m=>m.home_team===p.team||m.away_team===p.team);
 const own=ownAll.filter(m=>m.status==='finished'&&matchOutcome(m)!==null);
 const playerGames=games.filter(g=>own.some(m=>m.id===g.match_id)&&own.some(m=>m.id===g.match_id&&gameSideFor(g,p,m)));
 const playerTotals={wins:0,losses:0,setsFor:0,setsAgainst:0,pointsFor:0,pointsAgainst:0,playedGames:0};
 playerGames.forEach(g=>{const m=own.find(m=>m.id===g.match_id),side=gameSideFor(g,p,m),z=setTally(g);if(!side||!z.winner)return;playerTotals.playedGames++;const won=z.winner===side;if(won)playerTotals.wins++;else playerTotals.losses++;playerTotals.setsFor+=side==='home'?z.h:z.a;playerTotals.setsAgainst+=side==='home'?z.a:z.h;playerTotals.pointsFor+=side==='home'?z.ph:z.pa;playerTotals.pointsAgainst+=side==='home'?z.pa:z.ph});
 const av=own.map(m=>({m,a:avFor(m,p)}));
 const responded=av.filter(x=>x.a?.status==='accepted'||x.a?.status==='declined');
 const accepted=responded.filter(x=>x.a.status==='accepted').length,declined=responded.filter(x=>x.a.status==='declined').length,open=av.filter(x=>!x.a||x.a.status==='pending').length;
 const finished=own.filter(m=>m.status==='finished');const played=finished.filter(m=>playedFor(m,p)===true).length;const notPlayed=finished.filter(m=>playedFor(m,p)===false).length;const unknown=finished.length-played-notPlayed;
 const participationPct=finished.length?Math.round(played/finished.length*100):0;const responsePct=(accepted+declined)?Math.round(accepted/(accepted+declined)*100):0;
 const confirmedAccepted=av.filter(x=>x.a?.status==='accepted'&&x.m.status==='finished');const acceptedPlayed=confirmedAccepted.filter(x=>playedFor(x.m,p)===true).length;const acceptedNotPlayed=confirmedAccepted.filter(x=>playedFor(x.m,p)===false).length;const declinedPlayed=av.filter(x=>x.a?.status==='declined'&&x.m.status==='finished').filter(x=>playedFor(x.m,p)===true).length;
 $('headline').textContent=`${p.name} · ${p.team}`;
 const winPct=playerTotals.playedGames?Math.round(playerTotals.wins/playerTotals.playedGames*100):0;const setPct=(playerTotals.setsFor+playerTotals.setsAgainst)?Math.round(playerTotals.setsFor/(playerTotals.setsFor+playerTotals.setsAgainst)*100):0;const pointPct=(playerTotals.pointsFor+playerTotals.pointsAgainst)?Math.round(playerTotals.pointsFor/(playerTotals.pointsFor+playerTotals.pointsAgainst)*100):0;
 $('kpis').innerHTML=[['Entschiedene Begegnungen',own.length],['Siege',playerTotals.wins],['Niederlagen',playerTotals.losses],['Siegquote',winPct+' %'],['Sätze gewonnen / verloren',playerTotals.setsFor+' / '+playerTotals.setsAgainst],['Satzgewinnquote',setPct+' %'],['Punkte erzielt / abgegeben',playerTotals.pointsFor+' / '+playerTotals.pointsAgainst],['Punktgewinnquote',pointPct+' %'],['Punktedifferenz',playerTotals.pointsFor-playerTotals.pointsAgainst],['Zugesagt',accepted],['Abgesagt',declined],['Teilgenommen',played],['Teilnahmequote',participationPct+' %']].map(x=>`<div class="kpi"><div class="label">${esc(x[0])}</div><div class="value">${esc(x[1])}</div></div>`).join('');
 $('availabilityStats').innerHTML=`<div class="statline"><span>Zugesagt</span><strong>${accepted}</strong></div><div class="statline"><span>Abgesagt</span><strong>${declined}</strong></div><div class="statline"><span>Offen</span><strong>${open}</strong></div><div class="statline"><span>Antwortquote</span><strong>${responsePct} %</strong></div><progress class="stats-progress" max="100" value="${responsePct}" aria-label="Antwortquote"></progress>`;
 $('participationStats').innerHTML=`<div class="statline"><span>Abgeschlossene Begegnungen</span><strong>${finished.length}</strong></div><div class="statline"><span>Tatsächlich gespielt</span><strong>${played}</strong></div><div class="statline"><span>Nicht eingesetzt</span><strong>${notPlayed}</strong></div><div class="statline"><span>Noch nicht eindeutig</span><strong>${unknown}</strong></div><div class="statline"><span>Teilnahmequote</span><strong>${participationPct} %</strong></div><progress class="stats-progress" max="100" value="${participationPct}" aria-label="Teilnahmequote"></progress><div class="small stats-note">Zugesagt und gespielt: ${acceptedPlayed} · zugesagt und nicht eingesetzt: ${acceptedNotPlayed} · trotz Absage gespielt: ${declinedPlayed}</div>`;
 const rows=own.slice().sort((a,b)=>String(a.match_date).localeCompare(String(b.match_date))).map(m=>{const a=avFor(m,p);const pl=playedFor(m,p);let ps=pl===true?'Teilgenommen':pl===false?'Nicht eingesetzt':'–';return `<tr><td>${fmtDate(m.match_date)}</td><td>${esc(m.home_team)} – ${esc(m.away_team)}</td><td>${badge(a?.status)}</td><td>${ps}</td><td>${esc(m.season||'–')}</td></tr>`}).join('');$('detailRows').innerHTML=rows||'<tr><td colspan="5">Keine Begegnungen vorhanden.</td></tr>';
}
function showLoggedOut(){$('loginCard').classList.remove('hidden');$('app').classList.add('hidden')}
$('loginBtn').onclick=async()=>{const {error}=await sb.auth.signInWithPassword({email:$('email').value.trim(),password:$('password').value});if(error)loginMsg('Anmeldung fehlgeschlagen: '+error.message);else await load()};
$('logoutBtn').onclick=async()=>{await sb.auth.signOut();user=null;showLoggedOut()};
sb.auth.getSession().then(({data})=>{if(data.session)load()});

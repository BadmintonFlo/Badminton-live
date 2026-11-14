(() => {
"use strict";
const $=id=>document.getElementById(id);
const normalizeRole=v=>{const r=String(v||"").trim().toLowerCase().replace(/[ -]+/g,"_");return ({administrator:"admin",systemadministrator:"admin",system_admin:"admin",spieler:"player",mannschaftsverantwortlicher:"team_manager",teammanager:"team_manager",vereinsverwalter:"club_admin",vereinsverwaltung:"club_admin",clubmanager:"club_admin",club_manager:"club_admin",mannschaftsfuehrer:"team_manager","mannschaftsführer":"team_manager",captain:"team_manager",team_captain:"team_manager"})[r]||r};
const has=(roles,...wanted)=>wanted.some(r=>roles.has(r));
const roleNames={admin:"Administrator",player:"Spieler",team_manager:"Mannschaftsführer",club_admin:"Vereinsverantwortlicher",moderator:"Moderator",scorer:"Ergebniserfassung"};
const state={session:null,roles:new Set(),clubs:[],selectedClubId:"",players:0,teams:0,matches:0,linkedPlayers:0,loadErrors:[],isAdmin:false,sb:null,hiddenItems:{},favoriteItems:{},hiddenStorageKey:"badminone_personal_functions_guest"};
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const isAdmin=()=>state.isAdmin;
const selectedClub=()=>state.clubs.find(c=>c.id===state.selectedClubId)||null;
function functionKey(x){return String(x.key||((x.href||"")+"|"+x.title));}
function persistPersonalFunctions(){
 try{localStorage.setItem(state.hiddenStorageKey,JSON.stringify({hidden:state.hiddenItems,favorites:state.favoriteItems}))}
 catch(e){console.warn("Persönliche Funktionseinstellungen konnten nicht gespeichert werden.",e)}
}
function loadPersonalFunctions(){
 try{
  const raw=localStorage.getItem(state.hiddenStorageKey);
  const data=raw?JSON.parse(raw)||{}:{};
  // Backward compatibility: older versions stored only the hidden-items object.
  if(data.hidden||data.favorites){state.hiddenItems=data.hidden||{};state.favoriteItems=data.favorites||{};}
  else {state.hiddenItems=data;state.favoriteItems={};}
 }catch(_){state.hiddenItems={};state.favoriteItems={};}
}
function functionLink(x){
 const link=document.createElement(x.disabled?"div":"a");
 link.className="function-tile"+(x.disabled?" is-disabled":"")+(x.error?" is-error":"");
 if(x.href&&!x.disabled){const u=new URL(x.href,location.href);if(state.selectedClubId)u.searchParams.set("club_id",state.selectedClubId);link.href=u.pathname.split("/").pop()+u.search+u.hash;}
 if(x.disabled)link.setAttribute("aria-disabled","true");
 link.innerHTML=`<span class="function-icon" aria-hidden="true">${esc(x.icon)}</span><strong class="function-title">${esc(x.title)}</strong><span class="function-desc">${esc(x.desc)}</span><span class="function-state">${esc(x.state||(x.disabled?"Noch nicht verfügbar":"Öffnen →"))}</span>`;
 return link;
}
function closeFunctionMenus(){
 document.querySelectorAll(".function-menu").forEach(m=>m.hidden=true);
 document.querySelectorAll(".function-more-button").forEach(b=>b.setAttribute("aria-expanded","false"));
}
function showHideConfirmation(x){
 const backdrop=document.createElement("div");backdrop.className="function-confirm-backdrop";backdrop.setAttribute("role","presentation");
 backdrop.innerHTML=`<section class="function-confirm" role="dialog" aria-modal="true" aria-labelledby="hideConfirmTitle"><h3 id="hideConfirmTitle">Funktion ausblenden?</h3><p>Möchtest du „${esc(x.title)}“ wirklich aus deiner Funktionsübersicht ausblenden? Die Funktion wird nicht gelöscht und kann jederzeit wieder eingeblendet werden.</p><div class="function-confirm-actions"><button type="button" class="cancel-hide">Abbrechen</button><button type="button" class="confirm-hide">Ausblenden</button></div></section>`;
 document.body.append(backdrop);
 const close=()=>backdrop.remove();
 backdrop.querySelector(".cancel-hide").addEventListener("click",close);
 backdrop.querySelector(".confirm-hide").addEventListener("click",()=>{const key=functionKey(x);state.hiddenItems[key]={...x,key};delete state.favoriteItems[key];persistPersonalFunctions();close();render();});
 backdrop.addEventListener("click",e=>{if(e.target===backdrop)close()});
 backdrop.querySelector(".cancel-hide").focus();
}
function addFavorite(x){
 const key=functionKey(x);state.favoriteItems[key]={...x,key};delete state.hiddenItems[key];persistPersonalFunctions();closeFunctionMenus();render();
}
function hideFunction(x){closeFunctionMenus();showHideConfirmation(x);}
function removeFavorite(key){delete state.favoriteItems[key];persistPersonalFunctions();render();}
function makeMenu(x){
 const key=functionKey(x),menu=document.createElement("div");menu.className="function-menu";menu.hidden=true;
 const isFav=!!state.favoriteItems[key];
 menu.innerHTML=`<button type="button" data-action="favorite"><span aria-hidden="true">${isFav?"★":"☆"}</span>${isFav?"Aus Favoriten entfernen":"Als Favorit hinzufügen"}</button><button type="button" data-action="hide"><span aria-hidden="true">◉</span>Funktion ausblenden</button>`;
 menu.querySelector('[data-action="favorite"]').addEventListener("click",()=>{if(isFav)removeFavorite(key);else addFavorite(x)});
 menu.querySelector('[data-action="hide"]').addEventListener("click",()=>hideFunction(x));
 return menu;
}
function tile(x){
 const wrap=document.createElement("div");wrap.className="function-tile-wrap";
 wrap.append(functionLink(x));
 const more=document.createElement("button");more.type="button";more.className="function-more-button";more.textContent="⋮";more.setAttribute("aria-label","Optionen für "+x.title);more.setAttribute("aria-expanded","false");
 const menu=makeMenu(x);
 more.addEventListener("click",e=>{
  e.stopPropagation();const open=menu.hidden;closeFunctionMenus();menu.hidden=!open;more.setAttribute("aria-expanded",String(open));
 });
 wrap.append(more,menu);return wrap;
}
function renderFavorites(){
 const panel=$("favoritesPanel"),toggle=$("favoritesToggle"),list=$("favoritesList"),count=$("favoritesCount");if(!panel||!toggle||!list)return;
 const entries=Object.values(state.favoriteItems||{});
 count.textContent=String(entries.length);
 list.replaceChildren();
 if(!entries.length){const p=document.createElement("p");p.className="favorites-empty";p.textContent="Noch keine Favoriten. Füge Funktionen über das Drei-Punkte-Menü hinzu.";list.append(p);}
 else entries.forEach(x=>{
  const row=document.createElement("div");row.className="favorite-item";
  row.append(functionLink(x));
  const remove=document.createElement("button");remove.type="button";remove.className="favorite-remove";remove.textContent="★";remove.title="Aus Favoriten entfernen";remove.setAttribute("aria-label",x.title+" aus Favoriten entfernen");remove.addEventListener("click",()=>removeFavorite(functionKey(x)));
  row.append(remove);list.append(row);
 });
}
function renderHiddenFunctions(){
 const panel=$("hiddenFunctionsPanel"),toggle=$("hiddenFunctionsToggle"),list=$("hiddenFunctionsList"),count=$("hiddenFunctionsCount");if(!panel||!toggle||!list)return;
 const entries=Object.values(state.hiddenItems||{});panel.hidden=!entries.length;count.textContent=String(entries.length);
 list.innerHTML=entries.map(x=>`<div class="hidden-function-row"><span><strong>${esc(x.title)}</strong><small>${esc(x.desc||"")}</small></span><button type="button" class="function-restore-button" data-restore="${esc(x.key)}">Wieder einblenden</button></div>`).join("");
 list.querySelectorAll("[data-restore]").forEach(button=>button.addEventListener("click",()=>{delete state.hiddenItems[button.dataset.restore];persistPersonalFunctions();render();}));
}
function renderGroup(id,items){
 const section=$("section-"+id),grid=$("grid-"+id);if(!section||!grid)return;
 const visible=items.map(x=>({...x,group:id})).filter(x=>!state.hiddenItems[functionKey(x)]);
 section.hidden=!visible.length;grid.replaceChildren(...visible.map(tile));
}
const item=(title,desc,href,icon,extra={})=>({title,desc,href,icon,...extra});
function selectedClubGate(message){return !state.selectedClubId?{disabled:true,state:"Bitte zuerst einen Verein auswählen. "+message}:{}}
function renderNextSteps(){
 const list=$("nextStepsList"),subtitle=$("nextStepsSubtitle");
 if(!list)return;
 const admin=isAdmin(),logged=!!state.session,club=selectedClub();
 const rows=[];
 const add=(status,title,desc,href,label)=>rows.push({status,title,desc,href,label});
 if(!logged){
  subtitle.textContent="Melde dich an, um deine nächsten Aufgaben zu sehen.";
  add("open","Bei BadminOne anmelden","Nach der Anmeldung zeigen wir dir passende Funktionen und Aufgaben.","index.html","Anmelden");
 } else if((admin||has(state.roles,"club_admin","team_manager"))&&!state.selectedClubId){
  subtitle.textContent="Wähle zuerst den Verein, den du bearbeiten möchtest.";
  add("open","Verein auswählen","Die Vereinsauswahl oben aktiviert die passenden Aufgaben und Daten.",null,"Oben auswählen");
 } else if(state.selectedClubId){
  subtitle.textContent="Empfohlene Aufgaben für "+(club?.name||"den ausgewählten Verein");
  add("done","Verein ausgewählt","Du arbeitest aktuell mit diesem Verein.",null,"Erledigt");
  if(state.players===0){
   add("open","Spieler erstellen oder importieren","Lege Spieler manuell an oder importiere den Kader. Das ist die Grundlage für Mannschaften.","vereine.html?club_id="+encodeURIComponent(state.selectedClubId),"Spieler verwalten");
   add("wait","Mannschaft erstellen","Sobald Spieler vorhanden sind, kannst du eine Mannschaft anlegen.",null,"Wartet");
  } else {
   add("done","Spieler vorhanden",state.players+" aktive Spieler sind diesem Verein zugeordnet.",null,"Erledigt");
   if(state.teams===0)add("open","Mannschaft erstellen","Die Spieler sind vorhanden. Lege jetzt eine Mannschaft an.","mannschaft.html?club_id="+encodeURIComponent(state.selectedClubId),"Mannschaften");
   else {
    add("done","Mannschaft vorhanden",state.teams+" aktive Mannschaft(en) gefunden.",null,"Erledigt");
    if(state.matches===0)add("open","Spielplan einrichten","Erstelle oder importiere Begegnungen für die Mannschaft.","spielplan.html?club_id="+encodeURIComponent(state.selectedClubId),"Spielplan öffnen");
    else add("done","Spielbetrieb eingerichtet",state.matches+" Begegnung(en) gefunden.",null,"Erledigt");
   }
  }
 } else {
  subtitle.textContent="Deine persönlichen und öffentlichen Bereiche";
  add("open","Verein finden","Suche einen Verein und stelle bei Bedarf eine Beitrittsanfrage.","vereine.html","Vereine entdecken");
  if(!state.linkedPlayers)add("wait","Spielerprofil verknüpfen","Wenn dein Verein deinen Spielerdatensatz angelegt hat, kann er mit deinem Konto verbunden werden.",null,"Noch nicht möglich");
 }
 list.innerHTML=rows.map(row=>{
  const label=row.status==="done"?"✓ Erledigt":row.status==="open"?"◷ Offen":"Ⅱ Wartet";
  const action=row.href?`<a class="next-step-link" href="${esc(row.href)}">${esc(row.label||"Öffnen")} →</a>`:`<span class="next-step-link">${esc(row.label||"")}</span>`;
  return `<div class="next-step"><span class="next-step-status ${row.status}">${label}</span><span class="next-step-copy"><strong>${esc(row.title)}</strong><small>${esc(row.desc)}</small></span>${action}</div>`;
 }).join("");
}
function updateClubSelectUI(select){
 if(!select)return;
 select.classList.add("club-select-native");
 let wrapper=document.querySelector(".club-select");
 if(wrapper)wrapper.remove();
 wrapper=document.createElement("div");
 wrapper.className="club-select";
 const trigger=document.createElement("button");
 trigger.type="button";
 trigger.className="club-select-trigger";
 trigger.setAttribute("aria-haspopup","listbox");
 trigger.setAttribute("aria-expanded","false");
 const value=document.createElement("span");
 value.className="club-select-value";
 const chevron=document.createElement("span");
 chevron.className="club-select-chevron";
 chevron.setAttribute("aria-hidden","true");
 chevron.textContent="⌄";
 trigger.append(value,chevron);
 const menu=document.createElement("div");
 menu.className="club-select-menu";
 menu.hidden=true;
 menu.setAttribute("role","listbox");
 menu.setAttribute("aria-label","Verein auswählen");
 const selected=select.options[select.selectedIndex];
 value.textContent=selected?.textContent||"– Verein auswählen –";
 Array.from(select.options).forEach(option=>{
  const button=document.createElement("button");
  button.type="button";
  button.className="club-select-option";
  button.setAttribute("role","option");
  button.setAttribute("aria-selected",String(option.value===select.value));
  const label=document.createElement("span");
  label.textContent=option.textContent;
  button.append(label);
  if(option.value===select.value){
   const check=document.createElement("span");
   check.className="club-select-check";
   check.setAttribute("aria-hidden","true");
   check.textContent="✓";
   button.append(check);
  }
  button.addEventListener("click",()=>{
   select.value=option.value;
   select.dispatchEvent(new Event("change",{bubbles:true}));
   menu.hidden=true;
   trigger.setAttribute("aria-expanded","false");
   trigger.focus();
  });
  menu.append(button);
 });
 trigger.addEventListener("click",()=>{
  const open=menu.hidden;
  menu.hidden=!open;
  trigger.setAttribute("aria-expanded",String(open));
 });
 trigger.addEventListener("keydown",event=>{
  if(event.key==="Escape"){
   menu.hidden=true;
   trigger.setAttribute("aria-expanded","false");
  }
 });
 wrapper.append(trigger,menu);
 select.after(wrapper);
}
function render(){
 const r=state.roles,logged=!!state.session,admin=isAdmin();
 $("roleSummary").textContent=logged?([...r].map(x=>roleNames[x]||x).join(" · ")||"Angemeldet · Standardfunktionen"):"Öffentlicher Bereich · Melde dich an, um persönliche Funktionen zu nutzen";
 const context=$("clubContext"),select=$("activeClubSelect"),hint=$("clubContextHint");
 context.hidden=!logged||(!admin&&state.clubs.length===0);
 if(!context.hidden){
  select.innerHTML='<option value="">– Verein auswählen –</option>'+state.clubs.map(c=>`<option value="${esc(c.id)}">${esc(c.name)}${c.city?" · "+esc(c.city):""}</option>`).join("");
  select.value=state.selectedClubId;
  updateClubSelectUI(select);
  hint.textContent=admin?"Du kannst jeden Verein auswählen. Die Auswahl gilt für die vereinsbezogenen Funktionen.":state.clubs.length>1?"Du hast Zugriff auf mehrere Vereine. Wähle aus, welchen du bearbeiten möchtest.":"Dein Verein ist vorausgewählt.";
 }
 const all=[
  item("Vereine ansehen","Veröffentlichte Badmintonvereine suchen und Informationen ansehen.","vereine.html","♜"),
  item("Verein anmelden","Einen neuen Verein bei BadminOne anmelden und zur Prüfung einreichen.","verein-erstellen.html","＋")
 ];
 const club=[];
 if(admin||has(r,"club_admin")){
  const gate=admin?selectedClubGate("Bitte zuerst den Verein auswählen."):{};
  club.push(item("Vereine verwalten","Bestehende Vereine, Veröffentlichungen, Anfragen und Mitgliedschaften verwalten.","verein-verwalten.html","⚙",gate));
  club.push(item("Spieler erstellen / importieren","Spieler manuell anlegen oder über turnier.de importieren.","vereine.html","♟",gate));
  club.push(item("Mannschaften verwalten","Mannschaften erstellen und verwalten sowie Kader und Spielerzuordnungen bearbeiten.","mannschaft.html","👥",admin?gate:(!state.players?{disabled:true,state:"Noch keine aktiven Spieler vorhanden. Zuerst Spieler erstellen oder importieren."}:{})));
  club.push(item("Rangliste bearbeiten","Die Vereinsrangliste für Herren oder Damen verwalten und die Reihenfolge der Mannschaften und Spieler festlegen.","rangliste-bearbeiten.html","🏸",admin?selectedClubGate("Bitte zuerst den Verein auswählen."):{}));
 }
 const profile=[
  item("Benutzerprofil","Persönliche Kontodaten und Profileinstellungen ansehen und bearbeiten.","profil.html","♙",{disabled:!logged,state:!logged?"Bitte anmelden":"Öffnen →"}),
  item("Mein Spielerprofil","Verknüpfte Spielerdatensätze, Mannschaften und Termine ansehen.","spielerprofil.html","♟",{disabled:!logged||(!admin&&!state.linkedPlayers),state:!logged?"Bitte anmelden":!admin&&!state.linkedPlayers?"Noch kein Spielerprofil mit deinem Konto verknüpft. Bitte Vereinsverantwortliche ansprechen.":"Öffnen →"})
 ];
 const play=[
  item("Live-Ticker","Laufende und veröffentlichte Begegnungen verfolgen.","live.html","●")
 ];
 if(admin||has(r,"player","team_manager","club_admin")){
  play.push(item("Spielplan ansehen / verwalten","Begegnungen und Termine deiner Mannschaften aufrufen.","spielplan.html","▦",{disabled:!logged||(!admin&&state.teams===0),state:!logged?"Bitte anmelden":!admin&&state.teams===0?"Noch keine Mannschaft zugeordnet oder vorhanden.":"Öffnen →"}));
 }
 if(admin||has(r,"team_manager","club_admin")){
  const gate=admin?selectedClubGate("Bitte zuerst den Verein auswählen."):{};
  play.push(item("Aufstellung erstellen","Aufstellungen für deine Mannschaften erstellen und bearbeiten.","aufstellung.html","📝",admin?gate:(!state.matches?{disabled:true,state:"Noch keine Begegnung im Spielplan vorhanden."}:{})));
  play.push(item("Spielbericht","Spielberichte zu Begegnungen einsehen oder bearbeiten.","spielbericht.html","📄",admin?gate:(!state.matches?{disabled:true,state:"Noch keine Begegnung vorhanden."}:{})));
 }
 if(admin||has(r,"moderator","scorer")){
  play.push(item("Begegnung moderieren","Spiele auswählen, Ergebnisse erfassen und Begegnungen abschließen.","moderator.html","🎮",admin?selectedClubGate("Bitte zuerst den Verein auswählen."):{}));
 }
 const stats=[item("Rangliste","Öffentliche Vereins- und Mannschaftsranglisten ansehen.","rangliste.html","🏸")];
 if(admin||has(r,"player","team_manager","club_admin")||state.linkedPlayers){
  stats.push(item("Spielerstatistik","Spiele, Einsätze und persönliche Auswertungen ansehen.","spielerstatistik.html","▤",{disabled:!logged||(!admin&&!state.linkedPlayers),state:!logged?"Bitte anmelden":!admin&&!state.linkedPlayers?"Noch kein aktives Spielerprofil verknüpft.":"Öffnen →"}));
 }
 const adminItems=[];
 if(admin)adminItems.push(item("Administration","Benutzer, Rollen und systemweite Einstellungen verwalten.","admin.html","⚙"));
 renderGroup("play",play);
 renderGroup("stats",stats);
 renderGroup("profile",profile);
 renderGroup("club",all.concat(club));
 renderGroup("admin",adminItems);
 renderNextSteps();
 renderHiddenFunctions();
 renderFavorites();
}
async function refreshClubFacts(){
 state.players=state.teams=state.matches=0;
 if(!state.selectedClubId){render();return}
 const cid=state.selectedClubId,sb=state.sb;
 const [ps,ts,ms]=await Promise.all([
  sb.from("players").select("id",{count:"exact",head:true}).eq("club_id",cid).eq("active",true),
  sb.from("club_teams").select("id",{count:"exact",head:true}).eq("club_id",cid).eq("is_active",true),
  sb.from("matches").select("id",{count:"exact",head:true}).eq("club_id",cid)
 ]);
 state.loadErrors=[];
 if(ps.error)state.loadErrors.push("Spielerbestand");else state.players=ps.count||0;
 if(ts.error)state.loadErrors.push("Mannschaften");else state.teams=ts.count||0;
 if(ms.error)state.loadErrors.push("Begegnungen");else state.matches=ms.count||0;
 $("functionsMessage").textContent=state.loadErrors.length?"Einige Voraussetzungen konnten nicht geprüft werden ("+state.loadErrors.join(", ")+"). Betroffene Kacheln bleiben vorsichtshalber eingeschränkt.":"Voraussetzungen für "+(state.clubs.find(c=>c.id===cid)?.name||"den ausgewählten Verein")+" wurden geprüft.";
 render();
}
async function start(){
 const message=$("functionsMessage");
 if(!window.supabase?.createClient){message.textContent="Supabase ist nicht verfügbar. Voraussetzungen konnten nicht geprüft werden.";return}
 const url="https://apsarswjmsrmffoyxsgr.supabase.co";
 const key="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFwc2Fyc3dqbXNybWZmb3l4c2dyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA1MjAwMzgsImV4cCI6MjEwNjA5NjAzOH0.YaT2RG0BiZbrWFj6RWIvmu88ttBmnV64FhwqNOKZn7o";
 state.sb=window.supabase.createClient(url,key);
 try{
  const {data:{session},error:ae}=await state.sb.auth.getSession();if(ae)throw ae;state.session=session;
  state.hiddenStorageKey=session?.user?.id?("badminone_personal_functions_"+session.user.id):"badminone_personal_functions_guest";
  loadPersonalFunctions();
  if(!session){message.textContent="Öffentliche Bereiche sind verfügbar. Melde dich an, damit deine Rollen und Vereinszugriffe geprüft werden.";render();return}
  const uid=session.user.id,sb=state.sb;
  const [pr,cr,tr,ar]=await Promise.all([
   sb.from("profiles").select("role").eq("id",uid).maybeSingle(),
   sb.from("club_managers").select("club_id").eq("user_id",uid),
   sb.from("club_team_user_roles").select("role,club_id,team_id,status").eq("user_id",uid).eq("status","active"),
   sb.from("player_accounts").select("player_id,active").eq("user_id",uid).eq("active",true)
  ]);
  if(pr.error)state.loadErrors.push("Profilrolle");
  state.isAdmin=!pr.error&&normalizeRole(pr.data?.role)==="admin";
  if(pr.data?.role)state.roles.add(normalizeRole(pr.data.role));
  const managed=(cr.data||[]).map(x=>x.club_id).filter(Boolean);
  const roleRows=tr.data||[];
  roleRows.forEach(x=>{if(x.role)state.roles.add(normalizeRole(x.role))});
  state.linkedPlayers=(ar.data||[]).length;
  if(state.linkedPlayers)state.roles.add("player");
  if(managed.length)state.roles.add("club_admin");
  const allowedIds=[...new Set([...managed,...roleRows.map(x=>x.club_id).filter(Boolean)])];
  let clubQuery=sb.from("clubs").select("id,name,city").is("archived_at",null).order("name");
  if(!state.isAdmin){
   if(!allowedIds.length){state.clubs=[];}
   else {const {data,error}=await clubQuery.in("id",allowedIds);if(error)state.loadErrors.push("Vereinsliste");state.clubs=data||[];}
  } else {
   const {data,error}=await clubQuery;
   if(error)state.loadErrors.push("Vereinsliste");state.clubs=data||[];
  }
  const params=new URLSearchParams(location.search),requested=params.get("club_id");
  let stored="";
  try{stored=sessionStorage.getItem("badminone_active_club_id")||""}catch(_){}
  const preferred=requested||stored;
  state.selectedClubId=state.clubs.some(c=>c.id===preferred)?preferred:(state.clubs.length===1?state.clubs[0].id:"");
  $("activeClubSelect").addEventListener("change",async e=>{
   state.selectedClubId=e.target.value;
   try{if(state.selectedClubId)sessionStorage.setItem("badminone_active_club_id",state.selectedClubId);else sessionStorage.removeItem("badminone_active_club_id")}catch(_){}
   render();
   await refreshClubFacts();
  });
  render();
  if(state.selectedClubId)await refreshClubFacts();
  else if(state.isAdmin)message.textContent="Administratorzugriff: Alle Funktionsbereiche sind sichtbar. Wähle einen Verein, um vereinsbezogene Funktionen zu öffnen.";
  else if(state.clubs.length>1)message.textContent="Du hast Zugriff auf mehrere Vereine. Wähle oben den Verein, den du bearbeiten möchtest.";
  else if(!state.clubs.length)message.textContent="Deine allgemeinen Funktionen sind verfügbar. Für Vereinsverwaltung benötigst du eine Vereinszugehörigkeit oder Verwaltungsrolle.";
  else message.textContent="Dein Verein wurde ausgewählt. Die Voraussetzungen werden geprüft.";
 }catch(error){console.error("[BadminOne Funktionen]",error);message.textContent="Berechtigungen, Vereinszugriffe oder Voraussetzungen konnten nicht vollständig geladen werden. Bitte lade die Seite erneut.";render()}
}
function bindGroupToggles(){
 document.querySelectorAll(".function-group-head").forEach(button=>{
  const group=button.closest(".function-group");group?.classList.add("is-collapsed");button.setAttribute("aria-expanded","false");
  button.addEventListener("click",()=>{
   const group=button.closest(".function-group");
   const collapsed=group.classList.toggle("is-collapsed");
   button.setAttribute("aria-expanded",String(!collapsed));
  });
 });
 const favoritesToggle=$("favoritesToggle");
 favoritesToggle?.addEventListener("click",()=>{
  const panel=$("favoritesPanel"),list=$("favoritesList");
  const open=panel.classList.toggle("is-open");favoritesToggle.setAttribute("aria-expanded",String(open));list.hidden=!open;
 });
 document.addEventListener("click",e=>{if(!e.target.closest(".function-tile-wrap"))closeFunctionMenus();});
 const hiddenToggle=$("hiddenFunctionsToggle");
 hiddenToggle?.addEventListener("click",()=>{
  const panel=$("hiddenFunctionsPanel"),list=$("hiddenFunctionsList");
  const open=panel.classList.toggle("is-open");hiddenToggle.setAttribute("aria-expanded",String(open));list.hidden=!open;
 });
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>{bindGroupToggles();start();},{once:true});else{bindGroupToggles();start();}
})();
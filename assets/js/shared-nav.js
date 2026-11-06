/* BadminOne – zentrale Navigation für alle Seiten.
   Navigation/Link-Sichtbarkeit ist Komfort; Seitenprüfungen und Supabase-RLS
   bleiben die maßgebliche Zugriffskontrolle. */
(() => {
  "use strict";
  const SUPABASE_URL = "https://apsarswjmsrmffoyxsgr.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFwc2Fyc3dqbXNybWZmb3l4c2dyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA1MjAwMzgsImV4cCI6MjEwNjA5NjAzOH0.YaT2RG0BiZbrWFj6RWIvmu88ttBmnV64FhwqNOKZn7o";
  const ROLE_ALIASES = {
    administrator:"admin", systemadministrator:"admin", system_admin:"admin",
    spieler:"player", mannschaftsverantwortlicher:"team_manager", teammanager:"team_manager",
    vereinsverwalter:"club_admin", vereinsverwaltung:"club_admin",
    clubmanager:"club_admin", club_manager:"club_admin",
    mannschaftsfuehrer:"team_manager", mannschaftsführer:"team_manager",
    captain:"team_manager", team_captain:"team_manager"
  };
  const normalizeRole = value => {
    const role=String(value||"").trim().toLowerCase().replace(/[ -]+/g,"_");
    return ROLE_ALIASES[role]||role;
  };
  const membershipRoles=new Set();
  const permittedRoles=new Set(["player","team_manager","club_admin","admin","moderator","scorer"]);
  const lineupRoles=new Set(["team_manager","club_admin","admin","moderator"]);

  const tiles=[
    {id:"home",href:"index.html",label:"Home",icon:"⌂"},
    {id:"clubs",href:"vereine.html",label:"Vereine",icon:"♜"},
    {id:"live",href:"live.html",label:"Live",icon:"●",iconClass:"pn-live"},
    {id:"players",href:"spielerprofil.html",label:"Spielerprofil",icon:"♙"}
  ];
  const moreLinks=[
    {href:"spielplan.html",feature:"schedule",label:"Spielplan"},
    {href:"aufstellung.html",feature:"lineup",label:"Aufstellungen"},
    {href:"spielbericht.html",feature:"reports",label:"Spielberichte"},
    {href:"spielerstatistik.html",feature:"players",label:"Spielerstatistik"},
    {href:"rangliste.html",feature:"ranking",label:"Rangliste"},
    {href:"moderator.html",feature:"moderator",label:"Moderator"},
    {href:"admin.html",feature:"admin",label:"Administration"}
  ];
  function currentPage(){return (location.pathname.split("/").pop()||"index.html").toLowerCase();}
  function renderNavigation(){
    const host=document.querySelector("#platformNav #navInner, #platformNav .pn-tiles");
    if(!host)return;
    host.id="navInner";
    host.setAttribute("aria-label","Hauptbereiche");
    const page=currentPage();
    const items=tiles.map(item=>{
      const active=page===item.href;
      return `<a href="${item.href}" class="pn-tile${active?" active":""}" data-id="${item.id}"${active?' aria-current="page"':""}><span class="pn-icon ${item.iconClass||""}">${item.icon}</span><span>${item.label}</span></a>`;
    }).join("");
    const moreActive=moreLinks.some(item=>page===item.href);
    const links=moreLinks.map(item=>`<a href="${item.href}" data-feature="${item.feature}"${page===item.href?' aria-current="page"':""}>${item.label}</a>`).join("");
    host.innerHTML=items+`<div class="more-wrap pn-more-wrap"><button class="pn-tile pn-more-toggle more-toggle" id="moreBtn" type="button" aria-expanded="false" aria-haspopup="true"${moreActive?' aria-current="page"':""}><span class="pn-icon">•••</span><span>Mehr</span></button><div class="pn-menu" id="moreMenu" hidden>${links}</div></div>`;
    const button=host.querySelector("#moreBtn"), menu=host.querySelector("#moreMenu");
    button?.addEventListener("click",()=>{
      const open=button.getAttribute("aria-expanded")==="true";
      button.setAttribute("aria-expanded",String(!open)); menu.hidden=open;
    });
    document.addEventListener("click",event=>{
      if(!host.querySelector(".pn-more-wrap")?.contains(event.target)){menu.hidden=true;button?.setAttribute("aria-expanded","false");}
    });
    document.addEventListener("keydown",event=>{
      if(event.key==="Escape"){menu.hidden=true;button?.setAttribute("aria-expanded","false");button?.focus();}
    });
  }
  function ensureProfileMenu(session){
    const nav=document.querySelector("#platformNav");
    if(!nav)return;

    let wrap=nav.querySelector(".pn-profile-wrap");
    if(!wrap){
      const actions=nav.querySelector(".pn-actions")||nav.querySelector(".pn-brandbar");
      if(!actions)return;
      wrap=document.createElement("div");
      wrap.className="pn-profile-wrap";
      actions.appendChild(wrap);
    }

    let trigger=wrap.querySelector("#profileBtn, .pn-profile-btn");
    if(trigger && trigger.tagName.toLowerCase()==="a"){
      const button=document.createElement("button");
      button.type="button";
      button.className=trigger.className||"pn-profile-btn";
      button.id="profileBtn";
      button.setAttribute("aria-label","Profil und Anmeldung");
      button.title="Profil";
      button.setAttribute("aria-expanded","false");
      button.innerHTML=trigger.innerHTML;
      trigger.replaceWith(button);
      trigger=button;
    }
    if(!trigger){
      trigger=document.createElement("button");
      trigger.type="button";
      trigger.className="pn-profile-btn";
      trigger.id="profileBtn";
      trigger.setAttribute("aria-label","Profil und Anmeldung");
      trigger.title="Profil";
      trigger.setAttribute("aria-expanded","false");
      trigger.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"></circle><path d="M4.5 21a7.5 7.5 0 0 1 15 0"></path></svg>';
      wrap.appendChild(trigger);
    }

    let menu=wrap.querySelector("#profileMenu");
    const isExistingIndexMenu=!!menu;
    if(!menu){
      menu=document.createElement("div");
      menu.className="pn-profile-menu";
      menu.id="profileMenu";
      menu.hidden=true;
      wrap.appendChild(menu);
      menu.innerHTML=`
        <a id="profileLogin" href="login.html?mode=login">Anmelden</a>
        <a id="profileRegister" href="login.html?mode=register">Konto erstellen</a>
        <a id="profileManage" href="profil.html" hidden>Mein Profil</a>
        <button id="logoutBtn" type="button" hidden>Abmelden</button>`;
    }

    const page=currentPage();
    const returnUrl=encodeURIComponent(page);
    const login=menu.querySelector("#profileLogin");
    const register=menu.querySelector("#profileRegister");
    const manage=menu.querySelector("#profileManage");
    const logout=menu.querySelector("#logoutBtn");

    if(login && !isExistingIndexMenu) login.href=`login.html?mode=login&return=${returnUrl}`;
    if(register && !isExistingIndexMenu) register.href=`login.html?mode=register&return=${returnUrl}`;
    if(manage){manage.href="profil.html";manage.hidden=!session;}
    if(login)login.hidden=!!session;
    if(register)register.hidden=!!session;
    if(logout)logout.hidden=!session;

    // The home page already wires its profile menu and auth-popup actions.
    // Other pages get the same menu behavior here.
    if(!isExistingIndexMenu && !trigger.dataset.profileMenuBound){
      trigger.dataset.profileMenuBound="true";
      trigger.addEventListener("click",event=>{
        event.preventDefault();
        const open=trigger.getAttribute("aria-expanded")==="true";
        trigger.setAttribute("aria-expanded",String(!open));
        menu.hidden=open;
      });
      document.addEventListener("click",event=>{
        if(!wrap.contains(event.target)){
          menu.hidden=true;
          trigger.setAttribute("aria-expanded","false");
        }
      });
      document.addEventListener("keydown",event=>{
        if(event.key==="Escape"){
          menu.hidden=true;
          trigger.setAttribute("aria-expanded","false");
          trigger.focus();
        }
      });
    }
    if(logout && !logout.dataset.logoutBound){
      logout.dataset.logoutBound="true";
      logout.addEventListener("click",async()=>{
        try{
          const client=window.__badminoneSharedNavClient;
          if(client) await client.auth.signOut();
          location.href="index.html";
        }catch(error){
          console.warn("[BadminOne] Abmeldung fehlgeschlagen:",error);
        }
      });
    }

    if(!document.getElementById("badminone-shared-profile-style")){
      const style=document.createElement("style");
      style.id="badminone-shared-profile-style";
      style.textContent=`
        #platformNav .pn-profile-wrap{position:relative}
        #platformNav .pn-profile-menu{
          position:absolute;right:0;top:calc(100% + 12px);z-index:1000;
          min-width:220px;padding:10px;border:1px solid #38536d;border-radius:20px;
          background:#17283b;box-shadow:0 18px 42px rgba(0,0,0,.38);
          display:flex;flex-direction:column;gap:4px
        }
        #platformNav .pn-profile-menu[hidden]{display:none}
        #platformNav .pn-profile-menu a,
        #platformNav .pn-profile-menu button{
          display:block;width:100%;padding:15px 16px;border:0;border-radius:12px;
          background:transparent;color:#eaf2ff;text-align:left;text-decoration:none;
          font:inherit;font-weight:700;cursor:pointer
        }
        #platformNav .pn-profile-menu a:hover,
        #platformNav .pn-profile-menu button:hover{background:#223b55}
        #platformNav .pn-profile-btn{cursor:pointer}
      `;
      document.head.appendChild(style);
    }
  }
  function applyVisibility(session,role,hasTeamMembership){
    ensureProfileMenu(session);
    const roles=new Set([role,...membershipRoles]);
    const isAdmin=!!session && normalizeRole(role)==="admin";

    document.querySelectorAll("#platformNav [data-feature]").forEach(link=>{
      const feature=link.dataset.feature;
      // Öffentliche/grundsätzlich verfügbare Bereiche bleiben sichtbar.
      // Nur die ausdrücklich geschützten Menüpunkte werden rollenbezogen gefiltert.
      let allowed=true;

      if(feature==="schedule") allowed=isAdmin || (!!session && hasTeamMembership);
      else if(feature==="lineup") allowed=isAdmin || (!!session && [...roles].some(value=>lineupRoles.has(value)));
      else if(feature==="reports") allowed=isAdmin || (!!session && [...roles].some(value=>permittedRoles.has(value)));
      else if(feature==="moderator") allowed=isAdmin || (!!session && [...roles].some(value=>["moderator","scorer","club_admin"].includes(value)));
      else if(feature==="admin") allowed=isAdmin;

      link.hidden=!allowed;
      link.setAttribute("aria-hidden",String(!allowed));
    });
  }
  async function start(){
    renderNavigation();
    let session=null,role="",client=null,hasTeamMembership=false;

    if(!window.supabase?.createClient){
      applyVisibility(null,"",false);
      return;
    }

    try{
      client=window.supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY);
      window.__badminoneSharedNavClient=client;
      const {data,error}=await client.auth.getSession();
      if(error) throw error;
      session=data?.session||null;
    }catch(error){
      console.warn("[BadminOne Navigation] Sitzung konnte nicht gelesen werden:",error);
      applyVisibility(null,"",false);
      return;
    }

    if(session?.user?.id){
      const userId=session.user.id;

      // Wie in index.js ist profiles.role die primäre Rollenquelle.
      try{
        const {data:profile,error:profileError}=await client
          .from("profiles").select("role").eq("id",userId).maybeSingle();
        if(profileError) throw profileError;
        role=normalizeRole(profile?.role);
      }catch(error){
        console.warn("[BadminOne Navigation] profiles.role konnte nicht gelesen werden:",error);
      }

      // Nur Rückfalllösung; ein RPC darf die Profilrolle nicht überschreiben.
      if(!role){
        try{
          const {data:dbRole,error:roleError}=await client.rpc("current_user_role");
          if(!roleError && dbRole) role=normalizeRole(dbRole);
        }catch(error){
          console.warn("[BadminOne Navigation] Rollen-RPC nicht verfügbar:",error);
        }
      }

      try{
        const {data:memberships,error:membershipsError}=await client
          .from("team_memberships").select("role").eq("user_id",userId);
        if(!membershipsError && Array.isArray(memberships)){
          hasTeamMembership=memberships.length>0;
          memberships.forEach(item=>{
            const membershipRole=normalizeRole(item?.role);
            if(membershipRole) membershipRoles.add(membershipRole);
          });
        }else if(membershipsError){
          console.warn("[BadminOne Navigation] Mannschaftszuordnung konnte nicht gelesen werden:",membershipsError);
        }
      }catch(error){
        console.warn("[BadminOne Navigation] Mitgliedschaftsabfrage fehlgeschlagen:",error);
      }

      // Vereinsmanager erhalten ebenfalls Zugriff auf den Menüpunkt Aufstellungen.
      try{
        const {data:managers,error:managerError}=await client
          .from("club_managers").select("club_id").eq("user_id",userId);
        if(!managerError && Array.isArray(managers) && managers.length){
          membershipRoles.add("club_admin");
        }
      }catch(error){
        console.warn("[BadminOne Navigation] Vereinsmanager-Zuordnung konnte nicht gelesen werden:",error);
      }
    }

    applyVisibility(session,role,hasTeamMembership);

    try{
      client.auth.onAuthStateChange(event=>{
        if(event==="SIGNED_IN"||event==="SIGNED_OUT") window.location.reload();
      });
    }catch(error){
      console.warn("[BadminOne Navigation] Auth-Listener konnte nicht registriert werden:",error);
    }
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});else start();
})();

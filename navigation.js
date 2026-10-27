/* Shared navigation renderer. Presentation only; not an authorization boundary. */
(() => {
  "use strict";
  const LINKS = [
    {href:"index.html",label:"⌂ Dashboard",roles:["public","player","moderator","team_manager","board","advisory","admin"]},
    {href:"vereine.html",label:"🏸 Vereine",roles:["public","player","moderator","team_manager","board","advisory","admin"]},
    {href:"mannschaft.html",label:"♟ Mannschaften",roles:["player","team_manager","board","advisory","admin"]},
    {href:"spielerstatistik.html",label:"♙ Spieler",roles:["player","moderator","team_manager","board","advisory","admin"]},
    {href:"spielplan.html",label:"▦ Spielplan",roles:["player","moderator","team_manager","board","advisory","admin"]},
    {href:"aufstellung.html",label:"📝 Aufstellung",roles:["team_manager","board","admin"]},
    {href:"moderator.html",label:"🎮 Moderator",roles:["moderator","team_manager","board","admin"]},
    {href:"spielbericht.html",label:"📄 Spielberichte",roles:["moderator","team_manager","board","admin"]},
    {href:"Rangliste.html",label:"🏸 Rangliste",roles:["public","player","moderator","team_manager","board","advisory","admin"]},
    {href:"live.html",label:"🔴 Live-Ticker",roles:["public","player","moderator","team_manager","board","advisory","admin"]},
    {href:"admin.html",label:"⚙️ Administration",roles:["admin"]}
  ];
  const page=()=>((location.pathname.split("/").pop()||"index.html").toLowerCase());
  function roleKey(profileRole,clubRoles){const p=String(profileRole||"").toLowerCase();if(["admin","administrator","super_admin"].includes(p))return"admin";const rs=(clubRoles||[]).map(x=>String(x||"").toLowerCase());if(rs.includes("board"))return"board";if(rs.includes("advisory"))return"advisory";if(rs.includes("team_manager"))return"team_manager";if(rs.includes("moderator"))return"moderator";return"player";}
  function makeLink(item){const a=document.createElement("a");a.href=item.href;a.textContent=item.label;if(page()===item.href.toLowerCase())a.setAttribute("aria-current","page");return a;}
  function render(role,signedIn){const root=document.getElementById("platformNav");if(!root)return;const links=root.querySelector(".pn-links"),user=root.querySelector(".pn-user");if(!links)return;const visible=LINKS.filter(x=>x.roles.includes(signedIn?role:"public"));const primary=visible.filter(x=>["index.html","vereine.html","mannschaft.html","spielerstatistik.html","spielplan.html"].includes(x.href));const more=visible.filter(x=>!primary.includes(x));links.replaceChildren();primary.forEach(x=>links.appendChild(makeLink(x)));if(more.length){const d=document.createElement("details");d.className="pn-more";const s=document.createElement("summary");s.textContent="••• Mehr";d.appendChild(s);const menu=document.createElement("div");menu.className="pn-menu";more.forEach(x=>menu.appendChild(makeLink(x)));d.appendChild(menu);links.appendChild(d);}if(user)user.textContent=signedIn?`Angemeldet · ${role}`:"Öffentliche Bereiche";const toggle=root.querySelector(".pn-toggle");if(toggle)toggle.onclick=()=>{const open=links.classList.toggle("is-open");toggle.setAttribute("aria-expanded",String(open));};}
  async function init(){if(!document.getElementById("platformNav"))return;const sb=window.supabase,url=window.PLATFORM_SUPABASE_URL||"https://apsarswjmsrmffoyxsgr.supabase.co",key=window.PLATFORM_SUPABASE_ANON_KEY;if(!sb?.createClient||!key){render("public",false);return;}try{const client=window.__platformSharedClient||(window.__platformSharedClient=sb.createClient(url,key));const {data:{user},error}=await client.auth.getUser();if(error||!user){render("public",false);return;}const {data:profile}=await client.from("profiles").select("role").eq("id",user.id).maybeSingle();const {data:members}=await client.from("club_memberships").select("club_role,status").eq("user_id",user.id).eq("status","active");render(roleKey(profile?.role,(members||[]).map(x=>x.club_role)),true);}catch(e){console.error("Navigation role lookup failed",e);render("public",false);}}
  document.addEventListener("DOMContentLoaded",init,{once:true});
})();

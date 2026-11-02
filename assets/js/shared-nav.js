/* BadminOne – zentrale Rollensteuerung für die Mehr-Navigation
   Die eigentliche Zugriffssicherheit muss weiterhin durch Seitenprüfungen
   und Supabase-RLS umgesetzt werden. Dieses Skript steuert nur die Sichtbarkeit. */
(() => {
  "use strict";

  const SUPABASE_URL = "https://apsarswjmsrmffoyxsgr.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJhcHNhcnN3am1zcm1mbmZmb3l4c2dyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA1MjAwMzgsImV4cCI6MjEwNjA5NjAzOH0.YaT2RG0BiZbrWFj6RWIvmu88ttBmnV64FhwqNOKZn7o";

  const ROLE_ALIASES = {
    administrator: "admin",
    systemadministrator: "admin",
    system_admin: "admin",
    spieler: "player",
    mannschaftsverantwortlicher: "team_manager",
    teammanager: "team_manager",
    vereinsverwalter: "club_admin",
    vereinsverwaltung: "club_admin"
  };

  const normalizeRole = value => {
    const role = String(value || "").trim().toLowerCase().replace(/[ -]+/g, "_");
    return ROLE_ALIASES[role] || role;
  };

  const authenticatedFeatures = new Set(["lineup", "reports"]);
  const permittedRoles = new Set([
    "player", "team_manager", "club_admin", "admin", "moderator", "scorer"
  ]);

  const membershipRoles = new Set();

  function ensureProfileMenu(session) {
    const menu = document.querySelector("#platformNav #profileMenu");
    if (!menu) return;
    let link = menu.querySelector("#profileManage");
    if (!link) {
      link = document.createElement("a");
      link.id = "profileManage";
      link.textContent = "Mein Profil";
      const login = menu.querySelector("#profileLogin");
      if (login && login.nextSibling) menu.insertBefore(link, login.nextSibling);
      else menu.appendChild(link);
    }
    link.href = "profil.html";
    link.hidden = !session;
  }

  function applyVisibility(session, role) {
    ensureProfileMenu(session);
    const roles = new Set([role, ...membershipRoles]);
    document.querySelectorAll("#platformNav [data-feature]").forEach(link => {
      const feature = link.dataset.feature;
      let allowed = true;

      if (authenticatedFeatures.has(feature)) {
        allowed = !!session && [...roles].some(value => permittedRoles.has(value));
      } else if (feature === "moderator") {
        allowed = !!session && [...roles].some(value => ["moderator", "scorer", "admin"].includes(value));
      } else if (feature === "admin") {
        allowed = !!session && roles.has("admin");
      }

      link.hidden = !allowed;
      link.setAttribute("aria-hidden", String(!allowed));
    });
  }

  async function start() {
    let session = null;
    let role = "";
    let client = null;

    try {
      if (!window.supabase?.createClient) {
        applyVisibility(null, "");
        return;
      }

      client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      session = data.session || null;

      if (session?.user?.id) {
        const [{ data: profile, error: profileError }, { data: memberships, error: membershipsError }] = await Promise.all([
          client.from("profiles").select("role").eq("id", session.user.id).maybeSingle(),
          client.from("team_memberships").select("role").eq("user_id", session.user.id)
        ]);
        if (!profileError) role = normalizeRole(profile?.role);
        if (!membershipsError && Array.isArray(memberships)) {
          memberships.forEach(item => {
            const membershipRole = normalizeRole(item?.role);
            if (membershipRole) membershipRoles.add(membershipRole);
          });
        }
      }
    } catch (error) {
      // Bei nicht verfügbarem Auth-/Profilzugriff werden geschützte Links ausgeblendet.
      session = null;
      role = "";
    }

    applyVisibility(session, role);

    if (client) {
      try {
        client.auth.onAuthStateChange((event) => {
          // Nur echte An-/Abmeldungen erfordern einen Neulauf der Rollenprüfung.
          // INITIAL_SESSION und TOKEN_REFRESHED dürfen keinen Reload auslösen.
          if (event === "SIGNED_IN" || event === "SIGNED_OUT") {
            window.location.reload();
          }
        });
      } catch (_) {}
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();

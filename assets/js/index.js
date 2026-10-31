(() => {
"use strict";

const SUPABASE_URL = "https://apsarswjmsrmffoyxsgr.supabase.co";
const KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFwc2Fyc3dqbXNybWZmb3l4c2dyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA1MjAwMzgsImV4cCI6MjEwNjA5NjAzOH0.YaT2RG0BiZbrWFj6RWIvmu88ttBmnV64FhwqNOKZn7o";
const sb = window.supabase?.createClient(SUPABASE_URL, KEY);
const $ = id => document.getElementById(id);

const items = {
  home: {label:"Home",icon:"⌂",href:"index.html",desc:"Persönliche Startseite"},
  clubs: {label:"Vereine",icon:"♜",href:"vereine.html",desc:"Vereine entdecken und verwalten"},
  teams: {label:"Teams",icon:"♟",href:"mannschaft.html",desc:"Mannschaften und Kader"},
  live: {label:"Live",icon:"●",href:"live.html",desc:"Live-Spiele und veröffentlichte Ergebnisse"},
  players: {label:"Spieler",icon:"♙",href:"spielerstatistik.html",desc:"Spielerprofile und Zuordnungen"},
  schedule: {label:"Spielplan",icon:"▦",href:"spielplan.html",desc:"Termine deiner Mannschaften",auth:true},
  lineup: {label:"Aufstellungen",icon:"📝",href:"aufstellung.html",desc:"Aufstellungen verwalten",auth:true},
  reports: {label:"Spielberichte",icon:"📄",href:"spielbericht.html",desc:"Spielberichte",auth:true},
  ranking: {label:"Rangliste",icon:"🏸",href:"rangliste.html",desc:"Ranglisten und Statistiken"},
  moderator: {label:"Moderator",icon:"🎮",href:"moderator.html",desc:"Moderationsfunktionen",roles:["moderator","scorer","admin"]},
  admin: {label:"Administration",icon:"⚙️",href:"admin.html",desc:"Systemverwaltung",roles:["admin"]}
};

const choices = ["teams","players","schedule","lineup","reports","ranking","moderator","admin"];
const defaultsCustom = "teams";

let session = null;
let role = "";
let mode = "login";
let customId = defaultsCustom;

const params = new URLSearchParams(location.search);
const requestedAuth = params.get("auth");

function getReturnTarget() {
  const requested = params.get("return");

  if (requested === "vereine.html" || requested === "mannschaft.html") {
    return requested;
  }

  try {
    const referrer = document.referrer ? new URL(document.referrer) : null;
    const previousPage = referrer?.pathname.split("/").pop().toLowerCase();

    if (
      referrer &&
      referrer.origin === location.origin &&
      ["vereine.html", "mannschaft.html"].includes(previousPage)
    ) {
      return previousPage;
    }
  } catch (_) {}

  return "";
}

const normalizeRole = value => {
  const r = String(value || "").trim().toLowerCase().replace(/[ -]+/g, "_");
  const map = {
    administrator:"admin",
    systemadministrator:"admin",
    system_admin:"admin",
    spieler:"player",
    mannschaftsverantwortlicher:"team_manager",
    teammanager:"team_manager",
    vereinsverwalter:"club_admin",
    vereinsverwaltung:"club_admin"
  };
  return map[r] || r;
};

const keyForUser = () =>
  `badminton.home.custom.v3.${session?.user?.id || "guest"}`;

const permitted = id => {
  if (!items[id]) return false;
  if (items[id].auth && !session) return false;
  if (items[id].roles && !items[id].roles.includes(role)) return false;

  if (
    ["schedule","reports","lineup"].includes(id) &&
    (!session || !["player","team_manager","club_admin","admin","moderator","scorer"].includes(role))
  ) return false;

  return true;
};

function activePage() {
  return location.pathname.split("/").pop().toLowerCase() || "index.html";
}

function loadCustom() {
  try {
    const v = localStorage.getItem(keyForUser());
    customId = choices.includes(v) ? v : defaultsCustom;
  } catch (_) {
    customId = defaultsCustom;
  }
}

function renderNav() {
  const root = $("navInner");
  const custom = $("customNav");
  const moreMenu = $("moreMenu");

  if (!root || !custom) return;

  const f = items[customId] || items.teams;

  custom.href = f.href;
  custom.dataset.id = "custom";
  custom.innerHTML =
    `<span class="nav-icon ${customId === "live" ? "live" : ""}">${f.icon}</span><span>${f.label}</span>`;

  custom.hidden = !permitted(customId);

  root.querySelectorAll("[data-id]").forEach(a => {
    const target = (a.getAttribute("href") || "").split("/").pop().toLowerCase();
    a.classList.toggle("active", target === activePage() && a.dataset.id !== "custom");
  });

  if (f.href.toLowerCase() === activePage()) {
    custom.classList.add("active");
  }

  const primary = new Set(["home","clubs","live",customId]);

  if (moreMenu) {
    moreMenu.querySelectorAll("[data-feature]").forEach(a => {
      a.hidden = !permitted(a.dataset.feature) || primary.has(a.dataset.feature);
    });
  }
}

function refresh() {
  if ($("loginBtn")) $("loginBtn").hidden = true;
  if ($("registerBtn")) $("registerBtn").hidden = true;
  if ($("logoutBtn")) $("logoutBtn").hidden = !session;
  if ($("profileBtn")) $("profileBtn").hidden = false;
  if ($("profileLogin")) $("profileLogin").hidden = !!session;
  if ($("profileRegister")) $("profileRegister").hidden = !!session;
  if ($("profileManage")) $("profileManage").hidden = !session;
  if ($("roleLine")) $("roleLine").hidden = !session;

  if ($("welcomeTitle")) {
    $("welcomeTitle").textContent = session
      ? `Willkommen, ${session.user.user_metadata?.display_name || session.user.email || "Mitglied"}!`
      : "Willkommen!";
  }

  if ($("welcomeSubtitle")) {
    $("welcomeSubtitle").textContent = session
      ? "Deine Vereine, Teams und nächsten Aufgaben auf einen Blick."
      : "Alles Wichtige rund um Vereine, Teams und Spiele an einem Ort.";
  }

  if ($("roleLine")) {
    $("roleLine").textContent = role ? `Rolle: ${role}` : "Angemeldet";
  }

  if ($("nextMatchSection")) {
    $("nextMatchSection").hidden = !session;
  }

  document.querySelectorAll("[data-auth]").forEach(el => {
    el.hidden = !session;
  });

  document.querySelectorAll("[data-roles]").forEach(el => {
    el.hidden = !session || !el.dataset.roles.split(",").includes(role);
  });

  renderNav();
}

function openDialog(id) {
  const el = $(id);
  if (el && typeof el.showModal === "function") el.showModal();
}

function closeDialog(id) {
  const el = $(id);
  if (el && el.open) el.close();
}

function makeOptions() {
  const root = $("options");
  if (!root) return;

  root.replaceChildren();

  if ($("prefsTitle")) {
    $("prefsTitle").textContent = "Individuellen Menüpunkt auswählen";
  }

  if ($("prefsIntro")) {
    $("prefsIntro").textContent =
      "Home, Vereine, Live und Mehr bleiben fest. Du kannst genau einen weiteren Menüpunkt wählen.";
  }

  choices.filter(id => permitted(id)).forEach(id => {
    const f = items[id];
    const row = document.createElement("div");
    row.className = "option";

    const input = document.createElement("input");
    input.type = "radio";
    input.name = "customNavChoice";
    input.id = "opt-" + id;
    input.value = id;
    input.checked = customId === id;

    const label = document.createElement("label");
    label.htmlFor = input.id;
    label.textContent = `${f.icon} ${f.label}`;

    const small = document.createElement("small");
    small.textContent = f.desc;
    label.append(small);

    row.append(input, label);
    root.append(row);
  });

  if ($("prefsMessage")) $("prefsMessage").hidden = true;
  openDialog("prefsDialog");
}

if ($("moreBtn")) {
  $("moreBtn").addEventListener("click", () => {
    const menu = $("moreMenu");
    if (!menu) return;

    const open = menu.hidden;
    menu.hidden = !open;
    $("moreBtn").setAttribute("aria-expanded", String(open));
  });
}

document.addEventListener("click", e => {
  if (!e.target.closest(".more-wrap") && $("moreMenu")) {
    $("moreMenu").hidden = true;
    if ($("moreBtn")) $("moreBtn").setAttribute("aria-expanded", "false");
  }
});

if ($("editNavBtn")) {
  $("editNavBtn").addEventListener("click", () => {
    if ($("moreMenu")) $("moreMenu").hidden = true;
    makeOptions();
  });
}

if ($("closePrefs")) {
  $("closePrefs").addEventListener("click", () => closeDialog("prefsDialog"));
}

if ($("savePrefs")) {
  $("savePrefs").addEventListener("click", () => {
    const selected = $("options")?.querySelector('input[name="customNavChoice"]:checked');

    if (!selected) {
      if ($("prefsMessage")) {
        $("prefsMessage").textContent = "Bitte einen Menüpunkt auswählen.";
        $("prefsMessage").hidden = false;
      }
      return;
    }

    customId = selected.value;

    try {
      localStorage.setItem(keyForUser(), customId);
    } catch (_) {}

    closeDialog("prefsDialog");
    refresh();
  });
}

if ($("resetPrefs")) {
  $("resetPrefs").addEventListener("click", () => {
    customId = defaultsCustom;

    try {
      localStorage.setItem(keyForUser(), customId);
    } catch (_) {}

    closeDialog("prefsDialog");
    refresh();
  });
}

if ($("loginBtn")) {
  $("loginBtn").addEventListener("click", () => authMode("login"));
}

if ($("registerBtn")) {
  $("registerBtn").addEventListener("click", () => authMode("register"));
}

if ($("switchRegisterBtn")) {
  $("switchRegisterBtn").addEventListener("click", () => authMode("register"));
}

if ($("switchLoginBtn")) {
  $("switchLoginBtn").addEventListener("click", () => authMode("login"));
}

if ($("closeAuth")) {
  $("closeAuth").addEventListener("click", () => closeDialog("authDialog"));
}

function authMode(next) {
  mode = next;

  if (!$("authTitle") || !$("submitAuth") || !$("registerFields") || !$("forgotBtn")) {
    return;
  }

  $("authTitle").textContent = next === "register" ? "Konto erstellen" : "Anmelden";
  $("submitAuth").textContent = next === "register" ? "Registrieren" : "Anmelden";
  $("registerFields").hidden = next !== "register";
  $("forgotBtn").hidden = next !== "login";

  if ($("switchRegisterBtn")) {
    $("switchRegisterBtn").hidden = next === "register";
  }

  if ($("switchLoginBtn")) {
    $("switchLoginBtn").hidden = next !== "register";
  }

  if ($("authMessage")) $("authMessage").hidden = true;

  openDialog("authDialog");
}

function authMessage(text, ok = false) {
  const el = $("authMessage");
  if (!el) return;

  el.textContent = text;
  el.hidden = false;
  el.style.background = ok ? "#153d32" : "#482729";
  el.style.color = ok ? "#a8f0d0" : "#ffd1d1";
}

if ($("authForm")) {
  $("authForm").addEventListener("submit", async e => {
    e.preventDefault();

    if (!sb) return authMessage("Anmeldung momentan nicht verfügbar.");

    const email = $("email").value.trim().toLowerCase();
    const password = $("password").value;
    const btn = $("submitAuth");

    btn.disabled = true;

    try {
      if (mode === "register") {
        const name = $("fullName").value.trim();

        if (name.length < 2) {
          throw Error("Bitte gib deinen vollständigen Namen ein.");
        }

        if (password !== $("confirmPassword").value) {
          throw Error("Die Passwörter stimmen nicht überein.");
        }

        const {data,error} = await sb.auth.signUp({
          email,
          password,
          options: {
            data: {display_name:name,full_name:name,name},
            emailRedirectTo: new URL("index.html",location.href).href
          }
        });

        if (error) throw error;

        // Wenn Supabase direkt eine Session zurückgibt,
        // wird der Nutzer sofort angemeldet und zum Home-Menü geleitet.
        if (data.session) {
          await loadSession();
          closeDialog("authDialog");
          window.location.replace("index.html");
          return;
        }

        // Wenn E-Mail-Bestätigung aktiviert ist, muss diese
        // zunächst bestätigt werden. Danach kann man sich anmelden.
        authMessage(
          "Konto erstellt. Bitte bestätige zuerst deine E-Mail-Adresse. Danach kannst du dich anmelden.",
          true
        );

      } else {
        const {error} = await sb.auth.signInWithPassword({email,password});
        if (error) throw error;

        closeDialog("authDialog");
        await loadSession();

        const target = getReturnTarget();

        if (target) {
          window.location.replace(target);
          return;
        }
      }
    } catch (err) {
      authMessage(err.message || "Ein Fehler ist aufgetreten.");
    } finally {
      btn.disabled = false;
    }
  });
}

if ($("forgotBtn")) {
  $("forgotBtn").addEventListener("click", async () => {
    if (!sb) return authMessage("Passwort-Reset nicht verfügbar.");

    const email = $("email").value.trim();

    if (!email) {
      return authMessage("Bitte zuerst deine E-Mail-Adresse eingeben.");
    }

    try {
      const {error} = await sb.auth.resetPasswordForEmail(email, {
        redirectTo: new URL("passwort.html",location.href).href
      });

      if (error) throw error;

      authMessage(
        "Falls ein Konto existiert, wurde eine Reset-Mail versendet.",
        true
      );
    } catch (err) {
      authMessage(err.message || "Reset fehlgeschlagen.");
    }
  });
}

if ($("logoutBtn")) {
  $("logoutBtn").addEventListener("click", async () => {
    try {
      await sb?.auth.signOut();
    } catch (_) {}

    session = null;
    role = "";
    loadCustom();
    refresh();
  });
}

if ($("profileBtn")) {
  $("profileBtn").addEventListener("click", () => {
    const menu = $("profileMenu");

    if (!menu) {
      if (session) {
        location.href = "passwort.html";
      } else {
        authMode("login");
      }
      return;
    }

    menu.hidden = !menu.hidden;
    $("profileBtn").setAttribute("aria-expanded", String(!menu.hidden));
  });
}

if ($("profileLogin")) {
  $("profileLogin").addEventListener("click", () => {
    if ($("profileMenu")) $("profileMenu").hidden = true;
    if ($("profileBtn")) $("profileBtn").setAttribute("aria-expanded", "false");
    authMode("login");
  });
}

if ($("profileRegister")) {
  $("profileRegister").addEventListener("click", () => {
    if ($("profileMenu")) $("profileMenu").hidden = true;
    if ($("profileBtn")) $("profileBtn").setAttribute("aria-expanded", "false");
    authMode("register");
  });
}

document.addEventListener("click", event => {
  const wrap = document.querySelector("#platformNav .pn-profile-wrap");
  const menu = $("profileMenu");

  if (wrap && menu && !wrap.contains(event.target)) {
    menu.hidden = true;
    if ($("profileBtn")) $("profileBtn").setAttribute("aria-expanded", "false");
  }
});

async function loadSession() {
  if (!sb) {
    refresh();
    return;
  }

  try {
    const {data,error} = await sb.auth.getSession();
    if (error) throw error;

    session = data.session;

    if (session) {
      try {
        const {data:p} = await sb.from("profiles")
          .select("role,display_name,full_name")
          .eq("id",session.user.id)
          .maybeSingle();

        role = normalizeRole(p?.role);

        let profileName = p?.display_name || p?.full_name || "";

        // Falls im Profil kein Anzeigename hinterlegt ist, zuerst den verknüpften
        // Spieler-Datensatz verwenden. E-Mail bleibt nur der letzte Fallback.
        if (!profileName) {
          try {
            const {data: account} = await sb.from("player_accounts")
              .select("player_id")
              .eq("user_id", session.user.id)
              .eq("active", true)
              .order("is_primary", {ascending:false})
              .limit(1)
              .maybeSingle();
            if (account?.player_id) {
              const {data: player} = await sb.from("players")
                .select("name")
                .eq("id", account.player_id)
                .maybeSingle();
              profileName = player?.name || "";
            }
          } catch (_) {}
        }

        profileName = profileName || session.user.user_metadata?.display_name ||
          session.user.user_metadata?.full_name || session.user.user_metadata?.name || "";
        if (profileName) {
          session.user.user_metadata = {
            ...session.user.user_metadata,
            display_name: profileName
          };
        }
      } catch (_) {
        role = "";
      }
    }
  } catch (_) {
    session = null;
    role = "";
  }

  loadCustom();
  refresh();
}

function cleanNewsText(value) {
  const box = document.createElement("div");
  box.innerHTML = String(value || "");

  const text = (box.textContent || box.innerText || "")
    .replace(/\s+/g, " ")
    .trim();

  return text.replace(
    /^(?:News-Kategorien|Erstellt von|Ligenbetrieb|Listen online)\s*(?:-->|:|-)?\s*/i,
    ""
  ).trim();
}

function makeNewsSummary(item, title) {
  let summary = cleanNewsText(item.summary || item.description || "");
  const cleanTitle = cleanNewsText(title).toLowerCase();

  if (summary.toLowerCase().startsWith(cleanTitle)) {
    summary = summary.slice(title.length).replace(/^[\s:–—-]+/, "").trim();
  }

  summary = summary
    .replace(/(?:News-Kategorien|Erstellt von [^·]+|mehr lesen|weiterlesen).*$/i, "")
    .trim();

  if (summary.length < 35 || /<\s*\/?\s*\w+[^>]*>/.test(summary)) {
    const t = title.toLowerCase();

    if (/wdm|meisterschaft/.test(t)) {
      summary = "Informationen zur Meisterschaft. Öffne die Originalmeldung für Details und Hinweise zur Teilnahme.";
    } else if (/rangliste|vrl/.test(t)) {
      summary = "Informationen zur Verbandsrangliste. Prüfe die Originalmeldung auf Fristen und Meldebedingungen.";
    } else if (/portal|frist|meldeschluss/.test(t)) {
      summary = "Wichtiger Hinweis zum Meldeverfahren. Öffne die Originalmeldung und prüfe den genauen Meldeschluss.";
    } else {
      summary = "Kurze Informationen aus dem Badminton-Verband. Öffne die Originalmeldung für Details.";
    }
  }

  return summary.length > 190
    ? summary.slice(0,187).replace(/\s+\S*$/, "") + "…"
    : summary;
}

async function loadBadmintonNews() {
  const list = $("badmintonNewsList");
  const status = $("newsStatus");

  if (!list || !status) return;

  const endpoint = window.BADMINTON_NEWS_ENDPOINT;

  if (!endpoint) {
    status.textContent = "Beispieltexte · Originalmeldungen öffnen";
    return;
  }

  try {
    const res = await fetch(endpoint, {
      headers: {"Accept":"application/json"},
      cache: "no-store"
    });

    if (!res.ok) throw new Error("News-Dienst nicht erreichbar");

    const payload = await res.json();
    const news = Array.isArray(payload.items) ? payload.items : [];

    if (!news.length) throw new Error("Keine Meldungen zurückgegeben");

    list.replaceChildren();

    news.slice(0,3).forEach(item => {
      const a = document.createElement("a");
      a.className = "news-link";
      a.href = item.url || "https://www.badminton.nrw/service/amtliche-nachrichten/alle-mitteilungen-1";
      a.target = "_blank";
      a.rel = "noopener noreferrer";

      const span = document.createElement("span");
      const title = document.createElement("strong");
      const date = document.createElement("small");
      const summary = document.createElement("span");
      const arrow = document.createElement("span");

      span.className = "news-copy";
      date.className = "news-date";
      summary.className = "news-summary";

      const titleText = cleanNewsText(item.title || "Badminton NRW – Meldung");

      title.textContent = titleText.slice(0,180);
      date.textContent = cleanNewsText(item.date || "Offizielle Verbandsmeldung");
      summary.textContent = makeNewsSummary(item, titleText);

      arrow.className = "arrow";
      arrow.textContent = "↗";

      span.append(title,date,summary);
      a.append(span,arrow);
      list.append(a);
    });

    status.textContent = payload.updatedAt
      ? `Automatisch aktualisiert · ${new Date(payload.updatedAt).toLocaleString("de-DE")}`
      : "Aktuelle Verbandsmeldungen";

  } catch (_) {
    status.textContent = "News aktuell nicht abrufbar · Beispieltexte werden angezeigt";
  }
}

loadCustom();
refresh();
loadSession();
loadBadmintonNews();

if (requestedAuth === "login" || requestedAuth === "register") {
  window.setTimeout(() => authMode(requestedAuth), 250);
}

if (sb) {
  sb.auth.onAuthStateChange(() => loadSession());
}

})();

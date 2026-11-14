(() => {
  "use strict";
  const pageName = location.pathname.split("/").pop() || "index.html";
  const allowed = new Set(["index.html","vereine.html","mannschaft.html","live.html","spielplan.html","aufstellung.html","profil.html","rangliste.html","moderator.html","passwort.html"]);
  const returnPage = allowed.has(pageName.toLowerCase()) ? pageName : "index.html";
  const dialog = document.createElement("dialog");
  dialog.className = "auth-popup-dialog";
  dialog.setAttribute("aria-label", "Bei BadminOne anmelden");
  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.className = "auth-popup-close";
  closeButton.setAttribute("aria-label", "Login schließen");
  closeButton.textContent = "×";
  const frame = document.createElement("iframe");
  frame.className = "auth-popup-frame";
  frame.title = "BadminOne Anmeldung";
  frame.setAttribute("loading", "eager");
  dialog.append(closeButton, frame);
  closeButton.addEventListener("click", closeAuth);
  // Schließen ausschließlich über das X – weder Escape noch Klick außerhalb.
  dialog.addEventListener("cancel", event => event.preventDefault());
  document.body.append(dialog);
  function openAuth(mode) {
    const selected = mode === "register" ? "register" : "login";
    frame.src = `login.html?embed=1&mode=${selected}&return=${encodeURIComponent(returnPage)}`;
    if (!dialog.open) dialog.showModal();
  }
  function closeAuth() { if (dialog.open) dialog.close(); frame.src = "about:blank"; }
  document.addEventListener("click", event => {
    const trigger = event.target.closest("[data-auth-open]");
    if (!trigger) return;
    event.preventDefault();
    openAuth(trigger.dataset.authOpen);
  });
  window.addEventListener("message", event => {
    if (event.origin !== location.origin || event.source !== frame.contentWindow) return;
    if (event.data?.type === "badminone-auth-success") { closeAuth(); location.reload(); }
  });
  window.openBadminAuth = openAuth;
})();

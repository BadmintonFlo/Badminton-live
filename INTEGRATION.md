# Integration guide

## 1. Add the shared stylesheet
Add this after existing page stylesheets (do not delete page-specific CSS):
```html
<link rel="stylesheet" href="assets/css/style.css">
```

## 2. Standardize the shared navigation
Replace only the current `#platformNav` element with:
```html
<nav id="platformNav" aria-label="Hauptnavigation">
  <div class="pn-inner">
    <a class="pn-brand" href="index.html">🏸 Badminton-Plattform</a>
    <button class="pn-toggle" type="button" aria-expanded="false" aria-controls="pnLinks">☰ Menü</button>
    <div class="pn-links" id="pnLinks"></div>
    <span class="pn-user">Navigation wird geladen …</span>
  </div>
</nav>
```

## 3. Load Supabase and shared scripts
Reuse the project's existing public key; do not use a `service_role` key.
```html
<script>
  window.PLATFORM_SUPABASE_URL = "https://apsarswjmsrmffoyxsgr.supabase.co";
  window.PLATFORM_SUPABASE_ANON_KEY = "PASTE_EXISTING_PUBLIC_ANON_OR_PUBLISHABLE_KEY_HERE";
</script>
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="assets/js/navigation.js" defer></script>
<script src="assets/js/auth-guard.js" defer></script>
```

## 4. Proposed initial page rules
- `admin.html`: administrator only.
- `mannschaft.html`, `aufstellung.html`: team manager, board, administrator.
- `moderator.html`, `spielbericht.html`: moderator, team manager, board, administrator.
- `index.html`, `vereine.html`, `live.html`, `Rangliste.html`, `passwort.html`: currently left public in the draft.
- `spielerstatistik.html`: not guarded pending a decision on whether player statistics are public or member-only.

Confirm these rules before release. The current code may need per-club role checks, not only a global role.

## 5. Supabase must enforce permissions
Enable/verify RLS on all tables used by these pages. Policies must validate the authenticated user and relevant club membership/role for SELECT/INSERT/UPDATE/DELETE; review RPCs and Storage policies too. Test direct URL navigation and direct API requests as logged-out, player, moderator, team manager, board, and admin users.

## 6. Acceptance checklist
- Mobile header and dropdown match the dashboard design.
- Logged-out users see only explicitly public links.
- Direct URLs to private pages redirect when logged out or unauthorized.
- A player cannot open moderator/admin pages; moderator cannot open admin.
- Existing page actions and Supabase queries continue working.
- Password recovery remains usable when logged out.

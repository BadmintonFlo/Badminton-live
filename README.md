# Badminton-live: Shared UI and access-control preparation

This is a staged integration patch based on inspection of `BadmintonFlo/Badminton-live` on `main`. It has not been installed into the HTML pages yet.

Included:
- `assets/css/style.css`: shared dark navy / blue design tokens and responsive navigation styling.
- `assets/js/navigation.js`: shared navigation renderer; reads `profiles.role` and active `club_memberships.club_role`.
- `assets/js/auth-guard.js`: client-side redirect guard for selected private pages.
- `INTEGRATION.md`: integration sequence and safety limitations.

Important:
1. Do not replace existing page-specific `<style>` or `<script>` blocks; the pages contain substantial existing logic.
2. The role map is a proposed starting point. Confirm intended visibility for `spielerstatistik.html`, `Rangliste.html`, `live.html`, and `mannschaft.html` before release.
3. Shared JS expects `window.PLATFORM_SUPABASE_ANON_KEY` to be set to the project's existing public anon/publishable key before loading scripts. Never use a service-role secret in browser code.
4. Hiding links and client-side redirects are not security boundaries. GitHub Pages HTML source is public; Supabase RLS and server-side authorization must protect data and write operations.
5. Keep `passwort.html` reachable while logged out.
6. `index.html` currently has both `#platformNav` and older `#dashboardTabs`. Remove the duplicate only after checking/removing JS dependencies.

GitHub reads succeeded, but branch creation was rejected by the connected integration with HTTP 403. No repository files were changed while preparing this patch.

COOPLEDGER v3.2.0 FRONTEND - GITHUB PAGES PWA
================================================

Upload ONLY the contents of this FRONTEND-GITHUB-PAGES folder to the GitHub Pages repository.

Keep together:
- index.html
- manifest.json
- service-worker.js
- icons/
- .nojekyll

DO NOT upload backend files, SQLite database, backups, credentials or Cloudflare tunnel tokens.

Production API target: https://coop.mdmsportal.uk
Before publishing, verify this hostname points to the healthy private backend tunnel.
PWA cache: refreshed for this accounting release.

Release validation
- Load the site in a private/incognito window and sign in.
- Verify the API health endpoint returns database: ok before users post transactions.
- Hard-refresh once after publishing so the new service worker replaces prior offline assets.

Reporting UI
- Project reports: ITEMIZED comparative detail from actual posted history.
- Super Admin Consolidated: GENERAL by default, optional ITEMIZED.
- Period builders: YEARS / MONTHS / WEEKS / CUSTOM, minimum 2 and maximum 36 periods.
- Comparative PDF may span many A4 pages by design.
- Comparative Excel keeps all selected period columns.

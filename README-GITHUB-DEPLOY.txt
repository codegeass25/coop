COOPLEDGER v1.8.0 FRONTEND - GITHUB PAGES PWA
=================================================
Upload ONLY the CONTENTS of this folder to the GitHub Pages repository/branch.

Required files:
- index.html
- manifest.json
- service-worker.js
- icons/icon-192.png
- icons/icon-512.png
- .nojekyll

Production API default:
https://coop.mdmsportal.uk

Local testing:
When served from localhost or 127.0.0.1, the frontend automatically uses http://127.0.0.1:5000.

PWA:
- GitHub Pages HTTPS satisfies the secure-origin requirement.
- Chrome/Edge/Android can use the install prompt / in-app Install button.
- iPhone/iPad Safari uses Share -> Add to Home Screen.
- Service worker v1.7 caches only frontend shell assets and does not cache API/Socket.IO traffic.
- Paths are relative so deployment works from a GitHub Pages repository subpath.

SECURITY:
No database, Google OAuth secret/token, SMSGate credential, Cloudflare connector token, or Super Admin password belongs in this frontend folder.

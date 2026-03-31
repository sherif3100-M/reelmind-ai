# ReelMind AI — Fix Instructions

## What was broken
The 404 error was caused by `pages/index.js` redirecting to `/index.html`,
which does not exist in Next.js. It has been fixed to redirect to `/login`
(or `/dashboard` if already logged in).

## How to apply the fix

Copy every file from this ZIP into your project, matching the folder structure exactly:

| File in this ZIP                          | Put it here in your project              |
|-------------------------------------------|------------------------------------------|
| pages/index.js                            | pages/index.js  ← REPLACE                |
| pages/_app.js                             | pages/_app.js                            |
| pages/login.js                            | pages/login.js                           |
| pages/dashboard.js                        | pages/dashboard.js                       |
| pages/api/videos/generate.js              | pages/api/videos/generate.js             |
| pages/api/videos/list.js                  | pages/api/videos/list.js                 |
| pages/api/videos/[id]/status.js           | pages/api/videos/[id]/status.js          |
| pages/api/auth/session.js                 | pages/api/auth/session.js                |
| pages/api/admin/stats.js                  | pages/api/admin/stats.js                 |
| pages/api/admin/grant-credits.js          | pages/api/admin/grant-credits.js         |
| lib/supabase.js                           | lib/supabase.js                          |
| lib/gemini.js                             | lib/gemini.js                            |
| lib/elevenlabs.js                         | lib/elevenlabs.js                        |
| lib/broll.js                              | lib/broll.js                             |
| lib/pipeline.js                           | lib/pipeline.js                          |

You will need to CREATE these folders if they don't exist:
- pages/api/auth/
- pages/api/admin/
- pages/api/videos/[id]/        ← the brackets are part of the folder name

## Supabase SQL (run ONCE in Supabase SQL Editor)
See ADMIN_SETUP.sql — replace YOUR_EMAIL@gmail.com with your real email BEFORE running.

## Push to GitHub
git add .
git commit -m "fix: index redirect 404, correct folder structure"
git push

Vercel will redeploy in ~2 minutes.
Then visit: https://reelmind-ai.vercel.app/login

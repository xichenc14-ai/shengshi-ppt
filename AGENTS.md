# Production release requirements

- Production `main` is the canonical release branch. Inspect the current Vercel deployment and commit before preparing a release. Start from that commit and retain accepted Gamma and login fixes; do not replace production with a divergent workspace snapshot.
- SMS sending, password reset, and `/api/health/auth` use the verified `hnd1` region. Check both route `preferredRegion`, `vercel.json`, and actual deployed function metadata. The rest of the application stays in its existing region.
- `npm run build` must run `test:auth` before Next.js builds. Keep its selected tests included in `.vercelignore` uploads. Do not remove these checks to make a deployment pass.
- Create a production-target deployment with `--skip-domain` first. Before promoting, run `node scripts/auth-readiness-check.mjs <deployment-url> --samples=3` with existing admin credentials. All three real signed POST probes and the challenge database schema must pass in the SMS region. A homepage or `/api/health` 200 alone does not prove login is working.
- Keep the current public deployment when that gate fails; repair and re-check the staged deployment. After release, repeat the same gate on the public domain and confirm its source commit. Record commit, deployment, region, and sanitized evidence.
- When changing the SMS delivery path, use one explicitly authorized receiving phone for real delivery acceptance. Never automatically retransmit an uncertain send. Never save plaintext codes, credentials, complete phone numbers, or session cookies in diagnostics or Git.

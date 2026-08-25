# marketing-site

The public site for **www.stayvibe360.com**. Deliberately isolated from the
main application:

- **No build step.** One `public/index.html`, styles inline, no JavaScript.
- **Not part of the Vite multi-app build.** `npm run build:*` does not touch
  this folder, and this folder does not import from `src/`.
- **Its own Cloudflare Pages project**, so deploying the site can never
  overwrite the portal (a mistake already made once with `dist/`).

## Deploy

**Run it from inside this folder.** That is not a style preference — deploying
from the repo root makes wrangler walk up, find the portal's `wrangler.toml`
and `functions/`, and bundle the entire portal API onto the marketing domain.
That happened on the first deploy: `/api/submitGuestCheckIn` was answering on
`stayvibe-site.pages.dev`. The local `wrangler.toml` here prevents it.

```
cd marketing-site && npx wrangler pages deploy public --project-name=stayvibe-site --branch=main --commit-dirty=true
```

A healthy deploy prints **no** "Uploading Functions bundle" line. If you see
that line, you deployed from the wrong directory — check `/api/` on the site
and redeploy from here.

## Custom domain

Deploying publishes to `stayvibe-site.pages.dev`. Pointing
`www.stayvibe360.com` at it is a one-time Cloudflare dashboard step:

1. Pages → **stayvibe-site** → *Custom domains* → **Set up a domain**
2. Enter `www.stayvibe360.com`, then repeat for the apex `stayvibe360.com`
3. The `stayvibe360.com` zone is already in this Cloudflare account (it serves
   `dwarka.`, `manage.` and `demo.`), so the DNS records are created for you

## Where the sign-up goes

Both buttons point at `https://dwarka.stayvibe360.com/NewHost` — the host
registration screen already in the portal. Submissions land in the
`platform_host_registrations` table, so enquiries are queryable alongside
everything else rather than sitting in a Google Sheet.

To use a Google Form instead, change the two `href` values in `public/index.html`.

## Editing the capability strip

The scrolling chips are plain markup in `public/index.html`. The list appears
**twice** — the second copy is what makes the loop seamless, and is marked
`aria-hidden`. Edit both copies identically or the animation will jump.

`class="chip is-live"` renders green/Live; `class="chip"` renders grey/Coming.
Only move a chip to `is-live` once the feature actually ships — the whole point
of the labels is that a host on a demo call sees exactly what was promised.

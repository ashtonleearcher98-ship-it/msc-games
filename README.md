# MSC Games — Micronation Sports Championships

A responsive, GitHub Pages-compatible sporting authority website for the Micronation Sports Championships. Original four-ribbon SVG emblem, floating pill navigation, Games history, future host bids, delegation interest forms, and a protected administration registry.

## Pages

- **Home** — interactive responsive hero, sport mission, overview, historical update.
- **The Games** — documented Greenwick 2025 to 2026 timeline and source links.
- **Applications** — delegation interest and future Games host expressions of interest.
- **About MSC** — mission, values and historical context.
- **Registry** — Supabase Auth sign-in, admin-only tables, approvals, registry entries and CSV export.
- **Contact & Privacy** — administrative contact and data-use explanation.

## Local preview

```bash
python -m http.server 8000
```

Open `http://localhost:8000/#/home`. There is no build step. The frontend works as a design preview before the database is configured, but it **will not falsely claim that unconnected forms submitted successfully**.

## Create a dedicated Supabase project

1. Create a **separate** Supabase project for MSC rather than mixing data with the PMAC or Greenwick Bank projects.
2. In Supabase SQL Editor, execute `supabase/schema.sql`.
3. In `config.js` set `supabaseUrl` to the new project URL and `supabasePublishableKey` to the project's public publishable key (`sb_publishable_...`). This key is explicitly designed to be public, but never include service role or secret keys in the website.
4. In **Authentication → Users**, create **admin@mscgames.cgw** using the supplied password and choose the option to **auto-confirm / mark email verified**. This allows password sign-in without requiring an email verification link. Never place a password in a public website file, migration or GitHub repository.
5. In the SQL Editor, grant registry access to *that authenticated user* by running:

```sql
insert into public.msc_admins (user_id)
select id from auth.users where lower(email) = 'admin@mscgames.cgw'
on conflict (user_id) do nothing;
```

6. Use `#/registry` to sign in and check that the private data loads. Verify that a non-admin account cannot read or modify the tables.
7. For production, add a CAPTCHA and IP-based rate limiting via a Supabase Edge Function or another server-side gateway. The SQL permits anonymous application submissions but has no anti-spam rate limiting by itself.
8. Audit RLS and the Data API permissions after installation. Disable public signups if only administrators need login accounts.

**Important:** Supabase Auth requires a real, working email address for confirmation, password recovery and other messages. `.cgw` is not a publicly routable top-level domain. You can still create a pre-confirmed administrator account in Supabase Auth without sending a verification email, but email-based password recovery will not work unless the address has a functioning mail route.

## Publish on GitHub Pages

1. Create a **public** GitHub repository named `msc-games` under your account.
2. Upload the contents of this directory (not an extra nested directory) to the repository's default branch.
3. In repository Settings → Pages, select **GitHub Actions** as the source. The repository includes `.github/workflows/pages.yml` to publish the static site on each push.
4. Your site will open at `https://YOUR-USERNAME.github.io/msc-games/#/home` when deployment finishes.
5. Set the Supabase project's Auth Site URL to your deployed URL and add the same URL under Auth Redirect URLs if needed.

The site uses hash-based routes intentionally, so deep-linked pages work on GitHub Pages without rewrites.

## Source notes

- [MicroWiki: Micronational Olympic games](https://micronations.wiki/wiki/Micronational_Olympic_games) (MSC section)
- [MSC June 2026 host search / virtual hosting announcement](https://www.reddit.com/r/micronations/comments/1twafi7/msc_games_2026_update_and_host_nations_seeking/)
- [MicroWiki: Micronational Olympic Federation](https://micronations.wiki/wiki/MOF) (distinct organisation; not MSC)

Future Games are represented as *expressions of interest*, not approved fixtures or host announcements.

## Security

- Admin password **not embedded** in HTML, JS or SQL.
- Registry is protected with Supabase Auth and database RLS, not a client-side password comparison.
- Admin rights are attached to a verified Auth user ID in the restricted `msc_admins` table.
- Public visitors can INSERT applications but cannot SELECT them.
- Browser client uses only a public publishable key.
- CSV exports include formula-injection mitigation; handle downloaded personal data securely.
- No Olympiad/IOC endorsement is claimed, and the original mark intentionally avoids copying Olympic rings.

## License

Website files are made for the MSC project. External references and trademarks remain the property of their respective owners.
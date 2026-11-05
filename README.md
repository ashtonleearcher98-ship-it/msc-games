# MSC Games — Micronation Sports Championships

A responsive, GitHub Pages-compatible sporting authority website for the Micronation Sports Championships. Redesigned multicolour athlete emblem, floating pill navigation, Games history, future host bids, delegation interest forms, and a protected administration registry.

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

## Live Supabase deployment

1. Dedicated project **mmetxqmyxhxwmjpxjuzb** is live in the Sydney region, separate from PMAC and banking projects.
2. The private application/registry tables and read-only editions/disciplines/results tables have been created. The base schema is `supabase/schema.sql` and the historical data migration is `supabase/02_games_history.sql`.
3. The deployed `config.js` already contains the dedicated project's API URL and *public* publishable key. Do not replace it with a service role or secret key.
4. **Not yet completed:** in **Authentication → Users**, create **admin@mscgames.cgw** using the supplied password and choose the option to **auto-confirm / mark email verified**. This allows password sign-in without requiring an email verification link. Never place a password in a public website file, migration or GitHub repository.
5. Only after that account exists, in the SQL Editor grant registry access to *that authenticated user* by running:

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

- [Original MSC 2026 Google Sites page](https://sites.google.com/view/msc-2026/msc-games-2026) (provided by the organiser; the automated research fetch could not access its page contents)

Future Games are represented as *expressions of interest*, not approved fixtures or host announcements. Published historical records describe the 2025 postponement and the June 2026 virtual-host transition; no medals, athletes, scores or confirmed schedules have been fabricated.

## Verified deployment checks

- GitHub Actions `Deploy MSC Games to GitHub Pages` completed successfully for the redesign.
- The live database allows anonymous form INSERT, while private applications and admin tables have no anonymous SELECT permission.
- Anonymous delegation and host submissions were tested in rollback transactions without saving fake application rows.
- The new Games archive is publicly readable, while results are only visible if explicitly published.
- An actual admin Auth account is **not yet provisioned**. Creating its verified Auth identity and attaching its `msc_admins` grant still requires the Supabase Dashboard steps above.

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
## Member account registration (November 2026)
The database includes public.msc_member_profiles with user-owned RLS; delegation and host applications have user_id for member tracking. Members can create accounts on the Registry page and update private profiles. Signing up **never** grants administrative access. The administrator must be provisioned separately in Supabase Authentication, marked confirmed, then inserted into public.msc_admins by an authorised project owner.

If immediate signup without email verification is required, the project owner must disable email confirmation in Supabase Dashboard → Authentication → Providers → Email. The GitHub frontend cannot safely change this project-level setting.

## Supplied exact logo
The site is configured to load the user's original unmodified PNG from assets/msc-official.png, with an SVG fallback while the PNG is absent. Upload the exact attached PNG to that path; no trace, redesign or SVG conversion should be used. The GitHub connector currently exposes only UTF-8 file writes, so source changes cannot themselves upload the PNG bytes.

## MSC Superadmin (2026-11-05)
The database role is stored in `public.msc_admins.role`. The existing confirmed `admin@mscgames.cgw` account was promoted to the `superadmin` role, with no password committed to GitHub.
Only this role can make final host-country and delegation decisions. An authorised reviewer opens Registry → Delegations or Host applications and chooses Approve / Reject / Reopen. Database RPC `msc_decide_application` atomically updates the application, creates or revokes an accreditation, and appends `msc_review_audit`. The Accredited nations tab can revoke or restore an approved accreditation via `msc_set_accreditation`; restoration requires a currently approved underlying application. The Decision history tab shows the record of changes. RLS enforces permissions for both functions and tables, independent of the browser interface.
Ordinary micronation members cannot access private applications belonging to other nations, cannot grant themselves staff or Superadmin rights, and cannot publish accreditations.
**Security note:** MSC Superadmin is scoped only to this website and its database, not global Supabase account ownership. Rotate the previously shared initial password, and enable MFA where available.

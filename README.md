# Certification Compass — UAE edition

An interactive guide to tech certifications for software engineers — from fresher to CTO, across 18 roles — rated for the UAE / Dubai job market.

- **My path:** pick your current and target role and level; get Must / Should / Could / Don't need lists, a suggested order and the remaining exam budget.
- **Browse all:** search and filter the full catalogue.
- **UAE sector tracks:** certifications mapped to UAE regulators and sectors (government, banking, healthcare, energy, AI governance, privacy, sovereign cloud).
- **Free first:** credentials that cost nothing.
- **AED / USD switch** in the top bar.
- **Your certifications:** tap the avatar (bottom-right) or "I have this" on any card. Earned certs are ticked and removed from the budget and suggested order.
- **Shareable links:** every selection (tab, role, level, currency, filters and the certs you hold) lives in the URL. "Copy link" shares exactly what you see.

Plain HTML, CSS and JavaScript — no build step, no dependencies.

**Open source.** Repository: [github.com/Vishnuraj910/software-professional-certifications](https://github.com/Vishnuraj910/software-professional-certifications)

## Contributing

Prices, exam codes and retirements change every few months — corrections are the most valuable contribution.

- **Fix a price or link:** edit the entry in `CERTS` in `data.js` and open a pull request with a link to the official exam page as the source.
- **Add a certification:** copy an existing entry in `CERTS`, fill in every field (see *Updating prices* below) and explain in the PR which roles it helps and why.
- **Report a problem:** open an issue with the certification name and what's wrong.

## Files

| File | Purpose |
|---|---|
| `index.html` | Page shell, styles, navigation and the floating avatar |
| `data.js` | Certifications, roles, levels, UAE sectors and shared helpers — edit `CERTS` to add or update entries |
| `app.js` | Rendering, interaction and URL state |
| `favicon.svg` | Site icon |
| `creator.jpg` | Creator photo used in the footer |

Created by Vishnuraj Rajagopal — [vishnuraj.me](https://vishnuraj.me) · [LinkedIn](https://www.linkedin.com/in/vishnurajrajagopal)

## Deploy

1. On GitHub, create a repository (or open an existing one) and choose **Add file → Upload files**. Drag in the contents of this folder and commit.
2. In Vercel, choose **Add New → Project**, import the repository and keep the defaults (Framework preset: **Other**, no build command, output directory: root). Click **Deploy**.

If you put the files in a sub-folder of the repo, set Vercel's **Root Directory** to that folder.

**Analytics:** `index.html` already loads Vercel Web Analytics (the plain-HTML version of `@vercel/analytics`). In your Vercel project, open **Analytics** and click **Enable**; data appears after the next deployment. The script only works on Vercel, so locally it simply 404s and does nothing.

To run locally, open `index.html` in a browser, or serve the folder with `npx serve .`.

## Updating prices

Each entry in `CERTS` (in `data.js`) has `usd` (number, `0` for free, `null` for retired), optional `aed` (an official AED price that overrides the 3.6725 peg conversion), `approx: true` for variable prices, `sub` for a note such as member pricing, `url`, `r` (rating out of 10) and `lv` (the career-level range where it is most useful: 0 = fresher … 6 = director/CTO). Role relevance is set with `m` (must), `s` (should), `c` (could) and `x` (don't need) lists of role keys.

Prices were checked in October 2026. Exam catalogues and fees change often — confirm on the exam page before booking.

# Woolly Bugger Chalet: website and calendar sync setup

This folder is the whole website. GitHub hosts it for free and checks your Airbnb and VRBO calendars every 30 minutes, so the calendar on your site stays current.

## What's in here

| File | What it does |
|---|---|
| `index.html` | The website |
| `availability.json` | The booked dates the calendar shows. The sync rewrites it, so don't edit it. It starts with example dates. |
| `direct-bookings.json` | Where you add stays booked through your own site |
| `calendar.ics` | Created by the sync. Airbnb and VRBO import it so they block your direct bookings. |
| `sync-availability.mjs` | The sync script |
| `.github/workflows/sync-calendar.yml` | Runs the sync every 30 minutes |

## 1. Get your calendar links

**Airbnb:** Go to Listings, open Woolly Bugger Chalet, then Availability. Under Connect calendars, choose **Export calendar** and copy the link that ends in `.ics`.

**VRBO:** Go to the Calendar, then **Import & Export**, then **Export**, and copy the link.

These links are private. Anyone who has them can see your booked dates, so keep them only in the GitHub secrets below.

## 2. Put the site on GitHub (free)

1. Create a free account at github.com.
2. Create a new **public** repository, for example `woollybuggerchalet`.
3. Choose **Add file → Upload files** and upload everything in this folder, including the `.github` folder. If the upload skips `.github`, use **Add file → Create new file**, name it `.github/workflows/sync-calendar.yml`, and paste in the contents of that file.
4. Go to **Settings → Secrets and variables → Actions → New repository secret** and add:
   - `AIRBNB_ICAL_URL`: your Airbnb link
   - `VRBO_ICAL_URL`: your VRBO link
5. Go to **Settings → Pages**, set Source to **Deploy from a branch**, choose branch `main`, folder `/ (root)`, and save.
6. Go to **Actions**, choose **Sync Airbnb + VRBO calendars**, and click **Run workflow**. In about a minute the example dates are replaced with your real ones.

Your site will be at `https://YOUR-USERNAME.github.io/woollybuggerchalet/`. To use your own domain, such as woollybuggerchalet.com, enter it under Settings → Pages → Custom domain and follow GitHub's DNS steps.

## 3. Block direct bookings on Airbnb and VRBO

When someone books with you directly:

1. Open `direct-bookings.json` on GitHub, click the pencil icon, and add the stay:
   ```json
   "bookings": [
     { "start": "2027-02-12", "end": "2027-02-15" }
   ]
   ```
   `start` is the check-in date and `end` is the checkout date. Leave guest names out, because this file is public.
2. Commit the change. The sync runs right away and updates your site and `calendar.ics`.

You only need to do this once: give Airbnb and VRBO your `calendar.ics` link so they pick up direct bookings on their own.
- **Airbnb:** Availability → Connect calendars → **Import calendar**, then paste `https://YOUR-SITE/calendar.ics`
- **VRBO:** Calendar → Import & Export → **Import**, then paste the same link

## Good to know

- Airbnb and VRBO update their exported calendars every few hours, and the sync checks every 30 minutes. A brand-new booking can therefore take a few hours to appear. For last-minute requests, check availability before you confirm.
- If Airbnb or VRBO can't be reached, the sync leaves the existing dates in place. Your site won't show booked dates as open.
- If you have a minimum stay, change `MIN_NIGHTS` near the bottom of `index.html` (for example, `const MIN_NIGHTS = 2;`).

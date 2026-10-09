// Woolly Bugger Chalet: calendar sync
//
// Pulls the Airbnb and VRBO iCal calendars, adds your direct bookings, and writes:
//   availability.json  the booked nights the website calendar shows (no guest names or sources)
//   calendar.ics       your direct bookings, for Airbnb and VRBO to import so they block those dates too
//
// Run with Node 18 or newer, no packages needed:
//   AIRBNB_ICAL_URL="https://www.airbnb.com/calendar/ical/....ics" \
//   VRBO_ICAL_URL="https://www.vrbo.com/icalendar/....ics" \
//   node sync-availability.mjs
//
// If a calendar can't be downloaded, the script stops without changing anything,
// so the website never shows booked dates as open.

import { readFile, writeFile } from "node:fs/promises";

const FEEDS = [
  { source: "Airbnb", url: process.env.AIRBNB_ICAL_URL },
  { source: "VRBO", url: process.env.VRBO_ICAL_URL },
].filter(f => f.url);

const OUT_JSON = "availability.json";
const OUT_ICS = "calendar.ics";
const DIRECT_FILE = "direct-bookings.json";

const today = new Date().toISOString().slice(0, 10);

function addDays(s, n) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

// Read an .ics file into [{start, end}] date ranges. `end` is the checkout day (not a booked night).
export function parseIcs(text) {
  const lines = text.replace(/\r?\n[ \t]/g, "").split(/\r?\n/); // unfold wrapped lines
  const events = [];
  let cur = null;
  for (const line of lines) {
    if (line === "BEGIN:VEVENT") cur = {};
    else if (line === "END:VEVENT") {
      if (cur && cur.start) {
        if (!cur.end || cur.end <= cur.start) cur.end = addDays(cur.start, 1);
        events.push({ start: cur.start, end: cur.end });
      }
      cur = null;
    } else if (cur) {
      const m = line.match(/^(DTSTART|DTEND)[^:]*:(\d{4})(\d{2})(\d{2})/);
      if (m) cur[m[1] === "DTSTART" ? "start" : "end"] = `${m[2]}-${m[3]}-${m[4]}`;
    }
  }
  return events;
}

// Combine overlapping or back-to-back stays into single ranges.
export function mergeRanges(ranges) {
  const sorted = ranges.filter(r => r.end > today).sort((a, b) => a.start.localeCompare(b.start));
  const out = [];
  for (const r of sorted) {
    const last = out[out.length - 1];
    if (last && r.start <= last.end) { if (r.end > last.end) last.end = r.end; }
    else out.push({ start: r.start, end: r.end });
  }
  return out;
}

async function load(url) {
  if (!/^https?:/.test(url)) return readFile(url, "utf8"); // local file, for testing
  const res = await fetch(url, { headers: { "User-Agent": "WoollyBuggerChalet-CalendarSync/1.0" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  if (!text.includes("BEGIN:VCALENDAR")) throw new Error("response is not a calendar");
  return text;
}

function toIcs(direct) {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
  const d = s => s.replace(/-/g, "");
  const events = direct.map((b, i) => [
    "BEGIN:VEVENT",
    `UID:direct-${d(b.start)}-${d(b.end)}-${i}@woollybuggerchalet`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${d(b.start)}`,
    `DTEND;VALUE=DATE:${d(b.end)}`,
    "SUMMARY:Reserved (direct booking)",
    "END:VEVENT",
  ].join("\r\n"));
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Woolly Bugger Chalet//Direct bookings//EN",
    "CALSCALE:GREGORIAN", ...events, "END:VCALENDAR", ""].join("\r\n");
}

async function main() {
  if (!FEEDS.length) throw new Error("Set AIRBNB_ICAL_URL and/or VRBO_ICAL_URL.");

  const all = [];
  for (const f of FEEDS) {
    try {
      const events = parseIcs(await load(f.url));
      console.log(`${f.source}: ${events.length} blocked stays`);
      all.push(...events);
    } catch (e) {
      throw new Error(`Couldn't read the ${f.source} calendar (${e.message}). Nothing was changed.`);
    }
  }

  let direct = [];
  try { direct = JSON.parse(await readFile(DIRECT_FILE, "utf8")).bookings || []; } catch { /* none yet */ }
  direct = direct.filter(b => /^\d{4}-\d{2}-\d{2}$/.test(b.start) && /^\d{4}-\d{2}-\d{2}$/.test(b.end) && b.end > b.start);
  console.log(`Direct: ${direct.length} bookings`);
  all.push(...direct);

  const booked = mergeRanges(all);

  // Only rewrite availability.json when the booked dates actually change.
  let previous = null;
  try { previous = JSON.parse(await readFile(OUT_JSON, "utf8")); } catch {}
  if (previous && !previous.sample && JSON.stringify(previous.booked) === JSON.stringify(booked)) {
    console.log("No changes to availability.");
  } else {
    await writeFile(OUT_JSON, JSON.stringify({ updated: new Date().toISOString(), booked }, null, 2) + "\n");
    console.log(`Wrote ${OUT_JSON}: ${booked.length} booked ranges`);
  }
  await writeFile(OUT_ICS, toIcs(direct.filter(b => b.end > today)));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(e => { console.error(e.message); process.exit(1); });
}

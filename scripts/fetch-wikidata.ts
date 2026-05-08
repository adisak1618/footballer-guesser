// Fetch raw player data from Wikidata for 15 famous football clubs.
// Run: bun run scripts/fetch-wikidata.ts
// Output: data/raw/wikidata-{slug}.json (one per club)
//
// Reads no env vars. No rate limits worth worrying about (Wikidata public
// endpoint). Re-run any time to refresh.

import { writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(HERE, "..", "data", "raw");

type League = "premier-league" | "la-liga" | "serie-a" | "bundesliga" | "ligue-1";
type Club = { qid: string; slug: string; name: string; league: League };

const CLUBS: readonly Club[] = [
  // Premier League — current 2025-26 season (20 clubs)
  { qid: "Q1130849", slug: "liverpool",       name: "Liverpool F.C.",                  league: "premier-league" },
  { qid: "Q18656",   slug: "man-united",      name: "Manchester United F.C.",          league: "premier-league" },
  { qid: "Q9617",    slug: "arsenal",         name: "Arsenal F.C.",                    league: "premier-league" },
  { qid: "Q9616",    slug: "chelsea",         name: "Chelsea F.C.",                    league: "premier-league" },
  { qid: "Q50602",   slug: "man-city",        name: "Manchester City F.C.",            league: "premier-league" },
  { qid: "Q18741",   slug: "tottenham",       name: "Tottenham Hotspur F.C.",          league: "premier-league" },
  { qid: "Q19568",   slug: "bournemouth",     name: "AFC Bournemouth",                 league: "premier-league" },
  { qid: "Q18711",   slug: "aston-villa",     name: "Aston Villa F.C.",                league: "premier-league" },
  { qid: "Q19571",   slug: "brentford",       name: "Brentford F.C.",                  league: "premier-league" },
  { qid: "Q19453",   slug: "brighton",        name: "Brighton & Hove Albion F.C.",     league: "premier-league" },
  { qid: "Q19458",   slug: "burnley",         name: "Burnley F.C.",                    league: "premier-league" },
  { qid: "Q19467",   slug: "crystal-palace",  name: "Crystal Palace F.C.",             league: "premier-league" },
  { qid: "Q5794",    slug: "everton",         name: "Everton F.C.",                    league: "premier-league" },
  { qid: "Q18708",   slug: "fulham",          name: "Fulham F.C.",                     league: "premier-league" },
  { qid: "Q1128631", slug: "leeds",           name: "Leeds United F.C.",               league: "premier-league" },
  { qid: "Q18716",   slug: "newcastle",       name: "Newcastle United F.C.",           league: "premier-league" },
  { qid: "Q19490",   slug: "nottingham",      name: "Nottingham Forest F.C.",          league: "premier-league" },
  { qid: "Q18739",   slug: "sunderland",      name: "Sunderland A.F.C.",               league: "premier-league" },
  { qid: "Q18747",   slug: "west-ham",        name: "West Ham United F.C.",            league: "premier-league" },
  { qid: "Q19500",   slug: "wolves",          name: "Wolverhampton Wanderers F.C.",    league: "premier-league" },
  // La Liga
  { qid: "Q8682",    slug: "real-madrid", name: "Real Madrid CF",          league: "la-liga" },
  { qid: "Q7156",    slug: "barcelona",   name: "FC Barcelona",            league: "la-liga" },
  { qid: "Q8701",    slug: "atletico",    name: "Atlético Madrid",         league: "la-liga" },
  // Serie A
  { qid: "Q1543",    slug: "ac-milan",    name: "AC Milan",                league: "serie-a" },
  { qid: "Q631",     slug: "inter",       name: "Inter Milan",             league: "serie-a" },
  { qid: "Q1422",    slug: "juventus",    name: "Juventus FC",             league: "serie-a" },
  // Bundesliga
  { qid: "Q15789",   slug: "bayern",      name: "FC Bayern Munich",        league: "bundesliga" },
  { qid: "Q41420",   slug: "dortmund",    name: "Borussia Dortmund",       league: "bundesliga" },
  // Ligue 1
  { qid: "Q483020",  slug: "psg",         name: "Paris Saint-Germain FC",  league: "ligue-1" },
];

const SPARQL_ENDPOINT = "https://query.wikidata.org/sparql";

const sparqlQuery = (clubQid: string) => `
SELECT ?player ?playerLabel ?playerLabelTh ?dob ?sitelinks
       (GROUP_CONCAT(DISTINCT ?nationalityLabel; separator="|") AS ?nationalities)
       (GROUP_CONCAT(DISTINCT ?clubLabel;        separator="|") AS ?clubs)
       (GROUP_CONCAT(DISTINCT ?positionLabel;    separator="|") AS ?positions)
       (SAMPLE(?goals) AS ?goalsTotal)
WHERE {
  ?player wdt:P54 wd:${clubQid} .
  ?player wdt:P106 wd:Q937857 .

  OPTIONAL { ?player wdt:P27 ?nationality .
             ?nationality rdfs:label ?nationalityLabel .
             FILTER(LANG(?nationalityLabel)="en") }
  OPTIONAL { ?player wdt:P569 ?dob . }
  OPTIONAL { ?player wdt:P1351 ?goals . }
  OPTIONAL { ?player wikibase:sitelinks ?sitelinks . }
  OPTIONAL { ?player wdt:P54 ?club .
             ?club rdfs:label ?clubLabel .
             FILTER(LANG(?clubLabel)="en") }
  OPTIONAL { ?player wdt:P413 ?position .
             ?position rdfs:label ?positionLabel .
             FILTER(LANG(?positionLabel)="en") }
  OPTIONAL { ?player rdfs:label ?playerLabelTh .
             FILTER(LANG(?playerLabelTh)="th") }

  SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
}
GROUP BY ?player ?playerLabel ?playerLabelTh ?dob ?sitelinks
`;

async function fetchClub(club: Club): Promise<unknown> {
  const url = new URL(SPARQL_ENDPOINT);
  url.searchParams.set("format", "json");
  url.searchParams.set("query", sparqlQuery(club.qid));

  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Headball-Seed/1.0 (https://github.com/adisakchaiyakul/board-game; adisakchaiyakul@gmail.com) bun/typescript",
      Accept: "application/sparql-results+json",
    },
  });

  if (!res.ok) {
    throw new Error(
      `SPARQL query failed for ${club.slug} (${club.qid}): ${res.status} ${res.statusText}`
    );
  }
  return res.json();
}

async function main(): Promise<void> {
  await mkdir(OUT_DIR, { recursive: true });

  let total = 0;
  for (const club of CLUBS) {
    process.stdout.write(
      `[${club.league.padEnd(14)} / ${club.slug.padEnd(12)}] fetching... `,
    );
    const start = Date.now();

    try {
      const data = (await fetchClub(club)) as {
        results: { bindings: unknown[] };
      };
      const count = data.results.bindings.length;
      total += count;
      const dur = Date.now() - start;

      const leagueDir = join(OUT_DIR, club.league);
      await mkdir(leagueDir, { recursive: true });
      const path = join(leagueDir, `${club.slug}.json`);
      await writeFile(path, JSON.stringify(data, null, 2));
      console.log(`${String(count).padStart(5)} rows  (${dur}ms)`);
    } catch (err) {
      console.log(`FAILED: ${(err as Error).message}`);
      throw err;
    }

    // Be a good citizen on the public endpoint.
    await new Promise((r) => setTimeout(r, 1000));
  }

  console.log(`\nDone. ${total} total rows across ${CLUBS.length} clubs.`);
  console.log(`Raw data in: ${OUT_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

// Fetch raw player data from Wikidata for the clubs in CLUBS.
// Run: bun run scripts/fetch-wikidata.ts            (skip clubs already on disk)
//      bun run scripts/fetch-wikidata.ts --force    (re-fetch every club)
// Output: data/raw/{league}/{club}.json
//
// Reads no env vars. No rate limits worth worrying about (Wikidata public
// endpoint). Default skip-if-exists keeps re-runs cheap when you only added
// a new club; use --force when you want fresh data for everyone (transfers,
// new player additions on Wikidata, etc.).

import { writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const FORCE = process.argv.includes("--force");

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
  // La Liga — current 2025-26 season (20 clubs)
  { qid: "Q8682",    slug: "real-madrid",     name: "Real Madrid CF",                  league: "la-liga" },
  { qid: "Q7156",    slug: "barcelona",       name: "FC Barcelona",                    league: "la-liga" },
  { qid: "Q8701",    slug: "atletico",        name: "Atlético Madrid",                 league: "la-liga" },
  { qid: "Q290781",  slug: "almeria",         name: "AD Almería",                      league: "la-liga" },
  { qid: "Q8687",    slug: "athletic",        name: "Athletic Club",                   league: "la-liga" },
  { qid: "Q10286",   slug: "osasuna",         name: "Club Atlético Osasuna",           league: "la-liga" },
  { qid: "Q223620",  slug: "alaves",          name: "Deportivo Alavés",                league: "la-liga" },
  { qid: "Q10512",   slug: "elche",           name: "Elche CF",                        league: "la-liga" },
  { qid: "Q8806",    slug: "getafe",          name: "Getafe CF",                       league: "la-liga" },
  { qid: "Q11945",   slug: "girona",          name: "Girona FC",                       league: "la-liga" },
  { qid: "Q8823",    slug: "levante",         name: "Levante UD",                      league: "la-liga" },
  { qid: "Q8749",    slug: "celta",           name: "RC Celta de Vigo",                league: "la-liga" },
  { qid: "Q8780",    slug: "espanyol",        name: "RCD Espanyol de Barcelona",       league: "la-liga" },
  { qid: "Q8835",    slug: "mallorca",        name: "RCD Mallorca",                    league: "la-liga" },
  { qid: "Q10300",   slug: "rayo-vallecano",  name: "Rayo Vallecano",                  league: "la-liga" },
  { qid: "Q8723",    slug: "betis",           name: "Real Betis Balompié",             league: "la-liga" },
  { qid: "Q271574",  slug: "oviedo",          name: "Real Oviedo",                     league: "la-liga" },
  { qid: "Q10315",   slug: "real-sociedad",   name: "Real Sociedad",                   league: "la-liga" },
  { qid: "Q10329",   slug: "sevilla",         name: "Sevilla FC",                      league: "la-liga" },
  { qid: "Q10333",   slug: "valencia",        name: "Valencia CF",                     league: "la-liga" },
  { qid: "Q12297",   slug: "villarreal",      name: "Villarreal CF",                   league: "la-liga" },
  // Serie A — current 2025-26 season (20 clubs)
  { qid: "Q1543",    slug: "ac-milan",        name: "AC Milan",                        league: "serie-a" },
  { qid: "Q631",     slug: "inter",           name: "Inter Milan",                     league: "serie-a" },
  { qid: "Q1422",    slug: "juventus",        name: "Juventus FC",                     league: "serie-a" },
  { qid: "Q2052",    slug: "fiorentina",      name: "ACF Fiorentina",                  league: "serie-a" },
  { qid: "Q2739",    slug: "roma",            name: "AS Roma",                         league: "serie-a" },
  { qid: "Q1886",    slug: "atalanta",        name: "Atalanta BC",                     league: "serie-a" },
  { qid: "Q1893",    slug: "bologna",         name: "Bologna F.C. 1909",               league: "serie-a" },
  { qid: "Q1900",    slug: "cagliari",        name: "Cagliari Calcio",                 league: "serie-a" },
  { qid: "Q1120838", slug: "como",            name: "Como 1907",                       league: "serie-a" },
  { qid: "Q2074",    slug: "genoa",           name: "Genoa CFC",                       league: "serie-a" },
  { qid: "Q8639",    slug: "verona",          name: "Hellas Verona FC",                league: "serie-a" },
  { qid: "Q2693",    slug: "parma",           name: "Parma Calcio 1913",               league: "serie-a" },
  { qid: "Q289613",  slug: "pisa",            name: "Pisa SC",                         league: "serie-a" },
  { qid: "Q2609",    slug: "lazio",           name: "SS Lazio",                        league: "serie-a" },
  { qid: "Q2641",    slug: "napoli",          name: "SSC Napoli",                      league: "serie-a" },
  { qid: "Q2768",    slug: "torino",          name: "Torino FC",                       league: "serie-a" },
  { qid: "Q759482",  slug: "cremonese",       name: "US Cremonese",                    league: "serie-a" },
  { qid: "Q13391",   slug: "lecce",           name: "US Lecce",                        league: "serie-a" },
  { qid: "Q8603",    slug: "sassuolo",        name: "US Sassuolo Calcio",              league: "serie-a" },
  { qid: "Q2798",    slug: "udinese",         name: "Udinese Calcio",                  league: "serie-a" },
  // Bundesliga — current 2025-26 season (17 with full Wikidata coverage)
  { qid: "Q15789",   slug: "bayern",          name: "FC Bayern Munich",                league: "bundesliga" },
  { qid: "Q41420",   slug: "dortmund",        name: "Borussia Dortmund",               league: "bundesliga" },
  { qid: "Q162251",  slug: "heidenheim",      name: "1. FC Heidenheim 1846",           league: "bundesliga" },
  { qid: "Q104770",  slug: "koln",            name: "1. FC Köln",                      league: "bundesliga" },
  { qid: "Q141971",  slug: "union-berlin",    name: "1. FC Union Berlin",              league: "bundesliga" },
  { qid: "Q105254",  slug: "mainz",           name: "1. FSV Mainz 05",                 league: "bundesliga" },
  { qid: "Q104761",  slug: "leverkusen",      name: "Bayer 04 Leverkusen",             league: "bundesliga" },
  { qid: "Q101959",  slug: "monchengladbach", name: "Borussia Mönchengladbach",        league: "bundesliga" },
  { qid: "Q38245",   slug: "frankfurt",       name: "Eintracht Frankfurt",             league: "bundesliga" },
  { qid: "Q6463",    slug: "st-pauli",        name: "FC St. Pauli",                    league: "bundesliga" },
  { qid: "Q51974",   slug: "hamburg",         name: "Hamburger SV",                    league: "bundesliga" },
  { qid: "Q702455",  slug: "rb-leipzig",      name: "RB Leipzig",                      league: "bundesliga" },
  { qid: "Q106394",  slug: "freiburg",        name: "SC Freiburg",                     league: "bundesliga" },
  { qid: "Q51976",   slug: "werder-bremen",   name: "SV Werder Bremen",                league: "bundesliga" },
  { qid: "Q22707",   slug: "hoffenheim",      name: "TSG 1899 Hoffenheim",             league: "bundesliga" },
  { qid: "Q4512",    slug: "stuttgart",       name: "VfB Stuttgart",                   league: "bundesliga" },
  { qid: "Q101859",  slug: "wolfsburg",       name: "VfL Wolfsburg",                   league: "bundesliga" },
  // Ligue 1 — current 2025-26 season (18 clubs)
  { qid: "Q483020",  slug: "psg",             name: "Paris Saint-Germain FC",          league: "ligue-1" },
  { qid: "Q182876",  slug: "auxerre",         name: "AJ Auxerre",                      league: "ligue-1" },
  { qid: "Q180305",  slug: "monaco",          name: "AS Monaco FC",                    league: "ligue-1" },
  { qid: "Q845137",  slug: "angers",          name: "Angers SCO",                      league: "ligue-1" },
  { qid: "Q48911",   slug: "lorient",         name: "F.C. Lorient",                    league: "ligue-1" },
  { qid: "Q221525",  slug: "metz",            name: "FC Metz",                         league: "ligue-1" },
  { qid: "Q192071",  slug: "nantes",          name: "FC Nantes",                       league: "ligue-1" },
  { qid: "Q328658",  slug: "le-havre",        name: "Le Havre AC",                     league: "ligue-1" },
  { qid: "Q19516",   slug: "lille",           name: "Lille OSC",                       league: "ligue-1" },
  { qid: "Q185163",  slug: "nice",            name: "OGC Nice",                        league: "ligue-1" },
  { qid: "Q704",     slug: "lyon",            name: "Olympique Lyonnais",              league: "ligue-1" },
  { qid: "Q132885",  slug: "marseille",       name: "Olympique de Marseille",          league: "ligue-1" },
  { qid: "Q1051013", slug: "paris-fc",        name: "Paris FC",                        league: "ligue-1" },
  { qid: "Q191843",  slug: "lens",            name: "R.C. Lens",                       league: "ligue-1" },
  { qid: "Q126334",  slug: "strasbourg",      name: "RC Strasbourg Alsace",            league: "ligue-1" },
  { qid: "Q218372",  slug: "brest",           name: "Stade Brestois 29",               league: "ligue-1" },
  { qid: "Q19509",   slug: "rennes",          name: "Stade Rennais F.C.",              league: "ligue-1" },
  { qid: "Q19518",   slug: "toulouse",        name: "Toulouse FC",                     league: "ligue-1" },
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
  if (FORCE) console.log("--force: re-fetching every club\n");

  let total = 0;
  let skipped = 0;
  for (const club of CLUBS) {
    const leagueDir = join(OUT_DIR, club.league);
    const path = join(leagueDir, `${club.slug}.json`);

    if (!FORCE && existsSync(path)) {
      console.log(
        `[${club.league.padEnd(14)} / ${club.slug.padEnd(14)}] cached, skip`,
      );
      skipped++;
      continue;
    }

    process.stdout.write(
      `[${club.league.padEnd(14)} / ${club.slug.padEnd(14)}] fetching... `,
    );
    const start = Date.now();

    try {
      const data = (await fetchClub(club)) as {
        results: { bindings: unknown[] };
      };
      const count = data.results.bindings.length;
      total += count;
      const dur = Date.now() - start;

      await mkdir(leagueDir, { recursive: true });
      await writeFile(path, JSON.stringify(data, null, 2));
      console.log(`${String(count).padStart(5)} rows  (${dur}ms)`);
    } catch (err) {
      console.log(`FAILED: ${(err as Error).message}`);
      throw err;
    }

    // Be a good citizen on the public endpoint.
    await new Promise((r) => setTimeout(r, 1000));
  }

  const fetched = CLUBS.length - skipped;
  console.log(
    `\nDone. ${fetched} fetched (${total} new rows), ${skipped} cached. Re-run with --force to refresh cached clubs.`,
  );
  console.log(`Raw data in: ${OUT_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

// Build the curated seed JSON from raw Wikidata dumps.
// Run: bun run scripts/build-seed.ts
//
// Inputs:  data/raw/wikidata-*.json
// Outputs: data/seed/players.json
//          data/seed/categories.json   (regenerated only if missing)
//          data/premier-league.ts      (client-side autocomplete dictionary)

import { readFile, readdir, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const RAW_DIR = join(ROOT, "data", "raw");
const SEED_DIR = join(ROOT, "data", "seed");
const CLIENT_DICT_PATH = join(ROOT, "data", "premier-league.ts");

// ---------- Wikidata SPARQL row shape ----------

type SparqlBinding = {
  player: { value: string };
  playerLabel?: { value: string };
  playerLabelTh?: { value: string };
  dob?: { value: string };
  sitelinks?: { value: string };
  nationalities?: { value: string };
  clubs?: { value: string };
  positions?: { value: string };
  goalsTotal?: { value: string };
};

type SparqlFile = { results: { bindings: SparqlBinding[] } };

// ---------- Output player shape ----------

type Position = "GK" | "DEF" | "MID" | "FWD";
type Tier = 1 | 2 | 3 | 4;

type Player = {
  id: string;            // Wikidata QID (e.g., "Q10520")
  name: string;
  name_th: string | null;
  aliases: string[];
  nationalities: string[];
  birth_date: string | null;
  position: Position | null;
  clubs_named: string[];
  career_goals: number | null;
  sitelinks: number;
  difficulty_tier: Tier;
};

// ---------- Helpers ----------

function qidFromUri(uri: string): string {
  return uri.split("/").pop() ?? uri;
}

function splitPipe(value: string | undefined): string[] {
  if (!value) return [];
  return Array.from(new Set(value.split("|").map((s) => s.trim()).filter(Boolean)));
}

function isClubLikeTeam(label: string): boolean {
  // Filter out national teams and youth selections.
  const lower = label.toLowerCase();
  if (lower.includes("national")) return false;
  if (lower.includes(" under-")) return false;
  if (lower.includes("under-1") || lower.includes("under-2")) return false;
  return true;
}

function normalizePosition(raw: string | undefined): Position | null {
  if (!raw) return null;
  // SPARQL returned a possibly pipe-joined list; first valid wins.
  for (const part of raw.split("|").map((p) => p.trim().toLowerCase())) {
    if (!part) continue;
    if (part.includes("goalkeeper") || part.includes("goalie")) return "GK";
    if (part.includes("midfielder") || part.includes("midfield")) return "MID";
    if (part.includes("forward") || part.includes("striker") || part.includes("winger"))
      return "FWD";
    if (part.includes("defender") || part.endsWith("back") || part.includes("sweeper"))
      return "DEF";
  }
  return null;
}

function tierFromSitelinks(n: number): Tier {
  if (n >= 80) return 1;
  if (n >= 60) return 2;
  if (n >= 40) return 3;
  return 4;
}

function generateAliases(name: string, nameTh: string | null): string[] {
  const out = new Set<string>();
  // Last word of name (e.g., "Salah", "Beckham", "Alexander-Arnold")
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) out.add(parts[parts.length - 1]);
  // Strip diacritics for typo tolerance
  const stripped = name.normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (stripped !== name) out.add(stripped);
  // Last word of Thai name
  if (nameTh) {
    const thParts = nameTh.trim().split(/\s+/);
    if (thParts.length >= 2) out.add(thParts[thParts.length - 1]);
  }
  return Array.from(out);
}

function shouldKeep(row: SparqlBinding): boolean {
  const sitelinks = Number(row.sitelinks?.value ?? "0");
  const hasThaiLabel = !!row.playerLabelTh;
  const passesFameGate = sitelinks >= 30 || hasThaiLabel;
  if (!passesFameGate) return false;

  // Football credibility gate: real footballers have either a recorded
  // position OR multiple career clubs. Excludes celebrities (actors,
  // politicians) who happened to be on a youth roster — Wikidata tags them
  // as occupation:footballer for that brief stint.
  const hasPosition = !!row.positions?.value;
  const clubCount = splitPipe(row.clubs?.value).filter(isClubLikeTeam).length;
  return hasPosition || clubCount >= 2;
}

// ---------- Pipeline ----------

async function loadAllRaw(): Promise<SparqlBinding[]> {
  const files = (await readdir(RAW_DIR)).filter((f) =>
    f.startsWith("wikidata-") && f.endsWith(".json"),
  );
  const allRows: SparqlBinding[] = [];
  for (const file of files) {
    const raw = await readFile(join(RAW_DIR, file), "utf8");
    const parsed = JSON.parse(raw) as SparqlFile;
    allRows.push(...parsed.results.bindings);
  }
  return allRows;
}

function dedupeAndKeep(rows: SparqlBinding[]): Map<string, SparqlBinding> {
  // Keep one row per QID. If duplicates, prefer the row with the highest sitelinks
  // (which usually has the most-complete club list since GROUP_CONCAT in the
  // per-club query was scoped to that club's traversal context).
  const byQid = new Map<string, SparqlBinding>();
  for (const row of rows) {
    if (!shouldKeep(row)) continue;
    const qid = qidFromUri(row.player.value);
    const existing = byQid.get(qid);
    if (!existing) {
      byQid.set(qid, row);
      continue;
    }
    const existingClubs = splitPipe(existing.clubs?.value).length;
    const newClubs = splitPipe(row.clubs?.value).length;
    if (newClubs > existingClubs) byQid.set(qid, row);
  }
  return byQid;
}

function shapePlayer(qid: string, row: SparqlBinding): Player {
  const allClubs = splitPipe(row.clubs?.value);
  const clubsNamed = allClubs.filter(isClubLikeTeam);
  const nationalities = splitPipe(row.nationalities?.value);
  const sitelinks = Number(row.sitelinks?.value ?? "0");
  const dob = row.dob?.value ?? null;
  const name = row.playerLabel?.value ?? "(unnamed)";
  const nameTh = row.playerLabelTh?.value ?? null;

  return {
    id: qid,
    name,
    name_th: nameTh,
    aliases: generateAliases(name, nameTh),
    nationalities,
    birth_date: dob ? dob.slice(0, 10) : null,
    position: normalizePosition(row.positions?.value),
    clubs_named: clubsNamed,
    career_goals: row.goalsTotal?.value ? Number(row.goalsTotal.value) : null,
    sitelinks,
    difficulty_tier: tierFromSitelinks(sitelinks),
  };
}

const DEFAULT_CATEGORIES = {
  version: 1,
  categories: [
    {
      slug: "premier-league-alumni",
      label_th: "เคยเล่นในพรีเมียร์ลีก",
      label_en: "Played for a Premier League big-six club",
      query: {
        any: [
          { field: "clubs_named", op: "contains", value: "Liverpool F.C." },
          { field: "clubs_named", op: "contains", value: "Manchester United F.C." },
          { field: "clubs_named", op: "contains", value: "Arsenal F.C." },
          { field: "clubs_named", op: "contains", value: "Chelsea F.C." },
          { field: "clubs_named", op: "contains", value: "Manchester City F.C." },
          { field: "clubs_named", op: "contains", value: "Tottenham Hotspur F.C." },
        ],
      },
    },
    {
      slug: "liverpool",
      label_th: "เคยเล่นให้ลิเวอร์พูล",
      label_en: "Played for Liverpool",
      query: { field: "clubs_named", op: "contains", value: "Liverpool F.C." },
    },
    {
      slug: "english",
      label_th: "นักเตะอังกฤษ",
      label_en: "English nationality",
      query: { field: "nationalities", op: "contains", value: "United Kingdom" },
    },
    {
      slug: "brazilian",
      label_th: "นักเตะบราซิล",
      label_en: "Brazilian nationality",
      query: { field: "nationalities", op: "contains", value: "Brazil" },
    },
    {
      slug: "real-and-chelsea",
      label_th: "เคยเล่นให้ทั้งเรอัลและเชลซี",
      label_en: "Played for Real Madrid AND Chelsea",
      query: {
        all: [
          { field: "clubs_named", op: "contains", value: "Real Madrid Club de Fútbol" },
          { field: "clubs_named", op: "contains", value: "Chelsea F.C." },
        ],
      },
    },
    {
      slug: "goalkeepers",
      label_th: "ผู้รักษาประตู",
      label_en: "Goalkeepers",
      query: { field: "position", op: "eq", value: "GK" },
    },
    {
      slug: "legends",
      label_th: "ตำนาน",
      label_en: "All-time legends (tier 1)",
      query: { field: "difficulty_tier", op: "eq", value: 1 },
    },
  ],
};

function regenerateClientDictionary(players: Player[]): string {
  const sorted = [...players].sort((a, b) => b.sitelinks - a.sitelinks);
  const names = sorted.map((p) => `  ${JSON.stringify(p.name)},`).join("\n");
  return `// Auto-generated from data/seed/players.json by scripts/build-seed.ts.
// DO NOT EDIT BY HAND. Re-run: bun run seed:build
//
// Bundled at build time for client-side prefix matching in the guess input.

export const PREMIER_LEAGUE_NAMES: readonly string[] = [
${names}
] as const;
`;
}

async function main(): Promise<void> {
  await mkdir(SEED_DIR, { recursive: true });

  const rawRows = await loadAllRaw();
  console.log(`Loaded ${rawRows.length} raw rows from ${RAW_DIR}`);

  const deduped = dedupeAndKeep(rawRows);
  console.log(`After fame filter + dedup: ${deduped.size} players`);

  const players: Player[] = [];
  for (const [qid, row] of deduped) players.push(shapePlayer(qid, row));

  // Sort by sitelinks descending so JSON file is human-skimmable
  players.sort((a, b) => b.sitelinks - a.sitelinks);

  // Tier breakdown
  const tierCounts = { 1: 0, 2: 0, 3: 0, 4: 0 } as Record<Tier, number>;
  for (const p of players) tierCounts[p.difficulty_tier]++;
  console.log(
    `Tiers: 1=${tierCounts[1]}  2=${tierCounts[2]}  3=${tierCounts[3]}  4=${tierCounts[4]}`,
  );

  // Stats
  const withThai = players.filter((p) => p.name_th).length;
  const withPosition = players.filter((p) => p.position).length;
  const withGoals = players.filter((p) => p.career_goals).length;
  console.log(
    `Coverage: thai=${withThai}/${players.length}  position=${withPosition}/${players.length}  career_goals=${withGoals}/${players.length}`,
  );

  // Write players.json
  const playersPath = join(SEED_DIR, "players.json");
  await writeFile(playersPath, JSON.stringify(players, null, 2));
  console.log(`Wrote ${playersPath}`);

  // Write categories.json only if it doesn't already exist (preserve hand edits)
  const categoriesPath = join(SEED_DIR, "categories.json");
  if (!existsSync(categoriesPath)) {
    await writeFile(categoriesPath, JSON.stringify(DEFAULT_CATEGORIES, null, 2));
    console.log(`Wrote ${categoriesPath} (default set)`);
  } else {
    console.log(`Kept existing ${categoriesPath}`);
  }

  // Regenerate client-side dictionary
  await writeFile(CLIENT_DICT_PATH, regenerateClientDictionary(players));
  console.log(`Wrote ${CLIENT_DICT_PATH} (${players.length} names)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

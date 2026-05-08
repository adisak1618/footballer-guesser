// Seed Insider word packs into Supabase.
//
// Inserts 4 starter word packs (per US-026 / Phase 3.4 of the multi-game
// platform PRD) plus their content_packs registry rows. Idempotent — re-running
// is a no-op via upsert + ignoreDuplicates.
//
// Usage:
//   bun run scripts/seed-insider-packs.ts                  # local
//   bun run scripts/seed-insider-packs.ts --target staging # staging
//
// Local target requires `bunx supabase start` to be running.
//
// Staging target requires SUPABASE_URL_STAGING and
// SUPABASE_SERVICE_ROLE_KEY_STAGING env vars (US-006 sets these up via the
// Supabase dashboard; staging credentials are NOT checked in).

import { createClient } from "@supabase/supabase-js";

type Target = "local" | "staging";

type WordPack = {
  slug: string;
  display_name: string;
  display_name_th: string;
  items: string[];
};

const LOCAL_SUPABASE_URL = "http://127.0.0.1:54321";

// Stable demo service-role JWT for `supabase start` local stacks.
// Local-only, identical across every developer machine — not a secret.
// Same fallback as apps/headball/e2e/_helpers/admin.ts.
const LOCAL_SERVICE_ROLE_FALLBACK =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9." +
  "eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0." +
  "EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const PACKS: WordPack[] = [
  {
    slug: "insider-thai-food",
    display_name: "Thai food",
    display_name_th: "อาหารไทย",
    items: [
      "ผัดไทย",
      "ส้มตำ",
      "ต้มยำกุ้ง",
      "แกงเขียวหวาน",
      "แกงมัสมั่น",
      "พะแนง",
      "ผัดกะเพรา",
      "ข้าวซอย",
      "ข้าวมันไก่",
      "ข้าวเหนียวมะม่วง",
      "ทอดมัน",
      "ลาบ",
      "น้ำตก",
      "ผัดซีอิ๊ว",
      "ราดหน้า",
      "ขนมจีนน้ำยา",
      "สุกี้",
      "หมูกรอบ",
      "ไก่ทอดหาดใหญ่",
      "ปลาเผาเกลือ",
      "ต้มข่าไก่",
      "แกงส้ม",
      "แกงเหลือง",
      "ฉู่ฉี่ปลา",
      "แหนมเนือง",
      "ห่อหมก",
      "ปอเปี๊ยะสด",
      "ผัดผักบุ้งไฟแดง",
      "น้ำพริกอ่อง",
      "ปลาหมึกย่าง",
      "หอยทอด",
      "กุ้งอบวุ้นเส้น",
      "ยำวุ้นเส้น",
      "ยำมะม่วง",
      "ปูผัดผงกะหรี่",
      "กะเพราหมูสับ",
      "แกงเลียง",
      "ขนมครก",
      "ข้าวคลุกกะปิ",
      "ก๋วยเตี๋ยวเรือ",
    ],
  },
  {
    slug: "insider-movies-classic",
    display_name: "Classic movies",
    display_name_th: "หนังคลาสสิก",
    items: [
      "Inception",
      "Titanic",
      "Avatar",
      "The Godfather",
      "Pulp Fiction",
      "Forrest Gump",
      "The Matrix",
      "Star Wars",
      "Jurassic Park",
      "Gladiator",
      "The Lord of the Rings",
      "Harry Potter",
      "The Shawshank Redemption",
      "Schindler's List",
      "Goodfellas",
      "The Dark Knight",
      "Interstellar",
      "Fight Club",
      "The Lion King",
      "Toy Story",
      "Finding Nemo",
      "Frozen",
      "Beauty and the Beast",
      "Casablanca",
      "Citizen Kane",
      "Psycho",
      "Vertigo",
      "2001: A Space Odyssey",
      "Apocalypse Now",
      "Back to the Future",
    ],
  },
  {
    slug: "insider-th-celebrities",
    display_name: "Thai celebrities",
    display_name_th: "ดาราไทย",
    items: [
      "เบิร์ด ธงไชย แมคอินไตย์",
      "โทนี่ จา",
      "บัวขาว บัญชาเมฆ",
      "ลิซ่า ลลิษา มโนบาล",
      "มาริโอ้ เมาเร่อ",
      "ใหม่ ดาวิกา โฮร์เน่",
      "โป๊ป ธนวรรธน์ วรรธนะภูติ",
      "ญาญ่า อุรัสยา เสปอร์บันด์",
      "ณเดชน์ คูกิมิยะ",
      "ชมพู่ อารยา เอ ฮาร์เก็ต",
      "อั้ม พัชราภา ไชยเชื้อ",
      "เบลล่า ราณี แคมเปน",
      "มิว นิษฐา จิรยั่งยืน",
      "บอย ปกรณ์ ฉัตรบริรักษ์",
      "ปอย ตรีชฎา เพชรรัตน์",
      "เจมส์ จิรายุ ตั้งศรีสุข",
      "เป๊ก ผลิตโชค อายนบุตร",
      "ตูน บอดี้สแลม",
      "เก้า สุภัสสรา ธนชาต",
      "อนันดา เอเวอริงแฮม",
    ],
  },
  {
    slug: "insider-football-stars",
    display_name: "Football stars",
    display_name_th: "นักฟุตบอลดัง",
    items: [
      "Lionel Messi",
      "Cristiano Ronaldo",
      "Kylian Mbappé",
      "Erling Haaland",
      "Neymar",
      "Mohamed Salah",
      "Robert Lewandowski",
      "Kevin De Bruyne",
      "Luka Modrić",
      "Karim Benzema",
      "Vinícius Júnior",
      "Jude Bellingham",
      "Marcus Rashford",
      "Harry Kane",
      "Son Heung-min",
      "Joshua Kimmich",
      "Phil Foden",
      "Bukayo Saka",
      "Pedri",
      "Gavi",
      "Rodri",
      "Virgil van Dijk",
      "Casemiro",
      "Thibaut Courtois",
      "Alisson Becker",
      "Sergio Ramos",
      "Gerard Piqué",
      "Luis Suárez",
      "Sergio Agüero",
      "Andrés Iniesta",
    ],
  },
];

function parseTarget(): Target {
  const idx = process.argv.indexOf("--target");
  if (idx === -1) return "local";
  const v = process.argv[idx + 1];
  if (v !== "local" && v !== "staging") {
    throw new Error(`unknown --target ${String(v)}; expected 'local' or 'staging'`);
  }
  return v;
}

function resolveCreds(target: Target): { url: string; key: string } {
  if (target === "local") {
    return {
      url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? LOCAL_SUPABASE_URL,
      key: process.env.SUPABASE_SERVICE_ROLE_KEY ?? LOCAL_SERVICE_ROLE_FALLBACK,
    };
  }
  const url = process.env.SUPABASE_URL_STAGING;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY_STAGING;
  if (!url || !key) {
    throw new Error(
      "staging target requires SUPABASE_URL_STAGING and SUPABASE_SERVICE_ROLE_KEY_STAGING env vars",
    );
  }
  return { url, key };
}

async function main(): Promise<void> {
  const target = parseTarget();
  const { url, key } = resolveCreds(target);
  const sb = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log(`Seeding ${PACKS.length} word packs into ${target} (${url})`);

  for (const pack of PACKS) {
    const wpInsert = await sb
      .from("word_packs")
      .upsert(
        [
          {
            slug: pack.slug,
            display_name: pack.display_name,
            display_name_th: pack.display_name_th,
          },
        ],
        { onConflict: "slug", ignoreDuplicates: true },
      );
    if (wpInsert.error) {
      throw new Error(
        `word_packs upsert (${pack.slug}) failed: ${wpInsert.error.message}`,
      );
    }

    const itemRows = pack.items.map((value) => ({
      pack_slug: pack.slug,
      value,
    }));
    const wpiInsert = await sb
      .from("word_pack_items")
      .upsert(itemRows, {
        onConflict: "pack_slug,value",
        ignoreDuplicates: true,
      });
    if (wpiInsert.error) {
      throw new Error(
        `word_pack_items upsert (${pack.slug}) failed: ${wpiInsert.error.message}`,
      );
    }

    const cpInsert = await sb
      .from("content_packs")
      .upsert(
        [
          {
            slug: pack.slug,
            display_name: pack.display_name,
            display_name_th: pack.display_name_th,
            handler: "word_list",
            source_ref: pack.slug,
          },
        ],
        { onConflict: "slug", ignoreDuplicates: true },
      );
    if (cpInsert.error) {
      throw new Error(
        `content_packs upsert (${pack.slug}) failed: ${cpInsert.error.message}`,
      );
    }

    console.log(
      `  ${pack.slug.padEnd(28)} ${String(pack.items.length).padStart(3)} items`,
    );
  }

  console.log("Done.");
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});

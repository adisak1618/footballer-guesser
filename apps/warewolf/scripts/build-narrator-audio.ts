#!/usr/bin/env bun
/**
 * build-narrator-audio.ts
 *
 * Generates the Thai narrator MP3s for the Warewolf V2 multiplayer game using
 * ElevenLabs Eleven v3 (alpha). Reads ELEVENLABS_API_KEY and
 * ELEVENLABS_VOICE_ID from apps/warewolf/.env. Writes MP3s to
 * apps/warewolf/public/audio/th/dev/.
 *
 * Source of truth for cue text + tags: apps/warewolf/docs/narrator-script-v0.md
 * Tag reference: apps/warewolf/docs/elevenlabs-audio-tags.md
 *
 * QUOTA SAFETY (free tier ≈ 10,000 credits ≈ 10 minutes of audio):
 *   - Default mode is DRY-RUN. No API calls. Shows what would be generated.
 *   - `--cue <id>`           generate ONE cue. Cheapest. Use for voice picking.
 *   - `--all --yes`          generate all 24 cues. Requires explicit confirmation.
 *   - `--force`              overwrite existing MP3s. Default skips files on disk.
 *   - `--list`               print all cue IDs and exit. No API call.
 *
 * Approximate quota cost (rough — actual depends on v3 alpha pricing):
 *   - Total text: ~1700 chars across 24 cues
 *   - Full pass at 1 take: ~25% of free monthly quota
 *   - Don't run --all --force without thinking. Quota does not refill until
 *     ElevenLabs' monthly cycle.
 *
 * Run from apps/warewolf/:
 *   bun scripts/build-narrator-audio.ts                       # dry-run
 *   bun scripts/build-narrator-audio.ts --list
 *   bun scripts/build-narrator-audio.ts --cue night_resolve_death
 *   bun scripts/build-narrator-audio.ts --all --yes
 *   bun scripts/build-narrator-audio.ts --cue game_start --force
 */

import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';

// ---------------------------------------------------------------------------
// CUE LIST — sourced from apps/warewolf/docs/narrator-script-v0.md (v0.2).
// When the markdown changes, update this list. Keep `id` and `clip` stable.
// `text` field contains Thai content with v3 audio tags (English brackets +
// Thai prose) — fed directly to the ElevenLabs API.
// ---------------------------------------------------------------------------

type Cue = {
  id: string;
  clip: string; // path relative to apps/warewolf/public/audio/
  text: string;
  duration_ms: number;
};

const CUES: Cue[] = [
  {
    id: 'game_start',
    clip: 'th/dev/00-game-start.mp3',
    text: '[ominous][slowly] ยินดีต้อนรับสู่หมู่บ้าน ... คืนนี้ หมาป่าเดินอยู่ท่ามกลางพวกท่าน ... [whispers] ขอให้ท่านพบมันก่อนที่มันจะพบท่าน',
    duration_ms: 10000,
  },
  {
    id: 'role_assignment',
    clip: 'th/dev/01-role-reveal.mp3',
    text: '[mysteriously] บัตรของท่านปรากฏแล้ว ... แตะเพื่อพลิกดูบทบาทของท่าน [whispers] อย่าให้ใครเห็น',
    duration_ms: 7000,
  },
  {
    id: 'night_intro',
    clip: 'th/dev/10-night-falls.mp3',
    text: '[hushed][slowly] ค่ำคืนมาเยือน ... หมู่บ้านหลับใหล ... [whispers] ทุกคนหลับตา',
    duration_ms: 6000,
  },
  {
    id: 'wolves_wake',
    clip: 'th/dev/20-wolves-wake.mp3',
    text: '[ominous][slowly] หมาป่า ... ลืมตา ... จดจำกันและกัน',
    duration_ms: 5000,
  },
  {
    id: 'wolves_choose',
    clip: 'th/dev/21-wolves-choose.mp3',
    text: '[ominous] หมาป่า ... เลือกเหยื่อของคืนนี้ ... [seriously] แตะที่หน้าจอ',
    duration_ms: 5000,
  },
  {
    id: 'wolves_sleep',
    clip: 'th/dev/22-wolves-sleep.mp3',
    text: '[softly] หมาป่า ... หลับตา',
    duration_ms: 3000,
  },
  {
    id: 'seer_wake',
    clip: 'th/dev/30-seer-wake.mp3',
    text: '[mysteriously] ผู้หยั่งรู้ ... ลืมตา',
    duration_ms: 3500,
  },
  {
    id: 'seer_inspect',
    clip: 'th/dev/31-seer-inspect.mp3',
    text: '[mysteriously][curious] เลือกหนึ่งคน ... ท่านจะเห็นว่าเขาคือชาวบ้านหรือหมาป่า',
    duration_ms: 5500,
  },
  {
    id: 'seer_sleep',
    clip: 'th/dev/32-seer-sleep.mp3',
    text: '[softly] ผู้หยั่งรู้ ... หลับตา',
    duration_ms: 3000,
  },
  {
    id: 'bodyguard_wake',
    clip: 'th/dev/40-bodyguard-wake.mp3',
    text: '[seriously] ผู้พิทักษ์ ... ลืมตา',
    duration_ms: 3500,
  },
  {
    id: 'bodyguard_protect',
    clip: 'th/dev/41-bodyguard-protect.mp3',
    text: '[seriously][slowly] เลือกหนึ่งคนที่ท่านจะปกป้องคืนนี้ ... ห้ามเลือกคนเดิมจากคืนก่อน',
    duration_ms: 6500,
  },
  {
    id: 'bodyguard_sleep',
    clip: 'th/dev/42-bodyguard-sleep.mp3',
    text: '[softly] ผู้พิทักษ์ ... หลับตา',
    duration_ms: 3000,
  },
  {
    id: 'night_resolve_death',
    clip: 'th/dev/60-dawn-death.mp3',
    text: '[dramatic][slowly] รุ่งอรุณมาถึง ... หมู่บ้านตื่น ... [ominous] และพบศพหนึ่งคนกลางลานหมู่บ้าน',
    duration_ms: 9000,
  },
  {
    id: 'night_resolve_no_death',
    clip: 'th/dev/61-dawn-spared.mp3',
    text: '[softly] รุ่งอรุณมาถึง หมู่บ้านตื่น ... คืนนี้ ไม่มีใครต้องตาย',
    duration_ms: 7000,
  },
  {
    id: 'day_intro',
    clip: 'th/dev/70-day-intro.mp3',
    text: '[seriously] จงปรึกษากัน ... หาตัวหมาป่าก่อนที่หมาป่าจะหาเจอท่าน ... [urgently] เวลามีจำกัด',
    duration_ms: 7500,
  },
  {
    id: 'accusation_open',
    clip: 'th/dev/71-accusation.mp3',
    text: '[seriously][slowly] ถึงเวลาแล้ว ... แตะที่ผู้ที่ท่านสงสัยบนหน้าจอเพื่อกล่าวหา',
    duration_ms: 7000,
  },
  {
    id: 'defense_open',
    clip: 'th/dev/80-defense.mp3',
    text: '[dramatic][seriously] มีผู้ถูกกล่าวหาแล้ว ... จงแก้ต่างก่อนที่หมู่บ้านจะตัดสิน',
    duration_ms: 6500,
  },
  {
    id: 'defense_warning_final',
    clip: 'th/dev/81-defense-final.mp3',
    text: '[urgently][whispers] เวลาใกล้หมดแล้ว',
    duration_ms: 2500,
  },
  {
    id: 'vote_open',
    clip: 'th/dev/90-vote-open.mp3',
    text: '[seriously] ลงคะแนน ... ประหารหรือไว้ชีวิต',
    duration_ms: 4000,
  },
  {
    id: 'execution_killed',
    clip: 'th/dev/91-execution-killed.mp3',
    text: '[dramatic][slowly] หมู่บ้านตัดสินใจแล้ว ... ผู้ถูกกล่าวหาถูกประหาร ... [ominous][whispers] เผยตัวตน...',
    duration_ms: 9000,
  },
  {
    id: 'execution_spared',
    clip: 'th/dev/92-execution-spared.mp3',
    text: '[softly][slowly] หมู่บ้านเมตตา ... [ominous] อีกหนึ่งคืนหมาป่ายังเดินอยู่',
    duration_ms: 7500,
  },
  {
    id: 'wolves_win',
    clip: 'th/dev/99-wolves-win.mp3',
    text: '[ominous][slowly] หมาป่ามีจำนวนเท่ากับชาวบ้านแล้ว ... หมู่บ้านล่มสลาย ... [triumphantly][whispers] หมาป่า... ชนะ',
    duration_ms: 10000,
  },
  {
    id: 'village_wins',
    clip: 'th/dev/98-village-wins.mp3',
    text: '[dramatic][slowly] หมาป่าตัวสุดท้ายล้มลง ... หมู่บ้านปลอดภัยอีกครั้ง ... [triumphantly] ชาวบ้าน... ชนะ',
    duration_ms: 9000,
  },
  {
    id: 'pause',
    clip: 'th/dev/u01-pause.mp3',
    text: '[softly] เกมหยุดชั่วคราว',
    duration_ms: 2500,
  },
  {
    id: 'resume',
    clip: 'th/dev/u02-resume.mp3',
    text: '[softly] เกมดำเนินต่อ',
    duration_ms: 2500,
  },
  {
    id: 'waiting_for_action',
    clip: 'th/dev/u03-waiting.mp3',
    text: '[whispers][ominous] หมาป่ากำลังคิด...',
    duration_ms: 3000,
  },
];

// ---------------------------------------------------------------------------
// Settings — match the recommendations in elevenlabs-audio-tags.md.
// ---------------------------------------------------------------------------

const VOICE_SETTINGS = {
  stability: 0.35,
  similarity_boost: 0.8,
  style: 0.1,
  use_speaker_boost: false,
};

const MODEL_ID = 'eleven_v3';
const OUTPUT_FORMAT = 'mp3_22050_32'; // 22kHz, 32kbps mono — matches design doc audio budget

const PUBLIC_AUDIO_DIR = resolve(import.meta.dir, '..', 'public', 'audio');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmt(n: number): string {
  return n.toLocaleString('en-US');
}

function totalChars(cues: Cue[]): number {
  return cues.reduce((sum, c) => sum + c.text.length, 0);
}

function totalDurationMs(cues: Cue[]): number {
  return cues.reduce((sum, c) => sum + c.duration_ms, 0);
}

function exists(cue: Cue): boolean {
  return existsSync(join(PUBLIC_AUDIO_DIR, cue.clip));
}

function printCueTable(cues: Cue[]): void {
  const idW = Math.max(...cues.map((c) => c.id.length));
  const clipW = Math.max(...cues.map((c) => c.clip.length));
  console.log(
    `${'id'.padEnd(idW)}  ${'clip'.padEnd(clipW)}  chars  dur(ms)  on-disk`,
  );
  console.log('-'.repeat(idW + clipW + 30));
  for (const c of cues) {
    const onDisk = exists(c) ? '✓' : '·';
    console.log(
      `${c.id.padEnd(idW)}  ${c.clip.padEnd(clipW)}  ${String(c.text.length).padStart(5)}  ${String(c.duration_ms).padStart(7)}  ${onDisk}`,
    );
  }
}

async function generateOne(cue: Cue, apiKey: string, voiceId: string): Promise<void> {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=${OUTPUT_FORMAT}`;
  const body = {
    text: cue.text,
    model_id: MODEL_ID,
    voice_settings: VOICE_SETTINGS,
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`ElevenLabs ${res.status} ${res.statusText}: ${errBody}`);
  }

  const ct = res.headers.get('content-type') || '';
  if (!ct.startsWith('audio/')) {
    const errBody = await res.text();
    throw new Error(`Expected audio response, got ${ct}: ${errBody.slice(0, 300)}`);
  }

  const outPath = join(PUBLIC_AUDIO_DIR, cue.clip);
  mkdirSync(dirname(outPath), { recursive: true });
  const buf = await res.arrayBuffer();
  await Bun.write(outPath, buf);

  const sizeKB = (buf.byteLength / 1024).toFixed(1);
  console.log(`  ✓ wrote ${cue.clip} (${sizeKB} KB)`);
}

async function confirm(prompt: string): Promise<boolean> {
  process.stdout.write(`${prompt} [y/N] `);
  const decoder = new TextDecoder();
  for await (const chunk of Bun.stdin.stream()) {
    const answer = decoder.decode(chunk).trim().toLowerCase();
    return answer === 'y' || answer === 'yes';
  }
  return false;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    list: { type: 'boolean', default: false },
    all: { type: 'boolean', default: false },
    cue: { type: 'string' },
    force: { type: 'boolean', default: false },
    yes: { type: 'boolean', default: false },
    'voice-id': { type: 'string' },
    help: { type: 'boolean', short: 'h', default: false },
  },
  strict: true,
  allowPositionals: false,
});

function printHelp(): void {
  const helpText = [
    'Usage: bun scripts/build-narrator-audio.ts [options]',
    '',
    'Modes:',
    '  (no flags)            DRY-RUN. No API calls. Show what would generate.',
    '  --list                Print cue IDs and exit.',
    '  --cue <id>            Generate one cue.',
    '  --all --yes           Generate all 24 cues. Requires --yes confirmation.',
    '',
    'Flags:',
    '  --force               Overwrite existing MP3s on disk.',
    '  --voice-id <id>       Override ELEVENLABS_VOICE_ID env var.',
    '  -h, --help            This message.',
    '',
    'Quota: free tier ≈ 10,000 credits/mo ≈ 10 min audio.',
    '       Full --all pass ≈ 25% of monthly quota.',
  ].join('\n');
  console.log(helpText);
}

if (values.help) {
  printHelp();
  process.exit(0);
}

if (values.list) {
  printCueTable(CUES);
  console.log(`\n${CUES.length} cues, ${fmt(totalChars(CUES))} chars total, ${(totalDurationMs(CUES) / 1000).toFixed(1)}s of audio.`);
  process.exit(0);
}

// Pick which cues to operate on.
let targetCues: Cue[];
if (values.cue) {
  const found = CUES.find((c) => c.id === values.cue);
  if (!found) {
    console.error(`✗ Unknown cue id: ${values.cue}`);
    console.error(`  Available: ${CUES.map((c) => c.id).join(', ')}`);
    process.exit(1);
  }
  targetCues = [found];
} else if (values.all) {
  targetCues = CUES;
} else {
  // Dry-run mode: show all cues with disk status.
  console.log('DRY-RUN — no API calls will be made.\n');
  printCueTable(CUES);
  const skipped = CUES.filter((c) => exists(c)).length;
  const wouldGen = CUES.filter((c) => !exists(c) || values.force);
  console.log(`\n${CUES.length} cues total. ${skipped} on disk. ${wouldGen.length} would generate.`);
  console.log(`Total chars to send: ${fmt(totalChars(wouldGen))} (${fmt(totalChars(CUES))} if --force).`);
  console.log('\nNext: --list to see cue IDs, --cue <id> to test one, --all --yes to generate everything.');
  process.exit(0);
}

// Filter out already-generated unless --force.
const toGenerate = values.force ? targetCues : targetCues.filter((c) => !exists(c));
const skipped = targetCues.length - toGenerate.length;

if (skipped > 0 && !values.force) {
  console.log(`Skipping ${skipped} cue(s) already on disk. Use --force to overwrite.`);
}

if (toGenerate.length === 0) {
  console.log('Nothing to generate.');
  process.exit(0);
}

// Verify env.
const apiKey = process.env.ELEVENLABS_API_KEY;
const voiceId = values['voice-id'] || process.env.ELEVENLABS_VOICE_ID;

if (!apiKey) {
  console.error('✗ ELEVENLABS_API_KEY not set. Add it to apps/warewolf/.env');
  process.exit(1);
}
if (!voiceId) {
  console.error('✗ ELEVENLABS_VOICE_ID not set. Add it to apps/warewolf/.env or pass --voice-id <id>.');
  console.error('  Find voice IDs at: https://elevenlabs.io/app/voice-library or via your API account.');
  process.exit(1);
}

// Show what's about to happen and confirm if --all.
console.log(`Voice ID:  ${voiceId}`);
console.log(`Model:     ${MODEL_ID}`);
console.log(`Format:    ${OUTPUT_FORMAT}`);
console.log(`Output:    ${PUBLIC_AUDIO_DIR}`);
console.log(`Cues:      ${toGenerate.length} (${fmt(totalChars(toGenerate))} chars total)`);
console.log('');

if (values.all && !values.yes) {
  const ok = await confirm('Generate all and burn ~25% of free monthly quota?');
  if (!ok) {
    console.log('Aborted.');
    process.exit(0);
  }
}

// Generate sequentially. ElevenLabs has per-second rate limits and we want to
// stop fast on auth errors before burning quota.
let okCount = 0;
let failCount = 0;
for (const cue of toGenerate) {
  console.log(`[${okCount + failCount + 1}/${toGenerate.length}] ${cue.id}  (${cue.text.length} chars)`);
  try {
    await generateOne(cue, apiKey, voiceId);
    okCount++;
  } catch (err) {
    failCount++;
    console.error(`  ✗ ${cue.id}: ${(err as Error).message}`);
    // If the FIRST cue fails (likely auth or quota), stop. Don't burn through
    // the rest making the same broken call.
    if (okCount === 0) {
      console.error('\nAborting batch — first cue failed. Likely auth / quota / voice ID issue.');
      process.exit(1);
    }
  }
}

console.log(`\nDone. ${okCount} succeeded, ${failCount} failed.`);
if (failCount > 0) process.exit(1);

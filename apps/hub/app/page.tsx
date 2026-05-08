import Link from "next/link";

const HEADBALL_URL =
  process.env.NEXT_PUBLIC_HEADBALL_URL ?? "http://localhost:3000";
const INSIDER_URL =
  process.env.NEXT_PUBLIC_INSIDER_URL ?? "http://localhost:3002";

type Gate = {
  letter: "A" | "B";
  name: "HEADBALL" | "INSIDER";
  thaiTagline: string;
  englishTagline: string;
  href: string;
  bgClass: string;
};

const gates: Gate[] = [
  {
    letter: "A",
    name: "HEADBALL",
    thaiTagline: "ทายชื่อนักฟุตบอลบนหัว",
    englishTagline: "Football head-guess party",
    href: HEADBALL_URL,
    bgClass: "bg-tag-red",
  },
  {
    letter: "B",
    name: "INSIDER",
    thaiTagline: "ใครคือคนใน",
    englishTagline: "Find the insider",
    href: INSIDER_URL,
    bgClass: "bg-tag-purple",
  },
];

export default function HubHomePage() {
  return (
    <main className="flex flex-1 flex-col px-5 pb-12 pt-8">
      <header className="mb-10 text-center">
        <p className="font-display text-[32px] leading-none tracking-[0.3px] text-goal uppercase">
          ⚽ HEADBALL SOCIAL GAMES
        </p>
        <p className="mt-2 font-body text-[14px] leading-[1.4] tracking-[0.3px] text-on-dark-soft">
          เกมโซเชียลในห้องเดียวกัน · Same-room social games
        </p>
      </header>

      <section className="flex flex-col items-center">
        <h1 className="font-display text-[28px] leading-[1.1] tracking-[0.3px] text-on-dark uppercase">
          เลือกเกม / PICK YOUR GAME
        </h1>

        <div className="mt-8 flex w-full flex-col gap-5">
          {gates.map((gate) => (
            <Link
              key={gate.letter}
              href={gate.href}
              className={`${gate.bgClass} group relative flex min-h-[200px] w-full flex-col justify-between overflow-hidden rounded-2xl px-6 py-8 text-on-dark transition-transform duration-150 ease-out active:translate-y-[1px]`}
            >
              <div className="flex items-baseline justify-between">
                <span className="font-display text-[20px] leading-none tracking-[1px] text-on-dark/80 uppercase">
                  GATE {gate.letter}
                </span>
                <span className="font-body text-[12px] font-medium leading-[1.4] tracking-[0.3px] text-on-dark/70 uppercase">
                  Tap to enter
                </span>
              </div>

              <div className="mt-auto">
                <p className="font-hero text-[64px] leading-[0.95] tracking-[1px] text-on-dark uppercase">
                  {gate.name}
                </p>
                <p className="mt-2 font-body text-[16px] leading-[1.55] text-on-dark/90">
                  {gate.thaiTagline}
                </p>
                <p className="font-body text-[14px] leading-[1.5] text-on-dark/75">
                  {gate.englishTagline}
                </p>
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-10 flex w-full flex-col items-center">
          <p className="font-body text-[14px] leading-[1.5] text-on-dark-soft">
            มีรหัสห้องอยู่แล้ว? · Already have a room code?
          </p>
          <Link
            href="/join"
            className="mt-3 inline-flex min-h-[44px] items-center justify-center rounded-md border border-hairline bg-surface-elevated px-6 font-display text-[15px] font-semibold leading-none tracking-[1px] text-on-dark uppercase transition-colors duration-150 hover:bg-surface active:translate-y-[1px]"
          >
            ENTER CODE →
          </Link>
        </div>
      </section>

      <footer className="mt-auto pt-12 text-center">
        <p className="font-body text-[12px] font-medium leading-[1.4] tracking-[0.3px] text-on-dark-muted uppercase">
          Same room · Same phone-passing energy
        </p>
      </footer>
    </main>
  );
}

import Link from "next/link"
import { CreateInsiderRoomButton } from "./create-insider-room-button"

export default function InsiderPage() {
  return (
    <main className="relative mx-auto flex min-h-[100dvh] w-full max-w-[480px] flex-col items-center justify-between px-6 pt-16 pb-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-gradient-to-b from-goal/20 via-goal/5 to-transparent"
      />

      <header className="relative flex flex-col items-center gap-3 pt-6 text-center">
        <h1 className="font-display text-[56px] leading-none tracking-[0.5px] text-on-dark uppercase">
          Insider
        </h1>
        <p className="text-base leading-relaxed text-on-dark-soft">
          เกมคนวงใน
        </p>
      </header>

      <div className="relative flex w-full flex-col gap-4">
        <CreateInsiderRoomButton />

        <Link
          href="/join"
          className="flex min-h-11 w-full items-center justify-center rounded-xl border border-hairline bg-surface-elevated px-6 text-[15px] font-semibold tracking-[0.3px] text-on-dark transition-colors active:bg-surface"
        >
          เข้าห้อง
        </Link>
      </div>

      <span aria-hidden className="relative h-4" />
    </main>
  )
}

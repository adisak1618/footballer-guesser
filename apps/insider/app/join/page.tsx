import Link from "next/link"
import { JoinInsiderRoomForm } from "./join-insider-room-form"

export default function JoinPage() {
  return (
    <main className="relative mx-auto flex min-h-[100dvh] w-full max-w-[480px] flex-col px-6 pt-10 pb-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-gradient-to-b from-goal/20 via-goal/5 to-transparent"
      />

      <header className="relative flex items-center justify-between pb-8">
        <Link
          href="/"
          className="text-xs font-medium tracking-[0.3px] text-on-dark-muted underline-offset-4 hover:underline"
        >
          ← กลับ
        </Link>
      </header>

      <div className="relative flex flex-col items-center gap-2 pb-8 text-center">
        <h1 className="font-display text-[40px] leading-none tracking-[0.5px] text-on-dark uppercase">
          เข้าห้อง
        </h1>
        <p className="text-sm leading-relaxed text-on-dark-soft">
          ใส่รหัสห้อง 6 ตัวที่ได้จาก host
        </p>
      </div>

      <JoinInsiderRoomForm />
    </main>
  )
}

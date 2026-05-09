import Link from "next/link"
import { listEnabledPacks } from "@social-hub/content"
import { createSupabaseServerClient } from "@/lib/supabase-server"
import { HostSetupForm } from "./host-setup-form"

export const dynamic = "force-dynamic"

export default async function InsiderNewPage() {
  const supabase = createSupabaseServerClient()
  const packs = await listEnabledPacks(supabase)

  return (
    <main className="relative mx-auto flex min-h-[100dvh] w-full max-w-[480px] flex-col gap-8 px-6 pb-10 pt-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-gradient-to-b from-goal/15 via-goal/5 to-transparent"
      />

      <header className="relative flex flex-col gap-4">
        <Link
          href="/"
          className="inline-flex w-fit items-center gap-1 text-sm text-on-dark-soft hover:text-on-dark"
        >
          <span aria-hidden>←</span>
          <span>กลับ</span>
        </Link>
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-[44px] leading-none tracking-[0.5px] text-on-dark uppercase">
            New Insider Room
          </h1>
          <p className="text-base leading-relaxed text-on-dark-soft">
            ตั้งห้องใหม่
          </p>
        </div>
      </header>

      <HostSetupForm packs={packs} />
    </main>
  )
}

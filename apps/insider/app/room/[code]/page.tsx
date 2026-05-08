// Placeholder lobby page. The full Insider lobby ships in US-5b.3.
// Today this page exists only so the host-setup redirect (US-5b.2) lands
// somewhere instead of 404'ing while the lobby is still being built.

export const dynamic = "force-dynamic"

export default async function InsiderRoomPlaceholder({
  params,
}: {
  params: Promise<{ code: string }>
}) {
  const { code } = await params

  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center gap-3 px-6">
      <p className="text-xs uppercase tracking-[2px] text-on-dark-soft">
        ROOM CODE
      </p>
      <h1
        data-testid="insider-room-code"
        className="font-hero text-5xl tracking-[8px] text-on-dark"
      >
        {code}
      </h1>
      <p className="text-sm text-on-dark-soft">
        Lobby ships in US-5b.3 — host setup successful.
      </p>
    </main>
  )
}

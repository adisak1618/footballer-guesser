"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useGameStore } from "@/lib/game-store"

const BANNER_GRACE_MS = 500
const OFFLINE_TIMEOUT_MS = 30_000

export function ConnectionStatus() {
  const router = useRouter()
  const status = useGameStore((s) => s.connectionStatus)
  const [bannerVisible, setBannerVisible] = useState(false)
  const [offlineModal, setOfflineModal] = useState(false)

  useEffect(() => {
    const shouldShow = status !== "SUBSCRIBED" && status !== "IDLE"
    const delay = shouldShow ? BANNER_GRACE_MS : 0
    const t = window.setTimeout(() => setBannerVisible(shouldShow), delay)
    return () => window.clearTimeout(t)
  }, [status])

  useEffect(() => {
    const shouldShow = status === "DISCONNECTED"
    const delay = shouldShow ? OFFLINE_TIMEOUT_MS : 0
    const t = window.setTimeout(() => setOfflineModal(shouldShow), delay)
    return () => window.clearTimeout(t)
  }, [status])

  return (
    <>
      <div
        role="status"
        aria-live="assertive"
        aria-hidden={!bannerVisible}
        className={`pointer-events-none fixed inset-x-0 top-0 z-40 flex items-center justify-center gap-2 bg-warning px-4 py-2 text-[13px] font-semibold tracking-[0.2px] text-on-light shadow-lg motion-safe:transition-transform motion-safe:duration-300 ${
          bannerVisible ? "translate-y-0" : "-translate-y-full"
        }`}
      >
        <span
          aria-hidden="true"
          className="text-base motion-safe:animate-pulse"
        >
          🔴
        </span>
        <span>กำลังเชื่อมต่อ...</span>
      </div>

      {offlineModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="เชื่อมต่อไม่ได้"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6"
        >
          <div className="w-full max-w-sm rounded-2xl border border-hairline bg-surface-elevated p-6 text-center">
            <h2 className="font-display text-[28px] tracking-[0.5px] text-on-dark">
              เชื่อมต่อไม่ได้
            </h2>
            <p className="mt-3 text-sm text-on-dark-soft">
              เครือข่ายขาดนานเกินไป กลับไปหน้าหลักเพื่อลองใหม่
            </p>
            <button
              type="button"
              onClick={() => router.push("/")}
              className="mt-6 flex min-h-12 w-full items-center justify-center rounded-xl bg-goal px-4 text-[15px] font-semibold text-on-dark transition-colors active:bg-goal-active"
            >
              กลับหน้าหลัก
            </button>
          </div>
        </div>
      )}
    </>
  )
}

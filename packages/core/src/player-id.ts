function storageKey(namespace: string): string {
  return `${namespace}_player_id`
}

function generateUuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export function getOrCreatePlayerId(namespace: string): string {
  if (typeof window === "undefined") {
    throw new Error("getOrCreatePlayerId must be called on the client")
  }
  const key = storageKey(namespace)
  const existing = window.localStorage.getItem(key)
  if (existing) return existing
  const next = generateUuid()
  window.localStorage.setItem(key, next)
  return next
}

export function readPlayerId(namespace: string): string | null {
  if (typeof window === "undefined") return null
  return window.localStorage.getItem(storageKey(namespace))
}

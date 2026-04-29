import "@testing-library/jest-dom/vitest"
import { beforeEach } from "vitest"

class MemoryStorage implements Storage {
  private store = new Map<string, string>()
  get length(): number {
    return this.store.size
  }
  clear(): void {
    this.store.clear()
  }
  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null
  }
  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null
  }
  removeItem(key: string): void {
    this.store.delete(key)
  }
  setItem(key: string, value: string): void {
    this.store.set(key, String(value))
  }
}

const memoryLocalStorage = new MemoryStorage()
Object.defineProperty(window, "localStorage", {
  configurable: true,
  value: memoryLocalStorage,
})
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: memoryLocalStorage,
})

beforeEach(() => {
  memoryLocalStorage.clear()
})

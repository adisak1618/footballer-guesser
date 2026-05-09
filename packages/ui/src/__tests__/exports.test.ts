import { describe, expect, it } from "vitest"

import { cn } from "../utils"

describe("@social-hub/ui utils", () => {
  it("cn merges classes via clsx + tailwind-merge", () => {
    expect(cn("a", "b")).toBe("a b")
    expect(cn("a", null, false, "b")).toBe("a b")
    expect(cn("px-2", "px-4")).toBe("px-4")
    expect(cn("py-2 px-2", "px-4")).toBe("py-2 px-4")
  })
})

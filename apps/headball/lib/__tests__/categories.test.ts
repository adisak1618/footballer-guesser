import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { ALLOWED_CATEGORIES } from "@/lib/categories"

// ---------- Load shared fixtures ----------

type CategoryDefinition = {
  slug: string
  label_th: string
  label_en: string
  query: unknown
}

// __dirname is apps/headball/lib/__tests__ — workspace root data/ is four levels up.
const categoriesJson = JSON.parse(
  readFileSync(
    join(__dirname, "..", "..", "..", "..", "data", "seed", "categories.json"),
    "utf8",
  ),
) as { version: number; categories: CategoryDefinition[] }

// ---------- The contract: three places must agree on the slug list ----------
//
//  1. data/seed/categories.json                     — source of truth, drives DB
//  2. app/actions/update-room-settings.ts           — Zod allow-list
//  3. components/lobby-settings.tsx                 — UI dropdown options
//
// Tests (1) ↔ (2) here. (3) is exercised by the typecheck because
// CATEGORY_OPTIONS narrows to the ALLOWED_CATEGORIES union.

describe("category contract", () => {
  it("ALLOWED_CATEGORIES matches data/seed/categories.json 1:1", () => {
    const jsonSlugs = categoriesJson.categories.map((c) => c.slug).sort()
    const actionSlugs = [...ALLOWED_CATEGORIES].sort()
    expect(actionSlugs).toEqual(jsonSlugs)
  })

  it("every slug is unique in categories.json", () => {
    const slugs = categoriesJson.categories.map((c) => c.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  it("every category has Thai and English labels", () => {
    for (const cat of categoriesJson.categories) {
      expect(cat.label_th, `missing label_th for ${cat.slug}`).toBeTruthy()
      expect(cat.label_en, `missing label_en for ${cat.slug}`).toBeTruthy()
    }
  })

  it("worldwide-stars exists (it's the default for new rooms)", () => {
    const slugs = categoriesJson.categories.map((c) => c.slug)
    expect(slugs).toContain("worldwide-stars")
  })

  it("worldwide-stars uses sitelinks >= 100 (the global-fame threshold)", () => {
    const cat = categoriesJson.categories.find(
      (c) => c.slug === "worldwide-stars",
    )
    expect(cat?.query).toEqual({
      field: "sitelinks",
      op: "gte",
      value: 100,
    })
  })

  it("the 'real-and-X' rivalry categories use AND not OR", () => {
    const rivalSlugs = [
      "real-and-barca",
      "milan-and-inter",
      "arsenal-and-tottenham",
      "united-and-city",
      "real-and-atletico",
      "real-and-chelsea",
    ]
    for (const slug of rivalSlugs) {
      const cat = categoriesJson.categories.find((c) => c.slug === slug)
      expect(cat, `${slug} missing from categories.json`).toBeDefined()
      expect(
        Object.keys(cat!.query as object),
        `${slug} should use 'all' (AND), not 'any' (OR)`,
      ).toContain("all")
    }
  })
})

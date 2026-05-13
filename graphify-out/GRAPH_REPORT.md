# Graph Report - board-game  (2026-05-14)

## Corpus Check
- 397 files · ~1,740,437 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 469 nodes · 615 edges · 31 communities (28 shown, 3 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 7 edges (avg confidence: 0.89)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `47a3e114`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Solver & Archetype Logic|Solver & Archetype Logic]]
- [[_COMMUNITY_Customize Page & Banner|Customize Page & Banner]]
- [[_COMMUNITY_V2 Audio Pipeline Docs|V2 Audio Pipeline Docs]]
- [[_COMMUNITY_Card Art Rendering|Card Art Rendering]]
- [[_COMMUNITY_Add Role Sheet|Add Role Sheet]]
- [[_COMMUNITY_Setup List Page|Setup List Page]]
- [[_COMMUNITY_i18n Routing & Layout|i18n Routing & Layout]]
- [[_COMMUNITY_Rules Page Layout|Rules Page Layout]]
- [[_COMMUNITY_Narrator Audio Build Script|Narrator Audio Build Script]]
- [[_COMMUNITY_Bundle Budget CI|Bundle Budget CI]]
- [[_COMMUNITY_Card Build Script|Card Build Script]]
- [[_COMMUNITY_Archetype Chip Strip|Archetype Chip Strip]]
- [[_COMMUNITY_Balance Scale UI|Balance Scale UI]]
- [[_COMMUNITY_Tap Target Tests|Tap Target Tests]]
- [[_COMMUNITY_Customize Loop E2E|Customize Loop E2E]]
- [[_COMMUNITY_A11Y Floor (docs + tests)|A11Y Floor (docs + tests)]]
- [[_COMMUNITY_A11Y E2E Helpers|A11Y E2E Helpers]]
- [[_COMMUNITY_Middleware Test|Middleware Test]]
- [[_COMMUNITY_Store Persistence Test|Store Persistence Test]]
- [[_COMMUNITY_Share Roundtrip E2E|Share Roundtrip E2E]]
- [[_COMMUNITY_Invalid URL E2E|Invalid URL E2E]]
- [[_COMMUNITY_Next Config|Next Config]]
- [[_COMMUNITY_Card Art E2E|Card Art E2E]]
- [[_COMMUNITY_Root App Layout|Root App Layout]]
- [[_COMMUNITY_Landing E2E|Landing E2E]]
- [[_COMMUNITY_Locale Toggle E2E|Locale Toggle E2E]]
- [[_COMMUNITY_Next Type Defs|Next Type Defs]]

## God Nodes (most connected - your core abstractions)
1. `Warewolf V2 Roadmap` - 11 edges
2. `Warewolf App-local CLAUDE.md` - 11 edges
3. `Narrator Script v0.2 (26 Thai cues)` - 11 edges
4. `Headball — Multi-Game Platform Monorepo` - 10 edges
5. `ARCHETYPES` - 10 edges
6. `V2 Design — Wireframe Prototype + Decisions` - 10 edges
7. `CardArt()` - 8 edges
8. `ArchetypeId` - 8 edges
9. `ElevenLabs v3 Audio Tags Reference` - 8 edges
10. `Narrator Audio Inventory (26 MP3s)` - 8 edges

## Surprising Connections (you probably didn't know these)
- `SetupListPageInner()` --calls--> `useWarewolfStore`  [EXTRACTED]
  app/[lang]/setup/page.tsx → lib/store.ts
- `CustomizePageInner()` --calls--> `useWarewolfStore`  [EXTRACTED]
  app/[lang]/setup/customize/page.tsx → lib/store.ts
- `Local TTS MP3 Generation (say + lame)` --semantically_similar_to--> `Narrator Audio Inventory (26 MP3s)`  [INFERRED] [semantically similar]
  apps/warewolf/docs/generate-tts-mp3.md → apps/warewolf/docs/narrator-audio.md
- `Narrator Audio Inventory (26 MP3s)` --references--> `lib/phases/phase-audio-cues.ts (planned)`  [EXTRACTED]
  apps/warewolf/docs/narrator-audio.md → apps/warewolf/lib/phases/phase-audio-cues.ts
- `middleware()` --calls--> `resolveLocalePrecedence()`  [EXTRACTED]
  middleware.ts → lib/locale-precedence.ts

## Hyperedges (group relationships)
- **Load-bearing audio pipeline (script → tags → MP3s → iOS unlock)** — narrator_script_v0, elevenlabs_audio_tags_ref, narrator_audio_inventory, v2design_audio_unlock_gate, roadmap_ios_safari_audio_spike [INFERRED 0.90]
- **Apprentice Seer silent inheritance (audio + UI + cue)** — claude_apprentice_silent_inheritance, narrator_cue_seer_wake, v2design_stadium_info_asymmetry [EXTRACTED 1.00]
- **V1 CI quality gates (a11y + bundle + Lighthouse)** — a11y_axe_e2e_spec, perf_bundle_budget_gate, perf_lighthouse_lcp_gate [INFERRED 0.85]

## Communities (31 total, 3 thin omitted)

### Community 0 - "Solver & Archetype Logic"
Cohesion: 0.06
Nodes (52): 44px Minimum Tap Targets, e2e/a11y.spec.ts (axe automated scans), Focus-visible Blood-red Rings, Keyboard Tab Order (top-to-bottom, left-to-right), Reduced Motion (prefers-reduced-motion), lib/__tests__/tap-targets.test.ts, Manual VoiceOver Screen Reader Pass, Warewolf Accessibility Floor (Pass 6 + Pass 7) (+44 more)

### Community 1 - "Customize Page & Banner"
Cohesion: 0.05
Nodes (37): BannerVisual, PlayableBanner(), PlayableBannerProps, PlayableBannerState, banner, VISUALS, CustomizePageInner(), emptyGlyphStyle (+29 more)

### Community 2 - "V2 Audio Pipeline Docs"
Cohesion: 0.07
Nodes (40): ALL_ARCHETYPES, failures, start, communityWolfCount(), computeSetupList(), generateVariations(), isSolverError(), pickWolvesForBalance() (+32 more)

### Community 3 - "Card Art Rendering"
Cohesion: 0.07
Nodes (29): CardArt(), CardArtPlaceholder(), CardArtPlaceholderProps, CardArtProps, CardArtSize, SIZE_PX, { container }, img (+21 more)

### Community 4 - "Add Role Sheet"
Cohesion: 0.08
Nodes (23): ArchetypeChipStrip(), ArchetypeChipStripProps, buttons, chip, { container }, next, { onChange }, powerRoles (+15 more)

### Community 5 - "Setup List Page"
Cohesion: 0.08
Nodes (27): AddRoleSheet(), AddRoleSheetProps, TAB_LABEL, card, infoTab, { onAdd }, { onAdd, onClose }, { onClose } (+19 more)

### Community 6 - "i18n Routing & Layout"
Cohesion: 0.11
Nodes (14): routing, HERO_CARDS, LangParams, isLocale(), LocaleDecision, resolveLocalePrecedence(), decision, parsed (+6 more)

### Community 7 - "Rules Page Layout"
Cohesion: 0.1
Nodes (12): Container(), ContainerProps, MAX_WIDTHS, { container }, el, RULES_CHAPTERS, RulesBlock, RulesChapter (+4 more)

### Community 8 - "Narrator Audio Build Script"
Cohesion: 0.13
Nodes (18): countTeams(), groupRoles(), RoleGroup, SetupCard(), SetupCardProps, card, makeSetup(), names (+10 more)

### Community 9 - "Bundle Budget CI"
Cohesion: 0.13
Nodes (9): Cue, CUES, exists(), found, printCueTable(), PUBLIC_AUDIO_DIR, { values }, VOICE_SETTINGS (+1 more)

### Community 10 - "Card Build Script"
Cohesion: 0.12
Nodes (11): APP_ROOT, BASELINE_HTML, baselineChunks, baselineHtml, breakdown, gz, NEXT_DIR, ROUTE_HTML (+3 more)

### Community 11 - "Archetype Chip Strip"
Cohesion: 0.19
Nodes (12): buildCards(), BuildCardsOptions, BuildCardsResult, ensurePublicSymlink(), fileExists(), isUpToDate(), main(), destFile (+4 more)

### Community 12 - "Balance Scale UI"
Cohesion: 0.14
Nodes (13): code:block1 (apps/), code:bash (bun install                    # resolves workspace symlinks), code:bash (# Workspace level (proxied through turbo where appropriate):), graphify, Headball — Multi-Game Platform Monorepo, Key Files, Local development, Project structure (+5 more)

### Community 13 - "Tap Target Tests"
Cohesion: 0.25
Nodes (9): BalanceScale(), BalanceScaleProps, pointerBg(), pointerPercent(), pointerState(), { container }, pointer, { rerender } (+1 more)

### Community 14 - "Customize Loop E2E"
Cohesion: 0.2
Nodes (8): block, css, ctaRules, m, match, minH, minW, repoRoot

### Community 15 - "A11Y Floor (docs + tests)"
Cohesion: 0.22
Nodes (6): banner, blockers, saveBtn, toast, urlAfterSave, villagerTile

### Community 16 - "A11Y E2E Helpers"
Cohesion: 0.29
Nodes (5): cs, cta, el, langToggle, saveBtn

### Community 17 - "Middleware Test"
Cohesion: 0.33
Nodes (4): dest, intlSpy, location, res

### Community 18 - "Store Persistence Test"
Cohesion: 0.33
Nodes (4): memoryStorage, parsed, raw, s

### Community 19 - "Share Roundtrip E2E"
Cohesion: 0.33
Nodes (5): blockers, cdCard, overlay, savedUrl, seerCard

### Community 20 - "Invalid URL E2E"
Cohesion: 0.4
Nodes (4): banner, blockers, toast, villagerCards

### Community 21 - "Next Config"
Cohesion: 0.4
Nodes (5): Bundle Budget Gate (80KB/96KB gz), scripts/check-bundle-budget.ts, Lighthouse Mobile LCP Gate (≤2500ms), .github/lighthouserc.json, Warewolf Perf Gates

### Community 22 - "Card Art E2E"
Cohesion: 0.5
Nodes (3): nextConfig, withAnalyzer, withNextIntl

### Community 23 - "Root App Layout"
Cohesion: 0.5
Nodes (3): imgs, ROLE_IDS, screenshotPath

## Knowledge Gaps
- **258 isolated node(s):** `Quick Reference`, `code:block1 (apps/)`, `code:bash (bun install                    # resolves workspace symlinks)`, `code:bash (# Workspace level (proxied through turbo where appropriate):)`, `Workspace conventions` (+253 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `CardArt()` connect `Card Art Rendering` to `Customize Page & Banner`, `Setup List Page`, `i18n Routing & Layout`, `Rules Page Layout`?**
  _High betweenness centrality (0.052) - this node is a cross-community bridge._
- **Why does `Container()` connect `Rules Page Layout` to `Customize Page & Banner`, `Add Role Sheet`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **What connects `Quick Reference`, `code:block1 (apps/)`, `code:bash (bun install                    # resolves workspace symlinks)` to the rest of the system?**
  _258 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Solver & Archetype Logic` be split into smaller, more focused modules?**
  _Cohesion score 0.06 - nodes in this community are weakly interconnected._
- **Should `Customize Page & Banner` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._
- **Should `V2 Audio Pipeline Docs` be split into smaller, more focused modules?**
  _Cohesion score 0.07 - nodes in this community are weakly interconnected._
- **Should `Card Art Rendering` be split into smaller, more focused modules?**
  _Cohesion score 0.07 - nodes in this community are weakly interconnected._
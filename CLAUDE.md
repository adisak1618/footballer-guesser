# Headball

Mobile multiplayer game ทายชื่อนักฟุตบอลบนหัว — Heads Up-style same-room play for Thai football fans.

## Quick Reference

- **Stack**: Next.js 16 (App Router) + TypeScript strict + Supabase (Postgres + Realtime) + Vercel
- **State**: Zustand client store, Supabase as source of truth
- **Validation**: Zod schemas for all form input
- **Tests**: Vitest (unit) + Playwright (E2E) — Supabase local Docker for integration

## Key Files

- `docs/PLAN.md` — implementation plan, schema, file structure, tasks
- `docs/DESIGN.md` — design system (Stadium Energy aesthetic) — **READ BEFORE ANY UI WORK**
- `docs/DESIGN-clay-reference.md` — old Clay.com reference (legacy, do not use)
- `docs/game-rules.md` — game rules in Thai
- `docs/mood-board.html` — visual preview (open in browser to see all 6 screens)
- `supabase/` — Supabase config + migrations
- `app/` — Next.js App Router pages
- `components/ui/` — shadcn primitives (button, input, dialog)
- `lib/utils.ts` — shadcn cn() helper

## Stadium Energy Design System

Always read `docs/DESIGN.md` before making any visual or UI decisions.
All font choices, colors, spacing, and aesthetic direction are defined there.
Do not deviate without explicit user approval.

**Aesthetic identity**: Stadium Floodlight + Trading Card. Dark navy backgrounds, jersey-bright player tag colors, Bebas Neue at 120-160px for the BIG NAME card. No mascots, no illustrations.

**The memorable thing**: "รู้สึกเหมือนเชียร์ Liverpool ตอนชนะ" — every UI decision should serve this stadium energy.

In QA mode (/qa, /design-review), flag any code that doesn't match `DESIGN.md`.

## Skill routing

When the user's request matches an available skill, ALWAYS invoke it using the Skill
tool as your FIRST action. Do NOT answer directly, do NOT use other tools first.
The skill has specialized workflows that produce better results than ad-hoc answers.

Key routing rules:
- Product ideas, "is this worth building", brainstorming → invoke office-hours
- Bugs, errors, "why is this broken", 500 errors → invoke investigate
- Ship, deploy, push, create PR → invoke ship
- QA, test the site, find bugs → invoke qa
- Code review, check my diff → invoke review
- Update docs after shipping → invoke document-release
- Weekly retro → invoke retro
- Design system, brand → invoke design-consultation
- Visual audit, design polish → invoke design-review
- Architecture review → invoke plan-eng-review
- Save progress, checkpoint, resume → invoke checkpoint
- Code quality, health check → invoke health

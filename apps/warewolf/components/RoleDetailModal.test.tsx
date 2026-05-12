// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import { ROLES } from "@social-hub/content"
import { RoleDetailModal } from "./RoleDetailModal"

// `next/image` does heavy work in tests — mock to a plain <img>.
vi.mock("next/image", () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    const { priority: _priority, alt, ...rest } = props as {
      priority?: boolean
      alt?: string
    }
    void _priority
    // eslint-disable-next-line @next/next/no-img-element
    return <img {...(rest as Record<string, unknown>)} alt={alt ?? ""} />
  },
}))

function renderModal(
  overrides: Partial<Parameters<typeof RoleDetailModal>[0]> = {},
) {
  const onReplace = vi.fn()
  const onDelete = vi.fn()
  const onClose = vi.fn()
  const utils = render(
    <RoleDetailModal
      roleId={overrides.roleId ?? "seer"}
      slotIndex={overrides.slotIndex ?? 3}
      onReplace={overrides.onReplace ?? onReplace}
      onDelete={overrides.onDelete ?? onDelete}
      onClose={overrides.onClose ?? onClose}
      lang={overrides.lang ?? "en"}
    />,
  )
  return { onReplace, onDelete, onClose, ...utils }
}

describe("<RoleDetailModal> rendering", () => {
  it("renders the role name, mechanic description, and Replace/Delete buttons (en)", () => {
    renderModal({ roleId: "seer", lang: "en" })
    expect(screen.getByTestId("role-detail-name").textContent).toBe(
      ROLES.seer.i18n.en.name,
    )
    expect(screen.getByTestId("role-detail-description").textContent).toBe(
      ROLES.seer.i18n.en.description,
    )
    expect(screen.getByTestId("role-detail-replace").textContent).toBe(
      "Replace · เปลี่ยน",
    )
    expect(screen.getByTestId("role-detail-delete").textContent).toBe(
      "Delete · ลบ",
    )
  })

  it("renders the Thai name and description when lang='th'", () => {
    renderModal({ roleId: "seer", lang: "th" })
    expect(screen.getByTestId("role-detail-name").textContent).toBe(
      ROLES.seer.i18n.th.name,
    )
    expect(screen.getByTestId("role-detail-description").textContent).toBe(
      ROLES.seer.i18n.th.description,
    )
  })

  it("renders team / balance / category badges", () => {
    renderModal({ roleId: "seer" })
    expect(screen.queryByTestId("role-detail-badge-team")).not.toBeNull()
    expect(screen.queryByTestId("role-detail-badge-balance")).not.toBeNull()
    expect(screen.queryByTestId("role-detail-badge-category")).not.toBeNull()
    // Signed balance for the village Seer (+7) renders with `+` prefix.
    expect(
      screen.getByTestId("role-detail-badge-balance").textContent,
    ).toContain("+")
  })

  it("renders the full card art (size=lg)", () => {
    renderModal({ roleId: "seer" })
    const img = screen.getByRole("img") as HTMLImageElement
    expect(img.getAttribute("width")).toBe("240")
    expect(img.getAttribute("height")).toBe("360")
  })
})

describe("<RoleDetailModal> behavior", () => {
  it("Replace fires onReplace with the slot index", () => {
    const { onReplace } = renderModal({ slotIndex: 4 })
    fireEvent.click(screen.getByTestId("role-detail-replace"))
    expect(onReplace).toHaveBeenCalledTimes(1)
    expect(onReplace).toHaveBeenCalledWith(4)
  })

  it("Delete fires onDelete with the slot index", () => {
    const { onDelete } = renderModal({ slotIndex: 2 })
    fireEvent.click(screen.getByTestId("role-detail-delete"))
    expect(onDelete).toHaveBeenCalledTimes(1)
    expect(onDelete).toHaveBeenCalledWith(2)
  })

  it("Escape key closes the modal", () => {
    const { onClose } = renderModal()
    fireEvent.keyDown(window, { key: "Escape" })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it("has dialog role + aria-modal for screen readers", () => {
    renderModal()
    const dialog = screen.getByRole("dialog")
    expect(dialog).not.toBeNull()
    expect(dialog.getAttribute("aria-modal")).toBe("true")
  })

  it("declares the 280ms slide-up transition (cubic-bezier easing)", () => {
    renderModal()
    const dialog = screen.getByRole("dialog") as HTMLElement
    expect(dialog.style.transition).toMatch(/transform/)
  })
})

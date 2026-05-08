import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import * as React from "react"

import { SlotInput } from "../slot-input"

function Controlled({
  initial = "",
  onValue,
}: {
  initial?: string
  onValue?: (v: string) => void
}) {
  const [value, setValue] = React.useState(initial)
  return (
    <SlotInput
      value={value}
      onChange={(v) => {
        setValue(v)
        onValue?.(v)
      }}
      aria-label="Room code"
    />
  )
}

describe("SlotInput", () => {
  it("renders 6 cells by default", () => {
    render(<Controlled />)
    const cells = screen.getAllByRole("textbox")
    expect(cells).toHaveLength(6)
  })

  it("auto-advances focus to the next cell on character entry", async () => {
    const user = userEvent.setup()
    render(<Controlled />)
    const cells = screen.getAllByRole("textbox") as HTMLInputElement[]
    cells[0].focus()
    await user.keyboard("A")
    expect(cells[1]).toHaveFocus()
    expect(cells[0].value).toBe("A")
  })

  it("uppercases lowercase input", async () => {
    const user = userEvent.setup()
    render(<Controlled />)
    const cells = screen.getAllByRole("textbox") as HTMLInputElement[]
    cells[0].focus()
    await user.keyboard("a")
    expect(cells[0].value).toBe("A")
  })

  it("rejects characters outside ROOM_CODE_ALPHABET (no I, O, 0, 1)", async () => {
    const user = userEvent.setup()
    const onValue = vi.fn()
    render(<Controlled onValue={onValue} />)
    const cells = screen.getAllByRole("textbox") as HTMLInputElement[]
    cells[0].focus()
    await user.keyboard("I")
    expect(cells[0].value).toBe("")
    await user.keyboard("0")
    expect(cells[0].value).toBe("")
    // valid char still works after invalid attempt
    await user.keyboard("A")
    expect(cells[0].value).toBe("A")
  })

  it("backspace on empty cell focuses and clears the previous cell", async () => {
    const user = userEvent.setup()
    render(<Controlled />)
    const cells = screen.getAllByRole("textbox") as HTMLInputElement[]
    cells[0].focus()
    await user.keyboard("AB")
    // After AB: cell 0 = "A", cell 1 = "B", focus on cell 2
    expect(cells[2]).toHaveFocus()
    await user.keyboard("{Backspace}")
    // empty cell 2 → clears cell 1, focus on cell 1
    expect(cells[1]).toHaveFocus()
    expect(cells[1].value).toBe("")
    expect(cells[0].value).toBe("A")
  })

  it("supports paste of a 6-character string", async () => {
    const user = userEvent.setup()
    const onValue = vi.fn()
    render(<Controlled onValue={onValue} />)
    const cells = screen.getAllByRole("textbox") as HTMLInputElement[]
    cells[0].focus()
    await user.paste("ABC234")
    expect(onValue).toHaveBeenCalledWith("ABC234")
    expect(cells[0].value).toBe("A")
    expect(cells[5].value).toBe("4")
  })

  it("paste filters invalid characters before filling cells", async () => {
    const user = userEvent.setup()
    const onValue = vi.fn()
    render(<Controlled onValue={onValue} />)
    const cells = screen.getAllByRole("textbox") as HTMLInputElement[]
    cells[0].focus()
    // 'I', 'O', '0', '1' should be stripped; remaining: ABC234
    await user.paste("AIBOC02314")
    expect(onValue).toHaveBeenLastCalledWith("ABC234")
  })

  it("calls onChange with the full code when typed sequentially", async () => {
    const user = userEvent.setup()
    const onValue = vi.fn()
    render(<Controlled onValue={onValue} />)
    const cells = screen.getAllByRole("textbox") as HTMLInputElement[]
    cells[0].focus()
    await user.keyboard("ABC234")
    expect(onValue).toHaveBeenLastCalledWith("ABC234")
    expect(cells.map((c) => c.value).join("")).toBe("ABC234")
  })
})

/// <reference types="@testing-library/jest-dom" />
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { JoinInsiderRoomForm } from "@/app/join/join-insider-room-form"

const pushMock = vi.fn()
const joinActionMock = vi.fn()
const getOrCreatePlayerIdMock = vi.fn(
  () => "11111111-1111-4111-8111-111111111111",
)

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}))

vi.mock("@/app/actions/join-insider-room", () => ({
  joinInsiderRoomAction: (...args: unknown[]) => joinActionMock(...args),
}))

vi.mock("@/lib/player-id", () => ({
  getOrCreatePlayerId: () => getOrCreatePlayerIdMock(),
}))

beforeEach(() => {
  pushMock.mockReset()
  joinActionMock.mockReset()
  getOrCreatePlayerIdMock.mockClear()
})

afterEach(() => {
  vi.clearAllMocks()
})

function fillCode(value: string) {
  fireEvent.change(screen.getByLabelText("รหัสห้อง"), {
    target: { value },
  })
}

function fillName(value: string) {
  fireEvent.change(screen.getByLabelText("ชื่อของคุณ"), {
    target: { value },
  })
}

function submit() {
  fireEvent.submit(screen.getByRole("button", { name: /เข้าห้อง/ }).closest("form")!)
}

describe("JoinInsiderRoomForm validation", () => {
  it("shows a code error when the code is shorter than 6 characters", async () => {
    render(<JoinInsiderRoomForm />)
    fillCode("ABC")
    fillName("Player One")
    submit()

    expect(
      await screen.findByText(/รหัสห้องต้องเป็นตัวอักษร 6 ตัว/),
    ).toBeInTheDocument()
    expect(joinActionMock).not.toHaveBeenCalled()
    expect(pushMock).not.toHaveBeenCalled()
  })

  it("shows a name error when the name is empty", async () => {
    render(<JoinInsiderRoomForm />)
    fillCode("ABCDEF")
    fillName("   ")
    submit()

    expect(await screen.findByText(/ใส่ชื่อก่อนนะ/)).toBeInTheDocument()
    expect(joinActionMock).not.toHaveBeenCalled()
  })

  it("uppercases and strips invalid chars from the room code as the user types", () => {
    render(<JoinInsiderRoomForm />)
    fillCode("ab!c-1@2x")
    expect(screen.getByLabelText("รหัสห้อง")).toHaveValue("ABC12X")
  })

  it("calls joinInsiderRoomAction with parsed inputs and routes on success", async () => {
    joinActionMock.mockResolvedValue({
      ok: true,
      code: "ABCDEF",
      playerId: "22222222-2222-4222-8222-222222222222",
    })
    render(<JoinInsiderRoomForm />)
    fillCode("abcdef")
    fillName("  Tester  ")
    submit()

    await waitFor(() => expect(joinActionMock).toHaveBeenCalledTimes(1))
    expect(joinActionMock).toHaveBeenCalledWith({
      code: "ABCDEF",
      displayName: "Tester",
      playerId: "11111111-1111-4111-8111-111111111111",
    })

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/room/ABCDEF"))
  })

  it("surfaces server-action error and does not navigate", async () => {
    joinActionMock.mockResolvedValue({ ok: false, error: "ห้องไม่พบ" })
    render(<JoinInsiderRoomForm />)
    fillCode("ZZZZZZ")
    fillName("Tester")
    submit()

    expect(await screen.findByText("ห้องไม่พบ")).toBeInTheDocument()
    expect(pushMock).not.toHaveBeenCalled()
  })
})

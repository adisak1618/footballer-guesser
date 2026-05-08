import { z } from "zod"

export const displayNameSchema = z
  .string()
  .trim()
  .min(1, "ใส่ชื่อก่อนนะ")
  .max(20, "ชื่อยาวเกิน 20 ตัวอักษร")

export const roomCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9]{6}$/, "รหัสห้องต้องเป็นตัวอักษร 6 ตัว")

export const guessTextSchema = z
  .string()
  .trim()
  .min(1, "พิมพ์ชื่อก่อนนะ")

export type DisplayName = z.infer<typeof displayNameSchema>
export type RoomCode = z.infer<typeof roomCodeSchema>
export type GuessText = z.infer<typeof guessTextSchema>

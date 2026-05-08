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

export const packSlugSchema = z.string().trim().min(1, "เลือกคลังคำก่อนนะ")

export const timeLimitSchema = z.union([
  z.literal(180),
  z.literal(300),
  z.literal(420),
])

export const roundCountSchema = z.number().int().min(1).max(10)

export type DisplayName = z.infer<typeof displayNameSchema>
export type PackSlug = z.infer<typeof packSlugSchema>
export type TimeLimit = z.infer<typeof timeLimitSchema>
export type RoundCount = z.infer<typeof roundCountSchema>

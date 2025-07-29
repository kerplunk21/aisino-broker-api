import { z } from 'zod';

export const schemes = z.enum([
  "Visa",
  "Mastercard",
  "Bancnet"
])

export const AIDSchema = z.object({
  scheme: schemes,
  aid: z.string()
})

export const AIDListSchema = z.array(AIDSchema)

export const CAPKSchema = z.object({
  rid: z.string(),
  index: z.string(),
  scheme: z.string(),
  modulus: z.string(),
  checksum: z.string(),
  exponent: z.string(),
  expiry_date: z.string()
})
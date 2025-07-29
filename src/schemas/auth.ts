import z from "zod";

export const AuthenticatePayloadSchema = z.object({
  access_key: z.string(),
  access_secret: z.string()
})

// AuthData schema
export const AuthDataSchema = z.object({
  id: z.string().optional(),
  access_key: z.string().optional(),
  access_secret: z.string().optional(),
  status: z.enum(['active', 'inactive', 'suspended']).optional(),
  description: z.string().optional(),
  created_at: z.date().optional(),
  updated_at: z.date().optional(),
});

export const CreateAuthPayloadSchema = AuthenticatePayloadSchema.extend({
  description: z.string()
})

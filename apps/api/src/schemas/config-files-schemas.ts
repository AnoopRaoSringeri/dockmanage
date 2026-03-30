import { z } from "zod";

export const configPathSchema = z
  .string()
  .trim()
  .min(1, "Config path is required")
  .regex(/^[a-zA-Z0-9._/\-]+$/, "Config path has invalid characters")
  .refine((value) => value.endsWith(".yml") || value.endsWith(".yaml"), "Only .yml and .yaml files are allowed");

export const readConfigQuerySchema = z.object({
  path: configPathSchema,
});

export const saveConfigBodySchema = z.object({
  path: configPathSchema,
  content: z.string(),
});

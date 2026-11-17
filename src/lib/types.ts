import type { z } from "zod";
import type { petSchema, photoSchema, staySchema } from "@/lib/validations";

// Inferred from the zod schemas, so the types and the validation can't drift apart.
export type Pet = z.output<typeof petSchema>;
export type Stay = z.output<typeof staySchema>;
export type Photo = z.output<typeof photoSchema>;

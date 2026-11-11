import { z } from "zod";
import { slugSchema } from "./common";

export const createWorkspaceBodySchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: slugSchema.optional(),
  type: z.enum(["PERSONAL", "BUSINESS"]),
  baseCurrency: z.string().trim().length(3).default("USD"),
});

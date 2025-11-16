import { z } from "zod";

export const AiResponseSchema = z.object({
  reply: z.string(),
  correction: z.string().optional(),
  cultureNote: z.string().optional(),
  associativePhrases: z.array(z.string()).min(2),
  score: z.number().min(0).max(100),
  scoreReason: z.string().min(1),
});

export type AiResponse = z.infer<typeof AiResponseSchema>;

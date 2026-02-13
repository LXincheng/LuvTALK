import { z } from "zod";

export const KeyTermSchema = z.object({
  term: z.string().min(1),
  definition: z.string().optional().default(""),
  type: z.string().optional(),
  examples: z.array(z.string()).optional().default([]),
});

export const AiResponseSchema = z.object({
  reply: z.string(),
  correction: z.string().optional(),
  cultureNote: z.string().optional(),
  associativePhrases: z.array(z.string()).min(2),
  score: z.number().min(0).max(100),
  scoreReason: z.string().min(1),
  pronunciationTip: z.string().optional(),
  rhythmTip: z.string().optional(),
  grammarTip: z.string().optional(),
  keyTerms: z.array(KeyTermSchema).default([]),
});

export type AiResponse = z.infer<typeof AiResponseSchema>;
export type KeyTerm = z.infer<typeof KeyTermSchema>;

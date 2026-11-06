import { z } from 'zod';

export const adminRowSchema = z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]));
export type AdminRow = z.infer<typeof adminRowSchema>;

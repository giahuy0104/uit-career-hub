import { z } from "zod";

export const notificationIdSchema = z.string().uuid();

export const notificationListQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
  unreadOnly: z
    .preprocess(
      (value) => value === "true" ? true : value === "false" ? false : value,
      z.boolean().optional().default(false),
    ),
});

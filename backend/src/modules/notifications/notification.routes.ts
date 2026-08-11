import type { Request } from "express";
import { Router } from "express";

import { createAuthenticate, type AccessPrincipalStore } from "../../middleware/auth.js";
import { AppError } from "../../shared/app-error.js";
import { TokenService } from "../auth/token.service.js";
import { notificationIdSchema, notificationListQuerySchema } from "./notification.schemas.js";
import { NotificationService } from "./notification.service.js";

function userId(request: Request) {
  if (!request.auth) {
    throw new AppError(401, "AUTH_ACCESS_TOKEN_MISSING", "Vui lòng đăng nhập để tiếp tục.");
  }
  return request.auth.userId;
}

function pageMeta(page: number, pageSize: number, totalItems: number) {
  return { page, pageSize, totalItems, totalPages: Math.ceil(totalItems / pageSize) };
}

export function createNotificationRouter(
  service: NotificationService,
  tokenService: TokenService,
  accessPrincipalStore: AccessPrincipalStore,
) {
  const router = Router();
  router.use(createAuthenticate(tokenService, accessPrincipalStore));

  router.get("/notifications", async (request, response) => {
    const query = notificationListQuerySchema.parse(request.query);
    const result = await service.list(userId(request), query);
    response.json({ data: result.items, meta: pageMeta(query.page, query.pageSize, result.total) });
  });

  router.get("/notifications/unread-count", async (request, response) => {
    response.json({ data: await service.unreadCount(userId(request)) });
  });

  router.post("/notifications/read-all", async (request, response) => {
    await service.markAllRead(userId(request));
    response.status(204).send();
  });

  router.post("/notifications/:notificationId/read", async (request, response) => {
    await service.markRead(userId(request), notificationIdSchema.parse(request.params.notificationId));
    response.status(204).send();
  });

  return router;
}

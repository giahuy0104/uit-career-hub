import type { CookieOptions, Request, Response } from "express";
import { Router } from "express";
import { rateLimit } from "express-rate-limit";

import { env } from "../../config/env.js";
import { createAuthenticate } from "../../middleware/auth.js";
import { AppError } from "../../shared/app-error.js";
import { companyActivationSchema, loginSchema } from "./auth.schemas.js";
import { AuthService } from "./auth.service.js";
import { TokenService } from "./token.service.js";

function requestMetadata(request: Request) {
  return {
    ipAddress: request.ip || null,
    userAgent: request.get("user-agent")?.slice(0, 512) ?? null,
  };
}

function refreshCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: env.authCookieSecure,
    sameSite: env.authCookieSameSite,
    path: "/api/v1/auth",
    maxAge: env.refreshTokenTtlDays * 24 * 60 * 60 * 1000,
  };
}

function setRefreshCookie(response: Response, refreshToken: string) {
  response.cookie(env.authCookieName, refreshToken, refreshCookieOptions());
}

function clearRefreshCookie(response: Response) {
  const { maxAge: _maxAge, ...options } = refreshCookieOptions();
  response.clearCookie(env.authCookieName, options);
}

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.nodeEnv === "test" ? 1_000 : 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: (_request, response) => {
    response.status(429).json({
      error: {
        code: "AUTH_RATE_LIMITED",
        message: "Bạn đã thử quá nhiều lần. Vui lòng chờ và thử lại.",
        details: [],
        traceId: response.locals.traceId ?? "unknown",
      },
    });
  },
});

export function createAuthRouter(service: AuthService, tokenService = new TokenService()) {
  const router = Router();

  router.post("/login", authLimiter, async (request, response) => {
    const input = loginSchema.parse(request.body);
    const result = await service.login(input.email, input.password, requestMetadata(request));
    setRefreshCookie(response, result.refreshToken);
    response.setHeader("cache-control", "no-store");
    response.json({ data: result.session });
  });

  router.post("/refresh", authLimiter, async (request, response) => {
    const result = await service.refresh(
      request.cookies[env.authCookieName] as string | undefined,
      requestMetadata(request),
    );
    setRefreshCookie(response, result.refreshToken);
    response.setHeader("cache-control", "no-store");
    response.json({ data: result.session });
  });

  router.post("/logout", async (request, response) => {
    await service.logout(
      request.cookies[env.authCookieName] as string | undefined,
      requestMetadata(request),
    );
    clearRefreshCookie(response);
    response.status(204).send();
  });

  router.post("/company-activation", authLimiter, async (request, response) => {
    const input = companyActivationSchema.parse(request.body);
    await service.activateCompanyAccount(input.token, input.password, requestMetadata(request));
    response.status(204).send();
  });

  router.get("/me", createAuthenticate(tokenService), async (request, response) => {
    if (!request.auth) {
      throw new AppError(401, "AUTH_ACCESS_TOKEN_MISSING", "Vui lòng đăng nhập để tiếp tục.");
    }
    response.setHeader("cache-control", "no-store");
    response.json({ data: await service.getCurrentUser(request.auth.userId) });
  });

  return router;
}

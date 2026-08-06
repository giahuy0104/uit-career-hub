import type { NextFunction, Request, Response } from "express";

import { AppError } from "../shared/app-error.js";
import { TokenService } from "../modules/auth/token.service.js";
import type { UserRole } from "../modules/auth/auth.types.js";

export function createAuthenticate(tokenService = new TokenService()) {
  return async function authenticate(request: Request, _response: Response, next: NextFunction) {
    try {
      const authorization = request.header("authorization");
      const [scheme, token, extra] = authorization?.split(" ") ?? [];
      if (scheme !== "Bearer" || !token || extra) {
        throw new AppError(401, "AUTH_ACCESS_TOKEN_MISSING", "Vui lòng đăng nhập để tiếp tục.");
      }
      request.auth = await tokenService.verifyAccessToken(token);
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function requireRoles(...allowedRoles: UserRole[]) {
  return function authorizeRole(request: Request, _response: Response, next: NextFunction) {
    if (!request.auth) {
      next(new AppError(401, "AUTH_ACCESS_TOKEN_MISSING", "Vui lòng đăng nhập để tiếp tục."));
      return;
    }
    if (!allowedRoles.includes(request.auth.role)) {
      next(new AppError(403, "AUTH_FORBIDDEN", "Bạn không có quyền thực hiện thao tác này."));
      return;
    }
    next();
  };
}

export function requireCompanyOwnership(parameterName = "companyId") {
  return function authorizeCompanyOwnership(request: Request, _response: Response, next: NextFunction) {
    if (!request.auth) {
      next(new AppError(401, "AUTH_ACCESS_TOKEN_MISSING", "Vui lòng đăng nhập để tiếp tục."));
      return;
    }
    if (request.auth.role === "UIT_ADMIN") {
      next();
      return;
    }
    if (
      request.auth.role !== "COMPANY" ||
      !request.auth.companyId ||
      request.auth.companyId !== request.params[parameterName]
    ) {
      next(new AppError(404, "RESOURCE_NOT_FOUND", "Không tìm thấy tài nguyên."));
      return;
    }
    next();
  };
}

export function requireStudentOwnership(parameterName = "studentProfileId") {
  return function authorizeStudentOwnership(request: Request, _response: Response, next: NextFunction) {
    if (!request.auth) {
      next(new AppError(401, "AUTH_ACCESS_TOKEN_MISSING", "Vui lòng đăng nhập để tiếp tục."));
      return;
    }
    if (request.auth.role === "UIT_ADMIN") {
      next();
      return;
    }
    if (
      request.auth.role !== "STUDENT" ||
      !request.auth.studentProfileId ||
      request.auth.studentProfileId !== request.params[parameterName]
    ) {
      next(new AppError(404, "RESOURCE_NOT_FOUND", "Không tìm thấy tài nguyên."));
      return;
    }
    next();
  };
}

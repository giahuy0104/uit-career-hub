import type { NextFunction, Request, Response } from "express";

import { AppError } from "../shared/app-error.js";
import type { TokenService } from "../modules/auth/token.service.js";
import type { AuthPrincipal, AuthUser, UserRole } from "../modules/auth/auth.types.js";

export type AccessPrincipalStore = {
  findUserById(userId: string): Promise<AuthUser | null>;
};

function isCurrentPrincipal(user: AuthUser | null, principal: AuthPrincipal) {
  return Boolean(
    user &&
      user.status === "ACTIVE" &&
      user.role === principal.role &&
      user.studentProfileId === principal.studentProfileId &&
      user.companyId === principal.companyId,
  );
}

export function createAuthenticate(
  tokenService: TokenService,
  accessPrincipalStore: AccessPrincipalStore,
) {
  return async function authenticate(request: Request, _response: Response, next: NextFunction) {
    try {
      const authorization = request.header("authorization");
      const [scheme, token, extra] = authorization?.split(" ") ?? [];
      if (scheme !== "Bearer" || !token || extra) {
        throw new AppError(401, "AUTH_ACCESS_TOKEN_MISSING", "Vui lòng đăng nhập để tiếp tục.");
      }
      const principal = await tokenService.verifyAccessToken(token);
      const user = await accessPrincipalStore.findUserById(principal.userId);
      if (!isCurrentPrincipal(user, principal)) {
        throw new AppError(
          401,
          "AUTH_ACCESS_REVOKED",
          "Phiên đăng nhập không còn hiệu lực. Vui lòng đăng nhập lại.",
        );
      }
      request.auth = principal;
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
    if (request.auth.role === "STUDENT" && !request.auth.studentProfileId) {
      next(new AppError(403, "AUTH_CONTEXT_MISSING", "Tài khoản chưa được liên kết với hồ sơ sinh viên."));
      return;
    }
    if (request.auth.role === "COMPANY" && !request.auth.companyId) {
      next(new AppError(403, "AUTH_CONTEXT_MISSING", "Tài khoản chưa được liên kết với doanh nghiệp."));
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

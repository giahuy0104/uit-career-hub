import { randomUUID } from "node:crypto";

import { env } from "../../config/env.js";
import { AppError } from "../../shared/app-error.js";
import { AuthRepository } from "./auth.repository.js";
import { hashPassword, verifyPassword } from "./password.js";
import { TokenService } from "./token.service.js";
import { toUserDto, type AuthUser, type RequestMetadata } from "./auth.types.js";

export class AuthService {
  constructor(
    private readonly repository: AuthRepository,
    private readonly tokens = new TokenService(),
  ) {}

  async login(email: string, password: string, request: RequestMetadata) {
    let user = await this.repository.findUserByEmail(email.toLowerCase());

    if (!user || !user.passwordHash) {
      await this.repository.recordAudit({
        actorUserId: user?.id ?? null,
        action: "AUTH_LOGIN_FAILED",
        targetType: "USER",
        targetId: user?.id ?? null,
        metadata: { reason: "INVALID_CREDENTIALS" },
        request,
      });
      throw new AppError(401, "AUTH_INVALID_CREDENTIALS", "Email hoặc mật khẩu không chính xác.");
    }

    if (user.status === "LOCKED" && user.lockedUntil && user.lockedUntil.getTime() <= Date.now()) {
      await this.repository.unlockIfExpired(user.id);
      user = (await this.repository.findUserById(user.id)) ?? user;
    }

    if (user.status === "LOCKED") {
      throw new AppError(423, "AUTH_ACCOUNT_LOCKED", "Tài khoản đang bị khóa tạm thời. Vui lòng thử lại sau.");
    }

    if (!user.passwordHash) {
      throw new AppError(401, "AUTH_INVALID_CREDENTIALS", "Email hoặc mật khẩu không chính xác.");
    }

    const passwordMatches = await verifyPassword(password, user.passwordHash);
    if (!passwordMatches) {
      await this.repository.recordFailedLogin(user.id);
      await this.repository.recordAudit({
        actorUserId: user.id,
        action: "AUTH_LOGIN_FAILED",
        targetType: "USER",
        targetId: user.id,
        metadata: { reason: "INVALID_CREDENTIALS" },
        request,
      });
      throw new AppError(401, "AUTH_INVALID_CREDENTIALS", "Email hoặc mật khẩu không chính xác.");
    }

    if (user.status !== "ACTIVE") {
      throw new AppError(403, "AUTH_ACCOUNT_INACTIVE", "Tài khoản chưa được kích hoạt hoặc đã bị tạm ngưng.");
    }

    if (user.role === "STUDENT" && !this.isAllowedStudentEmail(user.email)) {
      throw new AppError(403, "AUTH_STUDENT_EMAIL_NOT_ALLOWED", "Tài khoản sinh viên phải sử dụng email UIT hợp lệ.");
    }

    await this.repository.markLoginSucceeded(user.id);
    await this.repository.recordAudit({
      actorUserId: user.id,
      action: "AUTH_LOGIN_SUCCEEDED",
      targetType: "USER",
      targetId: user.id,
      request,
    });
    return this.issueSession(user, request);
  }

  async refresh(refreshToken: string | undefined, request: RequestMetadata) {
    if (!refreshToken) {
      throw new AppError(401, "AUTH_REFRESH_TOKEN_MISSING", "Phiên đăng nhập không tồn tại.");
    }

    const nextToken = this.tokens.createRefreshToken();
    const nextTokenId = randomUUID();
    const user = await this.repository.rotateRefreshToken({
      currentTokenHash: this.tokens.hashOpaqueToken(refreshToken),
      nextTokenId,
      nextTokenHash: this.tokens.hashOpaqueToken(nextToken),
      nextExpiresAt: this.refreshExpiry(),
      metadata: request,
    });

    if (!user) {
      throw new AppError(401, "AUTH_INVALID_REFRESH_TOKEN", "Phiên đăng nhập không hợp lệ hoặc đã hết hạn.");
    }

    const access = await this.tokens.signAccessToken(user);
    return {
      refreshToken: nextToken,
      session: {
        accessToken: access.accessToken,
        expiresIn: access.expiresIn,
        user: toUserDto(user),
      },
    };
  }

  async logout(refreshToken: string | undefined, request: RequestMetadata, actorUserId?: string) {
    if (refreshToken) {
      await this.repository.revokeRefreshToken(this.tokens.hashOpaqueToken(refreshToken));
    }
    await this.repository.recordAudit({
      actorUserId: actorUserId ?? null,
      action: "AUTH_LOGOUT",
      targetType: "AUTH_SESSION",
      targetId: null,
      request,
    });
  }

  async activateCompanyAccount(token: string, password: string, request: RequestMetadata) {
    const userId = await this.repository.activateCompanyAccount(
      this.tokens.hashOpaqueToken(token),
      await hashPassword(password),
    );
    if (!userId) {
      throw new AppError(400, "AUTH_ACTIVATION_TOKEN_INVALID", "Liên kết kích hoạt không hợp lệ hoặc đã hết hạn.");
    }
    await this.repository.recordAudit({
      actorUserId: userId,
      action: "COMPANY_ACCOUNT_ACTIVATED",
      targetType: "USER",
      targetId: userId,
      request,
    });
  }

  async getCurrentUser(userId: string) {
    const user = await this.repository.findUserById(userId);
    if (!user || user.status !== "ACTIVE") {
      throw new AppError(401, "AUTH_SESSION_USER_INACTIVE", "Tài khoản không còn hoạt động.");
    }
    return toUserDto(user);
  }

  isAllowedStudentEmail(email: string) {
    const domain = email.toLowerCase().split("@")[1];
    return Boolean(domain && env.uitEmailDomains.includes(domain));
  }

  private async issueSession(user: AuthUser, request: RequestMetadata) {
    const refreshToken = this.tokens.createRefreshToken();
    await this.repository.createRefreshToken({
      id: randomUUID(),
      userId: user.id,
      familyId: randomUUID(),
      tokenHash: this.tokens.hashOpaqueToken(refreshToken),
      expiresAt: this.refreshExpiry(),
      metadata: request,
    });
    const access = await this.tokens.signAccessToken(user);
    return {
      refreshToken,
      session: {
        accessToken: access.accessToken,
        expiresIn: access.expiresIn,
        user: toUserDto(user),
      },
    };
  }

  private refreshExpiry() {
    return new Date(Date.now() + env.refreshTokenTtlDays * 24 * 60 * 60 * 1000);
  }
}

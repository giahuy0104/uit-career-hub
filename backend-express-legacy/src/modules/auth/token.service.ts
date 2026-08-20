import { createHash, randomBytes, randomUUID } from "node:crypto";
import { jwtVerify, SignJWT } from "jose";

import { env } from "../../config/env.js";
import { AppError } from "../../shared/app-error.js";
import { userRoles, type AuthPrincipal, type AuthUser, type UserRole } from "./auth.types.js";

export type TokenConfiguration = {
  secret: string;
  issuer: string;
  audience: string;
  accessTokenTtlSeconds: number;
};

const defaultConfiguration: TokenConfiguration = {
  secret: env.jwtAccessSecret,
  issuer: env.jwtIssuer,
  audience: env.jwtAudience,
  accessTokenTtlSeconds: env.accessTokenTtlSeconds,
};

export class TokenService {
  private readonly secret: Uint8Array;

  constructor(private readonly configuration = defaultConfiguration) {
    this.secret = new TextEncoder().encode(configuration.secret);
  }

  async signAccessToken(user: AuthUser) {
    const tokenId = randomUUID();
    const accessToken = await new SignJWT({
      role: user.role,
      email: user.email,
      studentProfileId: user.studentProfileId,
      companyId: user.companyId,
    })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setSubject(user.id)
      .setJti(tokenId)
      .setIssuer(this.configuration.issuer)
      .setAudience(this.configuration.audience)
      .setIssuedAt()
      .setExpirationTime(`${this.configuration.accessTokenTtlSeconds}s`)
      .sign(this.secret);

    return { accessToken, tokenId, expiresIn: this.configuration.accessTokenTtlSeconds };
  }

  async verifyAccessToken(accessToken: string): Promise<AuthPrincipal> {
    try {
      const { payload } = await jwtVerify(accessToken, this.secret, {
        issuer: this.configuration.issuer,
        audience: this.configuration.audience,
      });

      if (
        !payload.sub ||
        !payload.jti ||
        typeof payload.email !== "string" ||
        typeof payload.role !== "string" ||
        !userRoles.includes(payload.role as UserRole)
      ) {
        throw new Error("Invalid claims");
      }

      return {
        userId: payload.sub,
        tokenId: payload.jti,
        email: payload.email,
        role: payload.role as UserRole,
        studentProfileId:
          typeof payload.studentProfileId === "string" ? payload.studentProfileId : null,
        companyId: typeof payload.companyId === "string" ? payload.companyId : null,
      };
    } catch {
      throw new AppError(401, "AUTH_INVALID_ACCESS_TOKEN", "Phiên đăng nhập không hợp lệ hoặc đã hết hạn.");
    }
  }

  createRefreshToken() {
    return randomBytes(48).toString("base64url");
  }

  hashOpaqueToken(token: string) {
    return createHash("sha256").update(token).digest("hex");
  }
}

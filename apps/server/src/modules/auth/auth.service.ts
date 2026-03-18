import { Injectable, Logger } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Request } from "express";
import { PrismaService } from "../../core/prisma/prisma.service";

interface GoogleIdTokenPayload {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
}

interface SupabaseUserPayload {
  id: string;
  email?: string | null;
  phone?: string | null;
  user_metadata?: {
    full_name?: string | null;
    avatar_url?: string | null;
  };
}

export interface AuthTokens {
  accessToken: string;
}

export interface AuthUserProfile {
  id: string;
  email?: string;
  name?: string;
  avatarUrl?: string;
}

export interface AuthResult {
  tokens: AuthTokens;
  profile: AuthUserProfile;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async exchangeCodeForGoogleIdToken(params: {
    code: string;
    redirectUri: string;
  }): Promise<string | undefined> {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      this.logger.warn(
        "Google OAuth env missing; GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET not set.",
      );
      return undefined;
    }

    const body = new URLSearchParams({
      code: params.code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: params.redirectUri,
      grant_type: "authorization_code",
    });

    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error(
        `Google token exchange failed (${response.status}): ${errorText}`,
      );
      return undefined;
    }

    const payload = (await response.json()) as {
      id_token?: string;
    };
    return payload.id_token;
  }

  // 为避免额外依赖，这里仅对 id_token 做结构解析；生产环境应使用 google-auth-library 验证签名。
  decodeGoogleIdToken(idToken: string): GoogleIdTokenPayload | undefined {
    const parts = idToken.split(".");
    if (parts.length !== 3) {
      this.logger.warn("Invalid Google ID token format.");
      return undefined;
    }
    try {
      const json = Buffer.from(parts[1], "base64").toString("utf8");
      const payload = JSON.parse(json) as GoogleIdTokenPayload;
      if (!payload.sub) {
        this.logger.warn("Google ID token missing sub claim.");
        return undefined;
      }
      return payload;
    } catch (error) {
      this.logger.error(
        `Failed to decode Google ID token: ${(error as Error).message}`,
      );
      return undefined;
    }
  }

  async loginWithGoogleIdToken(idToken: string): Promise<AuthResult | null> {
    const payload = this.decodeGoogleIdToken(idToken);
    if (!payload) {
      return null;
    }
    const user = await this.prisma.user.upsert({
      where: { id: payload.sub },
      update: {
        email: payload.email ?? undefined,
        name: payload.name ?? undefined,
        avatarUrl: payload.picture ?? undefined,
      },
      create: {
        id: payload.sub,
        email: payload.email ?? undefined,
        name: payload.name ?? undefined,
        avatarUrl: payload.picture ?? undefined,
      },
    });
    const profile = this.mapUserToProfile(user);
    const accessToken = await this.jwt.signAsync({
      sub: profile.id,
      email: profile.email,
      name: profile.name,
    });
    return {
      tokens: { accessToken },
      profile,
    };
  }

  async getProfile(userId: string): Promise<AuthUserProfile | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    return user ? this.mapUserToProfile(user) : null;
  }

  async resolveUserFromRequest(
    request: Request,
  ): Promise<AuthUserProfile | undefined> {
    const token = this.extractTokenFromHeader(
      request.headers.authorization ?? "",
    );
    if (!token) {
      return undefined;
    }
    const supabaseProfile = await this.verifySupabaseAccessToken(token);
    if (supabaseProfile) {
      return supabaseProfile;
    }
    return this.verifyAccessToken(token);
  }

  async verifyAccessToken(token: string): Promise<AuthUserProfile | undefined> {
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string }>(token);
      return (await this.getProfile(payload.sub)) ?? undefined;
    } catch (error) {
      this.logger.warn(
        `Failed to verify access token: ${(error as Error).message}`,
      );
      return undefined;
    }
  }

  async verifySupabaseAccessToken(
    token: string,
  ): Promise<AuthUserProfile | undefined> {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) {
      return undefined;
    }
    try {
      const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: supabaseAnonKey,
        },
      });
      if (!response.ok) {
        return undefined;
      }
      const payload = (await response.json()) as SupabaseUserPayload;
      if (!payload?.id) {
        return undefined;
      }
      const profile = await this.upsertSupabaseUser(payload);
      return profile;
    } catch (error) {
      this.logger.warn(
        `Supabase token verification failed: ${(error as Error).message}`,
      );
      return undefined;
    }
  }

  private async upsertSupabaseUser(
    payload: SupabaseUserPayload,
  ): Promise<AuthUserProfile> {
    const displayName =
      payload.user_metadata?.full_name ??
      payload.email ??
      payload.phone ??
      undefined;
    const avatarUrl = payload.user_metadata?.avatar_url ?? undefined;
    const user = await this.prisma.user.upsert({
      where: { id: payload.id },
      update: {
        email: payload.email ?? undefined,
        name: displayName,
        avatarUrl,
      },
      create: {
        id: payload.id,
        email: payload.email ?? undefined,
        name: displayName,
        avatarUrl,
      },
    });
    return this.mapUserToProfile(user);
  }

  private extractTokenFromHeader(header: string): string | undefined {
    const [type, token] = header.split(" ");
    return type === "Bearer" && token ? token : undefined;
  }

  private mapUserToProfile(user: {
    id: string;
    email?: string | null;
    name?: string | null;
    avatarUrl?: string | null;
  }): AuthUserProfile {
    return {
      id: user.id,
      email: user.email ?? undefined,
      name: user.name ?? undefined,
      avatarUrl: user.avatarUrl ?? undefined,
    };
  }
}

import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Req,
  ServiceUnavailableException,
  UseGuards,
} from "@nestjs/common";
import { Request } from "express";
import { AuthService, AuthResult } from "./auth.service";
import { JwtAuthGuard } from "./jwt-auth.guard";

interface GoogleAuthDto {
  code: string;
  redirectUri: string;
}

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("google")
  async googleLogin(@Body() dto: GoogleAuthDto): Promise<AuthResult> {
    const trimmedCode = dto.code?.trim();
    const trimmedRedirect = dto.redirectUri?.trim();
    if (!trimmedCode || !trimmedRedirect) {
      throw new BadRequestException("code 和 redirectUri 均为必填");
    }

    const idToken = await this.authService.exchangeCodeForGoogleIdToken({
      code: trimmedCode,
      redirectUri: trimmedRedirect,
    });

    if (!idToken) {
      throw new ServiceUnavailableException("当前无法完成 Google 登录");
    }

    const result = await this.authService.loginWithGoogleIdToken(idToken);
    if (!result) {
      throw new ServiceUnavailableException("Google 登录响应无效");
    }

    return result;
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  async me(@Req() request: Request) {
    if (!request.user?.id) {
      throw new ServiceUnavailableException("未能识别当前用户");
    }
    const profile = await this.authService.getProfile(request.user.id);
    if (!profile) {
      throw new ServiceUnavailableException("无法拉取用户资料");
    }
    return profile;
  }
}

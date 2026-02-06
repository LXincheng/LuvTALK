import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Request } from "express";
import { AuthService } from "./auth.service";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const profile = await this.authService.resolveUserFromRequest(request);
    if (!profile) {
      throw new UnauthorizedException("缺少登录凭证");
    }
    request.user = {
      id: profile.id,
      email: profile.email,
      name: profile.name,
    };
    return true;
  }
}

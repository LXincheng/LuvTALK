import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
} from "@nestjs/common";
import { Request } from "express";
import { AuthService } from "../auth/auth.service";
import { FavoritesService } from "./favorites.service";
import { CreateFavoriteDto } from "./dto/create-favorite.dto";

@Controller("favorites")
export class FavoritesController {
  constructor(
    private readonly favoritesService: FavoritesService,
    private readonly authService: AuthService,
  ) {}

  @Get()
  async list(@Req() req: Request) {
    const profile = await this.authService.resolveUserFromRequest(req);
    return this.favoritesService.list(profile?.id);
  }

  @Post()
  async create(@Body() dto: CreateFavoriteDto, @Req() req: Request) {
    const profile = await this.authService.resolveUserFromRequest(req);
    return this.favoritesService.create(dto, profile?.id);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.favoritesService.remove(id);
  }
}

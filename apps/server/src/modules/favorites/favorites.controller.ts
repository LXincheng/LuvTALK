import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { FavoritesService } from './favorites.service';
import { CreateFavoriteDto } from './dto/create-favorite.dto';

@Controller('favorites')
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  @Get()
  list() {
    return this.favoritesService.list();
  }

  @Post()
  create(@Body() dto: CreateFavoriteDto) {
    return this.favoritesService.create(dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.favoritesService.remove(id);
  }
}

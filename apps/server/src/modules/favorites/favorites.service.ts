import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import { FavoriteTypeEnum } from "../../common/enums/favorite-type.enum";
import { FavoriteItem } from "../../common/types/conversation.types";
import { PrismaService } from "../../core/prisma/prisma.service";
import { CreateFavoriteDto } from "./dto/create-favorite.dto";

@Injectable()
export class FavoritesService {
  private readonly favorites = new Map<string, FavoriteItem>();

  constructor(private readonly prisma: PrismaService) {}

  private readonly defaultFavorites: FavoriteItem[] = [
    {
      id: randomUUID(),
      type: FavoriteTypeEnum.Cultural,
      title: "餐厅礼貌表达",
      content: "唔该晒，可唔可以推荐一两款招牌菜？",
      metadata: { scenario: "restaurant", language: "cantonese" },
      createdAt: new Date().toISOString(),
      pinned: true,
      authorName: "LuvTALK 导师",
      avatar: "https://api.dicebear.com/6.x/bottts-neutral/svg?seed=chef",
    },
    {
      id: randomUUID(),
      type: FavoriteTypeEnum.Phrase,
      title: "购物对话",
      content: "How much is this in a medium size?",
      metadata: { scenario: "shopping", language: "english" },
      createdAt: new Date().toISOString(),
      authorName: "Learner",
      avatar: "https://api.dicebear.com/6.x/bottts-neutral/svg?seed=student",
    },
  ];

  list(): FavoriteItem[] {
    const items = this.favorites.size
      ? Array.from(this.favorites.values())
      : this.defaultFavorites;
    return items.sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1));
  }

  async create(dto: CreateFavoriteDto): Promise<FavoriteItem> {
    const favorite: FavoriteItem = {
      id: randomUUID(),
      type: dto.type ?? FavoriteTypeEnum.Phrase,
      title: dto.title,
      content: dto.content,
      metadata: dto.metadata,
      pinned: dto.pinned ?? false,
      authorName:
        dto.type === FavoriteTypeEnum.Phrase ? "Learner" : "LuvTALK 导师",
      avatar:
        dto.type === FavoriteTypeEnum.Phrase
          ? "https://api.dicebear.com/6.x/bottts-neutral/svg?seed=student"
          : "https://api.dicebear.com/6.x/bottts-neutral/svg?seed=mentor",
      createdAt: new Date().toISOString(),
    };

    this.favorites.set(favorite.id, favorite);

    if (this.prisma.canUseDatabase()) {
      await this.prisma.favorite.create({
        data: {
          id: favorite.id,
          type: favorite.type,
          title: favorite.title,
          content: favorite.content,
          metadata: favorite.metadata as Prisma.InputJsonValue,
        },
      });
    }

    return favorite;
  }

  async remove(id: string): Promise<void> {
    if (this.favorites.has(id)) {
      this.favorites.delete(id);
      if (this.prisma.canUseDatabase()) {
        await this.prisma.favorite.delete({ where: { id } });
      }
      return;
    }

    const sampleIndex = this.defaultFavorites.findIndex((fav) => fav.id === id);
    if (sampleIndex >= 0) {
      this.defaultFavorites.splice(sampleIndex, 1);
      return;
    }

    if (this.prisma.canUseDatabase()) {
      await this.prisma.favorite.delete({ where: { id } });
      return;
    }

    throw new NotFoundException(`Favorite ${id} not found`);
  }
}

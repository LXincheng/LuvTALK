import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import { FavoriteTypeEnum } from "../../common/enums/favorite-type.enum";
import { FavoriteItem } from "../../common/types/conversation.types";
import { PrismaService } from "../../core/prisma/prisma.service";
import { CreateFavoriteDto } from "./dto/create-favorite.dto";

@Injectable()
export class FavoritesService {
  private readonly logger = new Logger(FavoritesService.name);
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

  async list(userId?: string): Promise<FavoriteItem[]> {
    if (
      !this.prisma.canUseDatabase() &&
      !this.prisma.allowsInMemoryFallback()
    ) {
      this.prisma.ensurePersistentStorageAvailable();
    }

    if (this.prisma.canUseDatabase()) {
      try {
        const records = await this.prisma.favorite.findMany({
          where: userId ? { userId } : undefined,
          orderBy: { createdAt: "desc" },
        });
        if (records.length > 0) {
          return records.map((record) => {
            const favoriteType = record.type as FavoriteTypeEnum;
            return {
              id: record.id,
              type: favoriteType,
              title: record.title,
              content: record.content,
              metadata: (record.metadata as Record<string, unknown>) ?? undefined,
              createdAt: record.createdAt.toISOString(),
              pinned: false,
              authorName:
                favoriteType === FavoriteTypeEnum.Phrase
                  ? "Learner"
                  : "LuvTALK 导师",
              avatar:
                favoriteType === FavoriteTypeEnum.Phrase
                  ? "https://api.dicebear.com/6.x/bottts-neutral/svg?seed=student"
                  : "https://api.dicebear.com/6.x/bottts-neutral/svg?seed=mentor",
              conversationId: record.conversationId ?? undefined,
            };
          });
        }
      } catch (error) {
        if (this.isConnectionError(error)) {
          // Fall through to in-memory / default fallback below.
        } else {
          throw error;
        }
      }
    }

    if (userId) {
      return [];
    }

    const items = this.favorites.size
      ? Array.from(this.favorites.values())
      : this.defaultFavorites;
    return items.sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1));
  }

  async create(dto: CreateFavoriteDto, userId?: string): Promise<FavoriteItem> {
    this.prisma.ensurePersistentStorageAvailable();
    const favoriteType = dto.type ?? FavoriteTypeEnum.Phrase;
    const favorite: FavoriteItem = {
      id: randomUUID(),
      type: favoriteType,
      title: dto.title,
      content: dto.content,
      metadata: dto.metadata,
      pinned: dto.pinned ?? false,
      authorName:
        favoriteType === FavoriteTypeEnum.Phrase ? "Learner" : "LuvTALK 导师",
      avatar:
        favoriteType === FavoriteTypeEnum.Phrase
          ? "https://api.dicebear.com/6.x/bottts-neutral/svg?seed=student"
          : "https://api.dicebear.com/6.x/bottts-neutral/svg?seed=mentor",
      createdAt: new Date().toISOString(),
      conversationId: dto.conversationId,
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
          conversationId: favorite.conversationId,
          userId,
        },
      });
    }

    return favorite;
  }

  async remove(id: string, userId?: string): Promise<void> {
    if (this.favorites.has(id)) {
      this.favorites.delete(id);
      return;
    }

    const sampleIndex = this.defaultFavorites.findIndex((fav) => fav.id === id);
    if (sampleIndex >= 0) {
      this.defaultFavorites.splice(sampleIndex, 1);
      return;
    }

    if (this.prisma.canUseDatabase() && userId) {
      const deleted = await this.prisma.favorite.deleteMany({
        where: {
          id,
          userId,
        },
      });
      if (deleted.count > 0) {
        return;
      }
      throw new NotFoundException(`Favorite ${id} not found`);
    }

    if (this.prisma.canUseDatabase()) {
      throw new NotFoundException(`Favorite ${id} not found`);
    }

    if (!this.prisma.allowsInMemoryFallback()) {
      this.prisma.ensurePersistentStorageAvailable();
    }

    throw new NotFoundException(`Favorite ${id} not found`);
  }

  private isConnectionError(error: unknown): boolean {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === "P1001" || error.code === "P1002")
    ) {
      this.logger.warn(
        `Database connection lost during favorites query: ${error.code}`,
      );
      this.prisma.markDatabaseUnavailable(
        `Favorites service connection failure (${error.code}).`,
      );
      return true;
    }
    return false;
  }
}

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './core/prisma/prisma.module';
import { ConversationModule } from './modules/conversation/conversation.module';
import { FavoritesModule } from './modules/favorites/favorites.module';
import { HealthModule } from './modules/health/health.module';
import { TranslationModule } from './modules/translation/translation.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    ConversationModule,
    TranslationModule,
    FavoritesModule,
    HealthModule,
  ],
})
export class AppModule {}

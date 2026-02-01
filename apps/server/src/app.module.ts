import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "./core/prisma/prisma.module";
import { AuthModule } from "./modules/auth/auth.module";
import { ConversationModule } from "./modules/conversation/conversation.module";
import { CultureModule } from "./modules/culture/culture.module";
import { FavoritesModule } from "./modules/favorites/favorites.module";
import { HealthModule } from "./modules/health/health.module";
import { TranslationModule } from "./modules/translation/translation.module";
import { VoiceTutorModule } from "./modules/voice-tutor/voice-tutor.module";
import { AppCacheModule } from "./common/cache/cache.module";
import { ReviewModule } from "./modules/review/review.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AuthModule,
    AppCacheModule,
    PrismaModule,
    ConversationModule,
    CultureModule,
    TranslationModule,
    FavoritesModule,
    ReviewModule,
    HealthModule,
    VoiceTutorModule,
  ],
})
export class AppModule {}

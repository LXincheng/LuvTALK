import { Module } from "@nestjs/common";
import { CultureController } from "./culture.controller";
import { CultureService } from "./culture.service";

@Module({
  controllers: [CultureController],
  providers: [CultureService],
  exports: [CultureService],
})
export class CultureModule {}

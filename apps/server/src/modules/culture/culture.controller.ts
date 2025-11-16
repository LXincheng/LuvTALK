import { Controller, Get, Query } from "@nestjs/common";
import { CultureService } from "./culture.service";
import { GetCulturePopupsDto } from "./dto/get-popups.dto";

@Controller("culture")
export class CultureController {
  constructor(private readonly cultureService: CultureService) {}

  @Get("popups")
  getCultureCards(@Query() query: GetCulturePopupsDto) {
    return this.cultureService.listPopups({
      targetLanguage: query.targetLanguage,
      nativeLanguage: query.nativeLanguage,
    });
  }
}

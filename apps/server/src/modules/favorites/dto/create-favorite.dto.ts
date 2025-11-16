import {
  IsBoolean,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";
import { FavoriteTypeEnum } from "../../../common/enums/favorite-type.enum";

export class CreateFavoriteDto {
  @IsString()
  @MaxLength(60)
  title!: string;

  @IsString()
  content!: string;

  @IsEnum(FavoriteTypeEnum)
  type!: FavoriteTypeEnum;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  pinned?: boolean;
}

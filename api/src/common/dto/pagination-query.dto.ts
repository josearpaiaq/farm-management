import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

// Shared by every list endpoint (see plan, API Conventions).
export class PaginationQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 50;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset: number = 0;
}

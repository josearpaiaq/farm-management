import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentOrgId } from '../common/decorators/current-org-id.decorator';
import { BreedsService } from './breeds.service';
import { CreateBreedDto } from './dto/create-breed.dto';
import { ListBreedsQueryDto } from './dto/list-breeds-query.dto';

@ApiTags('breeds')
@Controller('breeds')
export class BreedsController {
  constructor(private readonly breedsService: BreedsService) {}

  @Get()
  list(
    @CurrentOrgId() organizationId: string,
    @Query() query: ListBreedsQueryDto,
  ) {
    return this.breedsService.list(organizationId, query);
  }

  @Post()
  create(@CurrentOrgId() organizationId: string, @Body() dto: CreateBreedDto) {
    return this.breedsService.create(organizationId, dto);
  }
}

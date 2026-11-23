import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentOrgId } from '../common/decorators/current-org-id.decorator';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { CreateFarmDto } from './dto/create-farm.dto';
import { UpdateFarmDto } from './dto/update-farm.dto';
import { FarmsService } from './farms.service';

const uuidPipe = new ParseUUIDPipe({
  errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
});

@ApiTags('farms')
@Controller('farms')
export class FarmsController {
  constructor(private readonly farmsService: FarmsService) {}

  @Get()
  list(
    @CurrentOrgId() organizationId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.farmsService.list(organizationId, query);
  }

  @Post()
  create(@CurrentOrgId() organizationId: string, @Body() dto: CreateFarmDto) {
    return this.farmsService.create(organizationId, dto);
  }

  @Get(':id')
  findOne(
    @CurrentOrgId() organizationId: string,
    @Param('id', uuidPipe) id: string,
  ) {
    return this.farmsService.findOne(organizationId, id);
  }

  @Patch(':id')
  update(
    @CurrentOrgId() organizationId: string,
    @Param('id', uuidPipe) id: string,
    @Body() dto: UpdateFarmDto,
  ) {
    return this.farmsService.update(organizationId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentOrgId() organizationId: string,
    @Param('id', uuidPipe) id: string,
  ) {
    return this.farmsService.remove(organizationId, id);
  }
}

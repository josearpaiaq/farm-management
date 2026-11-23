import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentOrgId } from '../common/decorators/current-org-id.decorator';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { AnimalRecordsService } from './animal-records.service';
import { CreateWeightDto } from './dto/create-weight.dto';

const uuidPipe = new ParseUUIDPipe({
  errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
});

@ApiTags('weights')
@Controller('animals/:animalId/weights')
export class WeightsController {
  constructor(private readonly recordsService: AnimalRecordsService) {}

  @Get()
  list(
    @CurrentOrgId() organizationId: string,
    @Param('animalId', uuidPipe) animalId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.recordsService.listWeights(organizationId, animalId, query);
  }

  @Post()
  create(
    @CurrentOrgId() organizationId: string,
    @Param('animalId', uuidPipe) animalId: string,
    @Body() dto: CreateWeightDto,
  ) {
    return this.recordsService.addWeight(organizationId, animalId, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentOrgId() organizationId: string,
    @Param('animalId', uuidPipe) animalId: string,
    @Param('id', uuidPipe) id: string,
  ) {
    return this.recordsService.removeWeight(organizationId, animalId, id);
  }
}

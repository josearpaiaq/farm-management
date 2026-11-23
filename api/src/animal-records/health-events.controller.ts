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
import { CreateHealthEventDto } from './dto/create-health-event.dto';

const uuidPipe = new ParseUUIDPipe({
  errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
});

@ApiTags('health-events')
@Controller('animals/:animalId/health-events')
export class HealthEventsController {
  constructor(private readonly recordsService: AnimalRecordsService) {}

  @Get()
  list(
    @CurrentOrgId() organizationId: string,
    @Param('animalId', uuidPipe) animalId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.recordsService.listHealthEvents(
      organizationId,
      animalId,
      query,
    );
  }

  @Post()
  create(
    @CurrentOrgId() organizationId: string,
    @Param('animalId', uuidPipe) animalId: string,
    @Body() dto: CreateHealthEventDto,
  ) {
    return this.recordsService.addHealthEvent(organizationId, animalId, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentOrgId() organizationId: string,
    @Param('animalId', uuidPipe) animalId: string,
    @Param('id', uuidPipe) id: string,
  ) {
    return this.recordsService.removeHealthEvent(organizationId, animalId, id);
  }
}

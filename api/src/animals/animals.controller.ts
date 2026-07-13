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
import { AnimalsService } from './animals.service';
import { CreateAnimalDto } from './dto/create-animal.dto';
import { ListAnimalsQueryDto } from './dto/list-animals-query.dto';
import { UpdateAnimalDto } from './dto/update-animal.dto';

const uuidPipe = new ParseUUIDPipe({
  errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
});

@ApiTags('animals')
@Controller('animals')
export class AnimalsController {
  constructor(private readonly animalsService: AnimalsService) {}

  @Get()
  list(
    @CurrentOrgId() organizationId: string,
    @Query() query: ListAnimalsQueryDto,
  ) {
    return this.animalsService.list(organizationId, query);
  }

  // Declared before :id so 'stats' is not captured as an animal id.
  @Get('stats')
  stats(@CurrentOrgId() organizationId: string) {
    return this.animalsService.stats(organizationId);
  }

  @Post()
  create(@CurrentOrgId() organizationId: string, @Body() dto: CreateAnimalDto) {
    return this.animalsService.create(organizationId, dto);
  }

  @Get(':id')
  findOne(
    @CurrentOrgId() organizationId: string,
    @Param('id', uuidPipe) id: string,
  ) {
    return this.animalsService.findOne(organizationId, id);
  }

  @Patch(':id')
  update(
    @CurrentOrgId() organizationId: string,
    @Param('id', uuidPipe) id: string,
    @Body() dto: UpdateAnimalDto,
  ) {
    return this.animalsService.update(organizationId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentOrgId() organizationId: string,
    @Param('id', uuidPipe) id: string,
  ) {
    return this.animalsService.remove(organizationId, id);
  }
}

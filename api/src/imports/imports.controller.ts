import {
  Controller,
  DefaultValuePipe,
  Get,
  Header,
  HttpStatus,
  Param,
  ParseBoolPipe,
  ParseUUIDPipe,
  Post,
  Query,
  UnprocessableEntityException,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiTags } from '@nestjs/swagger';
import { CurrentOrgId } from '../common/decorators/current-org-id.decorator';
import { CurrentUserId } from '../common/decorators/current-user-id.decorator';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { CSV_TEMPLATE, ImportsService } from './imports.service';

const uuidPipe = new ParseUUIDPipe({
  errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
});

@ApiTags('imports')
@Controller('imports')
export class ImportsController {
  constructor(private readonly importsService: ImportsService) {}

  // Downloadable template constraining the source format (see plan).
  // Declared before :id so the literal path wins.
  @Get('animals/template')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="animals-template.csv"')
  template(): string {
    return CSV_TEMPLATE;
  }

  // Dry run by default: validates and reports without writing anything.
  // Pass ?dry_run=false to commit the valid rows.
  @Post('animals')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }),
  )
  importAnimals(
    @CurrentOrgId() organizationId: string,
    @CurrentUserId() userId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Query('dry_run', new DefaultValuePipe(true), ParseBoolPipe)
    dryRun: boolean,
  ) {
    if (!file) {
      throw new UnprocessableEntityException({
        message: 'Validation failed',
        details: [{ field: 'file', message: 'A CSV file is required' }],
      });
    }
    return this.importsService.importAnimals(
      organizationId,
      userId,
      file,
      dryRun,
    );
  }

  @Get()
  list(
    @CurrentOrgId() organizationId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.importsService.listJobs(organizationId, query);
  }

  @Get(':id')
  findOne(
    @CurrentOrgId() organizationId: string,
    @Param('id', uuidPipe) id: string,
  ) {
    return this.importsService.findJob(organizationId, id);
  }

  @Get(':id/report')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="import-report.csv"')
  report(
    @CurrentOrgId() organizationId: string,
    @Param('id', uuidPipe) id: string,
  ): Promise<string> {
    return this.importsService.buildReport(organizationId, id);
  }
}

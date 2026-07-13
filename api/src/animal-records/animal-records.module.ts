import { Module } from '@nestjs/common';
import { AnimalRecordsService } from './animal-records.service';
import { HealthEventsController } from './health-events.controller';
import { NotesController } from './notes.controller';
import { WeightsController } from './weights.controller';

@Module({
  controllers: [WeightsController, HealthEventsController, NotesController],
  providers: [AnimalRecordsService],
})
export class AnimalRecordsModule {}

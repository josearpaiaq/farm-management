import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateFarmDto } from './create-farm.dto';

// The id is identity, not an editable attribute.
export class UpdateFarmDto extends PartialType(
  OmitType(CreateFarmDto, ['id'] as const),
) {}

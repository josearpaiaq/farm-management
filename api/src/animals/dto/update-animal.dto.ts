import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateAnimalDto } from './create-animal.dto';

// The id is identity, not an editable attribute. Changing `tag` updates the
// primary identifier; changing `status` drives the lifecycle (no deletes).
export class UpdateAnimalDto extends PartialType(
  OmitType(CreateAnimalDto, ['id'] as const),
) {}

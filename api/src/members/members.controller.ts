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
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentOrgId } from '../common/decorators/current-org-id.decorator';
import { CurrentUserId } from '../common/decorators/current-user-id.decorator';
import { InviteMemberDto } from './dto/invite-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { MembersService } from './members.service';

const uuidPipe = new ParseUUIDPipe({
  errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
});

@ApiTags('members')
@Controller('members')
export class MembersController {
  constructor(private readonly membersService: MembersService) {}

  @Get()
  list(@CurrentOrgId() organizationId: string) {
    return this.membersService.list(organizationId);
  }

  @Post()
  invite(
    @CurrentOrgId() organizationId: string,
    @CurrentUserId() userId: string,
    @Body() dto: InviteMemberDto,
  ) {
    return this.membersService.invite(organizationId, userId, dto);
  }

  @Patch(':id')
  update(
    @CurrentOrgId() organizationId: string,
    @CurrentUserId() userId: string,
    @Param('id', uuidPipe) id: string,
    @Body() dto: UpdateMemberDto,
  ) {
    return this.membersService.update(organizationId, userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentOrgId() organizationId: string,
    @CurrentUserId() userId: string,
    @Param('id', uuidPipe) id: string,
  ) {
    return this.membersService.remove(organizationId, userId, id);
  }
}

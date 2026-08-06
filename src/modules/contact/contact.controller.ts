import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { MessageStatus, Role } from '@prisma/client';
import { ContactService } from './contact.service';
import {
  CreateContactMessageDto,
  ReplyContactMessageDto,
} from './dto/contact.dto';
import { Public } from '../../common/decorators/public.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types/authenticated-user.interface';

@ApiTags('Contact')
@Controller()
export class ContactController {
  constructor(private contactService: ContactService) {}

  @Public()
  @Post('contact')
  create(@Body() dto: CreateContactMessageDto) {
    return this.contactService.create(dto);
  }

  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.STAFF)
  @Get('admin/messages')
  adminFindAll(@Query('status') status?: MessageStatus) {
    return this.contactService.adminFindAll(status);
  }

  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.STAFF)
  @Get('admin/messages/:id')
  adminFindOne(@Param('id') id: string) {
    return this.contactService.adminFindOne(id);
  }

  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.STAFF)
  @Patch('admin/messages/:id/reply')
  reply(
    @Param('id') id: string,
    @Body() dto: ReplyContactMessageDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.contactService.reply(id, dto, user.id);
  }

  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.STAFF)
  @Patch('admin/messages/:id/archive')
  archive(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.contactService.archive(id, user.id);
  }
}

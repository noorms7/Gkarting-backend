import { Injectable, NotFoundException } from '@nestjs/common';
import { MessageStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { MailService } from '../mail/mail.service';
import {
  CreateContactMessageDto,
  ReplyContactMessageDto,
} from './dto/contact.dto';

@Injectable()
export class ContactService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private mail: MailService,
  ) {}

  async create(dto: CreateContactMessageDto) {
    const message = await this.prisma.contactMessage.create({ data: dto });
    return {
      id: message.id,
      message: "Thanks — we'll get back to you shortly.",
    };
  }

  async adminFindAll(status?: MessageStatus) {
    return this.prisma.contactMessage.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
    });
  }

  async adminFindOne(id: string) {
    const message = await this.prisma.contactMessage.findUnique({
      where: { id },
    });
    if (!message) throw new NotFoundException('Message not found');
    return message;
  }

  async reply(id: string, dto: ReplyContactMessageDto, actorId: string) {
    const message = await this.adminFindOne(id);
    const updated = await this.prisma.contactMessage.update({
      where: { id },
      data: {
        status: MessageStatus.REPLIED,
        replyText: dto.replyText,
        repliedAt: new Date(),
        repliedById: actorId,
      },
    });

    await this.mail.sendCustomEmail(
      message.email,
      `Re: ${message.subject || 'Your message to GKarting'}`,
      `<p>Hi ${message.name},</p><p>${dto.replyText}</p><p>— The GKarting team</p>`,
    );

    await this.audit.log({
      actorId,
      action: 'CONTACT_MESSAGE_REPLIED',
      entityType: 'ContactMessage',
      entityId: id,
    });

    return updated;
  }

  async archive(id: string, actorId: string) {
    await this.adminFindOne(id);
    const updated = await this.prisma.contactMessage.update({
      where: { id },
      data: { status: MessageStatus.ARCHIVED },
    });
    await this.audit.log({
      actorId,
      action: 'CONTACT_MESSAGE_ARCHIVED',
      entityType: 'ContactMessage',
      entityId: id,
    });
    return updated;
  }
}

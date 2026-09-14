import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SendMessageDto, CreateConversationDto } from '../dto/message.dto';

@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async createConversation(dto: CreateConversationDto, clientId: string) {
    const existing = dto.missionId
      ? await this.prisma.conversation.findUnique({ where: { missionId: dto.missionId } })
      : null;

    if (existing) return this.findById(existing.id);

    return this.prisma.conversation.create({
      data: {
        clientId,
        providerId: dto.providerId,
        missionId: dto.missionId || null,
        type: dto.missionId ? 'mission' : 'support',
      },
      include: { client: true, provider: true, messages: true },
    });
  }

  async findByUser(userId: string) {
    return this.prisma.conversation.findMany({
      where: {
        OR: [{ clientId: userId }, { providerId: userId }],
      },
      include: {
        client: { select: { id: true, firstName: true, lastName: true, phone: true, avatarUrl: true } },
        provider: { select: { id: true, firstName: true, lastName: true, phone: true, avatarUrl: true } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findById(id: string) {
    return this.prisma.conversation.findUnique({
      where: { id },
      include: {
        client: { select: { id: true, firstName: true, lastName: true, phone: true, avatarUrl: true } },
        provider: { select: { id: true, firstName: true, lastName: true, phone: true, avatarUrl: true } },
        messages: { orderBy: { createdAt: 'asc' } },
      },
    });
  }

  async sendMessage(dto: SendMessageDto, senderId: string) {
    let conversationId = dto.conversationId;

    if (!conversationId && dto.missionId) {
      const conv = await this.prisma.conversation.findUnique({ where: { missionId: dto.missionId } });
      if (!conv) throw new NotFoundException('Conversation introuvable');
      conversationId = conv.id;
    }

    if (!conversationId) throw new NotFoundException('Conversation introuvable');

    const message = await this.prisma.message.create({
      data: {
        content: dto.content,
        senderId,
        conversationId,
        imageUrl: dto.imageUrl,
        locationLat: dto.locationLat,
        locationLng: dto.locationLng,
      },
      include: { sender: { select: { id: true, firstName: true, avatarUrl: true } } },
    });

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        client: { select: { id: true, firstName: true, lastName: true } },
        provider: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    if (conversation) {
      const recipientId =
        senderId === conversation.clientId ? conversation.providerId : conversation.clientId;
      const sender =
        senderId === conversation.clientId ? conversation.client : conversation.provider;
      const senderName = [sender?.firstName, sender?.lastName].filter(Boolean).join(' ').trim() || 'Bag\'up';
      if (recipientId && recipientId !== senderId) {
        await this.notifications.notifyNewMessage(recipientId, senderName, conversationId).catch(() => {});
      }
    }

    return message;
  }

  async markAsRead(conversationId: string, userId: string) {
    return this.prisma.message.updateMany({
      where: { conversationId, senderId: { not: userId }, isRead: false },
      data: { isRead: true },
    });
  }

  async deleteMessage(messageId: string, userId: string) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!message) throw new NotFoundException('Message introuvable');
    if (message.senderId !== userId) throw new ForbiddenException('Vous ne pouvez supprimer que vos propres messages');

    await this.prisma.message.delete({ where: { id: messageId } });
    return { success: true, message: 'Message supprimé' };
  }
}

import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Request, NotFoundException, ForbiddenException } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { SendMessageDto, CreateConversationDto } from '../dto/message.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('messages')
@UseGuards(JwtAuthGuard)
export class MessagesController {
  constructor(private readonly messages: MessagesService) {}

  @Post('conversation')
  createConversation(@Body() dto: CreateConversationDto, @Request() req: any) {
    return this.messages.createConversation(dto, req.user.sub);
  }

  @Get('conversations')
  myConversations(@Request() req: any) {
    return this.messages.findByUser(req.user.sub);
  }

  @Get('conversation/:id')
  conversation(@Param('id') id: string) {
    return this.messages.findById(id);
  }

  @Post()
  send(@Body() dto: SendMessageDto, @Request() req: any) {
    return this.messages.sendMessage(dto, req.user.sub);
  }

  @Patch('conversation/:id/read')
  markRead(@Param('id') id: string, @Request() req: any) {
    return this.messages.markAsRead(id, req.user.sub);
  }

  @Delete(':id')
  async deleteMessage(@Param('id') id: string, @Request() req: any) {
    return this.messages.deleteMessage(id, req.user.sub);
  }
}

import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  TUpdateClientSMSChatTrack,
  TUpdateClientEmailChatTrack,
} from '../interfaces/conversation-track.interface';

@Injectable()
export class InfobipConversationTrackService {
  constructor(private readonly db: PrismaService) {}

  /**
   * Update SMS chat tracking for a client (Infobip)
   */
  async updateNewSMSChatTrack({
    clientId,
    smsLastMessage,
    lastMessageBy,
    lastEmailBy,
  }: TUpdateClientSMSChatTrack) {
    const updatedData = await this.db.clientConversationTrack.upsert({
      where: { clientId },
      create: {
        clientId,
        emailLastMessage: '',
        smsLastMessage,
        smsIsRead: lastMessageBy === 'Company' ? true : false,
        emailIsRead: true,
        smsUnReadCount: lastMessageBy === 'Company' ? 0 : 1,
        emailIsUnReadCount: 0,
        lastMessageBy,
        lastEmailBy: lastEmailBy,
        sendAt: new Date(),
      },
      update: {
        smsLastMessage,
        smsIsRead: lastMessageBy === 'Company' ? true : false,
        sendAt: new Date(),
        smsUnReadCount: {
          increment: lastMessageBy === 'Company' ? 0 : 1,
        },
        lastMessageBy,
        // Don't update lastEmailBy when SMS is sent/received
        ...(lastEmailBy !== undefined && { lastEmailBy }),
      },
    });
    return updatedData;
  }

  /**
   * Update email chat tracking for a client
   */
  async updateNewEmailChatTrack({
    clientId,
    emailLastMessage,
    lastMessageBy,
    lastEmailBy,
  }: TUpdateClientEmailChatTrack) {
    const updatedData = await this.db.clientConversationTrack.upsert({
      where: { clientId },
      create: {
        clientId,
        emailLastMessage,
        smsLastMessage: '',
        smsIsRead: true,
        emailIsRead: lastMessageBy === 'Company' ? true : false,
        smsUnReadCount: 0,
        emailIsUnReadCount: lastMessageBy === 'Company' ? 0 : 1,
        lastMessageBy,
        lastEmailBy: lastEmailBy || lastMessageBy,
        sendAt: new Date(),
      },
      update: {
        emailLastMessage,
        emailIsRead: lastMessageBy === 'Company' ? true : false,
        sendAt: new Date(),
        emailIsUnReadCount: {
          increment: lastMessageBy === 'Company' ? 0 : 1,
        },
        lastMessageBy,
        lastEmailBy: lastEmailBy || lastMessageBy,
      },
    });
    return updatedData;
  }
}

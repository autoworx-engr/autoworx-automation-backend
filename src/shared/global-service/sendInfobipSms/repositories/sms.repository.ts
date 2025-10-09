import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateInfobipSmsDto } from '../dto/createSms.dto';

@Injectable()
export class InfobipSmsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getInfobipConfigById(companyId: number): Promise<any> {
    return await this.prisma.infobipConfig.findFirst({
      where: {
        companyId,
      },
    });
  }

  getClientById(
    clientId: number,
    params?: Omit<Parameters<typeof this.prisma.client.findUnique>[0], 'where'>,
  ) {
    return this.prisma.client.findUnique({
      where: {
        id: clientId,
      },
      ...params,
    });
  }

  async createSms({
    phoneNumber,
    message,
    to,
    clientId,
    userId,
    companyId,
  }: CreateInfobipSmsDto) {
    return await this.prisma.clientSMS.create({
      data: {
        from: phoneNumber,
        to,
        message: message ?? '',
        sentBy: 'Company',
        userId: userId,
        isRead: true,
        clientId,
        companyId: companyId,
      },
    });
  }

  async createSmsAttachment(data: {
    name: string;
    url: string;
    clientSMSId: number;
  }) {
    return await this.prisma.clientSmsAttachments.create({
      data,
    });
  }

  async getSmsWithAttachments(smsId: number) {
    return await this.prisma.clientSMS.findFirst({
      where: {
        id: smsId,
      },
      include: {
        attachments: true,
      },
    });
  }
}

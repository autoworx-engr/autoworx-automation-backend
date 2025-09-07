import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateSmsDto } from '../dto/createSms.dto';

@Injectable()
export class SmsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getTwilioCredentialsById(companyId: number) {
    return this.prisma.twilioCredentials.findFirst({
      where: {
        companyId,
      },
    });
  }

  async getClientById(
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
  }: CreateSmsDto) {
    await this.prisma.clientSMS.create({
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
}

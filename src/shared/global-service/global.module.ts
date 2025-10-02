import { Global, Module } from '@nestjs/common';
import { MailService } from './sendEmail/mail.service';
import { HttpModule } from '@nestjs/axios';
import { SmsService } from './sendSms/sms.service';
import { SmsRepository } from './sendSms/repositories/sms.repository';
import { GlobalRepository } from './repository/global.repository';
import { MailUtils } from './sendEmail/mail.utils';
import { DateUtils } from './utils/date.utils';
import { ConversationTrackService } from './sendSms/services/conversation-track.service';
import { UrlShortenerService } from './url-shortener/url-shortener.service';
import { InfobipSmsService } from './sendInfobipSms/infobip-sms.service';
import { InfobipSmsRepository } from './sendInfobipSms/repositories/sms.repository';
import { InfobipConversationTrackService } from './sendInfobipSms/services/conversation-track.service';

@Global() // 👈 This makes it globally available
@Module({
  imports: [HttpModule],
  providers: [
    MailService,
    SmsService,
    SmsRepository,
    GlobalRepository,
    MailUtils,
    DateUtils,
    ConversationTrackService,
    UrlShortenerService,
    InfobipSmsService,
    InfobipSmsRepository,
    InfobipConversationTrackService,
  ],
  exports: [
    MailService,
    SmsService,
    SmsRepository,
    GlobalRepository,
    MailUtils,
    DateUtils,
    ConversationTrackService,
    UrlShortenerService,
    InfobipSmsService,
    InfobipSmsRepository,
    InfobipConversationTrackService,
  ],
})
export class GlobalModule {}

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
  ],
})
export class GlobalModule {}

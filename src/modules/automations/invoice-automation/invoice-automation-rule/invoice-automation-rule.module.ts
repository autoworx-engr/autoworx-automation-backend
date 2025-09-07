import { Module } from '@nestjs/common';
import { InvoiceAutomationRuleController } from './controllers/invoice-automation-rule.controller';
import { InvoiceAutomationRuleService } from './invoice-automation-rule.service';
import { InvoiceAutomationRuleRepository } from './repositories/invoice-automation.repository';

@Module({
  controllers: [InvoiceAutomationRuleController],
  providers: [InvoiceAutomationRuleService, InvoiceAutomationRuleRepository],
})
export class InvoiceAutomationRuleModule {}

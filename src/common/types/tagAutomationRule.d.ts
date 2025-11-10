import { Prisma } from '@prisma/client';

export type TagAutomationRuleWithRelations =
  Prisma.TagAutomationRuleGetPayload<{
    include: {
      tag: true;
      tagAutomationPipeline: true;
      tagAutomationCommunication: {
        include: {
          attachments: true;
        };
      };
      PostTagAutomationColumn: true;
    };
  }>;

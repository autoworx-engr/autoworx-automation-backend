import { ConditionType } from '@prisma/client';

export const pipelineConditionTypeEnum = [
  'APPOINTMENT_SCHEDULED',
  'ESTIMATE_CREATED',
  'MESSAGE_RECEIVED_CLIENT',
  'MESSAGE_SENT_CLIENT',
  'TASK_CREATED',
  'TIME_DELAY',
] as ConditionType[];

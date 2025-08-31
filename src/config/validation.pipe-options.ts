import { BadRequestException, ValidationPipeOptions } from '@nestjs/common';
import { ValidationError } from 'class-validator';

export const validationPipeOptions: ValidationPipeOptions = {
  transform: true,
  exceptionFactory: (errors: ValidationError[]) => {
    const formattedErrors = errors.map((err) => ({
      field: err.property,
      errors: Object.values(err.constraints || {}),
    }));
    return new BadRequestException({
      message: 'Validation failed',
      errors: formattedErrors,
    });
  },
};

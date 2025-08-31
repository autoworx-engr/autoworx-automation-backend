import { ApiProperty } from '@nestjs/swagger';

// Keep only minimal DTOs if needed for documentation
export class UserProfileDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  email: string;

  @ApiProperty()
  firstName: string;

  @ApiProperty()
  lastName: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  role: string;

  @ApiProperty()
  companyId: number;

  @ApiProperty()
  employeeType: string;

  @ApiProperty()
  isSuperAdmin: boolean;
}

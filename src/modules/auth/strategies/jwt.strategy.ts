import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../../prisma/prisma.service';

export interface JwtPayload {
  id: number; // user id
  firstName: string;
  lastName: string;
  email: string;
  companyId: number;
  role: string;
  isSuperAdmin: boolean;
  employeeType: string;
  iat?: number;
  exp?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const secret =
      configService.get<string>('accessSecret') ||
      process.env.ACCESS_SECRET ||
      'your-secret-key';

    console.log(
      'JWT Secret being used:',
      secret ? '[CONFIGURED]' : '[FALLBACK]',
    );

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: JwtPayload) {
    // Since the frontend already includes all user data in the JWT payload,
    // we can optionally verify the user still exists in the database
    const user = await this.prisma.user.findUnique({
      where: { id: payload.id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        companyId: true,
        employeeType: true,
        isSuperAdmin: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Return the user data from the database to ensure consistency
    const result = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      name: `${user.firstName} ${user.lastName}`,
      role: user.role,
      companyId: user.companyId,
      employeeType: user.employeeType,
      isSuperAdmin: user.isSuperAdmin,
    };
    return result;
  }
}

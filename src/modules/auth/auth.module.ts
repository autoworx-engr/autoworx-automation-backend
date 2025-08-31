import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { PrismaModule } from './../../prisma/prisma.module';

import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [PrismaModule, PassportModule, ConfigModule],
  controllers: [AuthController],
  providers: [JwtStrategy],
  exports: [],
})
export class AuthModule {}

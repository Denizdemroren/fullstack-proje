// backend-nestjs/src/auth/jwt-auth.guard.ts
// JWT Strategy'i kullanan Guard

import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
// 'jwt' adını, JwtStrategy dosyasındaki PassportStrategy(Strategy) çağrısından alır.
export class JwtAuthGuard extends AuthGuard('jwt') {}
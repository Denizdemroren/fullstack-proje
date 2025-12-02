// backend-nestjs/src/auth/local-auth.guard.ts
// Passport Local Strategy'i kullanan Guard

import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
// 'local' adını, LocalStrategy dosyasındaki PassportStrategy(Strategy) çağrısından alır.
export class LocalAuthGuard extends AuthGuard('local') {}
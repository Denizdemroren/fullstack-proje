import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../user/user.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private userService: UserService,
    private jwtService: JwtService,
  ) {}

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.userService.findByEmail(email);
    if (user && await bcrypt.compare(password, user.password)) {
      const { password, ...result } = user;
      return result;
    }
    return null;
  }

  async login(user: any) {
    const payload = { email: user.email, sub: user.id };
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
    };
  }

  async register(userDto: any) {
    const existingUser = await this.userService.findByEmail(userDto.email);
    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    const user = await this.userService.create({
      email: userDto.email,
      password: userDto.password,
      firstName: userDto.firstName,
      lastName: userDto.lastName,
    });

    const { password, ...result } = user;
    return result;
  }
}

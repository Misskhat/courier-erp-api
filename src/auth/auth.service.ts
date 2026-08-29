import { ConflictException, Injectable } from '@nestjs/common';
import { RegisterDto } from './dto/register.dto';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}
  async register(registerDto: RegisterDto) {
    const { name, email, password } = registerDto;

    //check user email in database
    const existingUser = await this.prisma.user.findUnique({
      where: {
        email,
      },
    });

    //throw error if user found in db
    if (existingUser) {
      throw new ConflictException('Email already register');
    }

    //user password hashing through bcrypt
    const hashedPassword = await bcrypt.hash(password, 10);

    //user create in database
    const user = await this.prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
      },
    });

    //generate random token
    const token = randomBytes(32).toString('hex');

    //set expire time
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    //save token and expire
    await this.prisma.emailVerificationToken.create({
      data: {
        token,
        userId: user.id,
        expiresAt,
      },
    });

    const verificationUrl = `http://localhost:3000/auth/verify?token=${token}&email=${encodeURIComponent(user.email)}`;

    return {
      message: 'Registration successfully',
      verificationUrl,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        isVerified: user.isVerified,
      },
    };
  }
}

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { RegisterDto } from './dto/register.dto';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { LoginDto } from './dto/login.dto';
import { JwtService } from '@nestjs/jwt';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}
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

  async verifyEmail(verifyEmailDto: VerifyEmailDto) {
    const { email, token } = verifyEmailDto;

    const verificationToken =
      await this.prisma.emailVerificationToken.findUnique({
        where: {
          token,
        },
        include: {
          user: true,
        },
      });

    if (!verificationToken) {
      throw new BadRequestException('Invalid verification token');
    }

    if (verificationToken.user.email !== email) {
      throw new BadRequestException('Invalid verification email');
    }

    if (new Date() > verificationToken.expiresAt) {
      throw new BadRequestException('Verification token expired');
    }

    if (verificationToken.user.isVerified) {
      throw new BadRequestException('Email already verify');
    }

    await this.prisma.user.update({
      where: {
        id: verificationToken.userId,
      },
      data: {
        isVerified: true,
      },
    });

    await this.prisma.emailVerificationToken.delete({
      where: {
        id: verificationToken.id,
      },
    });

    return {
      message: 'Email verified successfully',
    };
  }

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    const user = await this.prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid Email');
    }

    if (!user.isVerified) {
      throw new UnauthorizedException('Please verify your  email first');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Password not match');
    }

    const payload = {
      sub: user.id,
      email: user.email,
    };

    const accessToken = this.jwtService.sign(payload);

    return {
      message: 'Login successfully',
      accessToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    };
  }

  async forgotPassword(forgotPasswordDto: ForgotPasswordDto) {
    const { email } = forgotPasswordDto;

    const user = await this.prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await this.prisma.passwordResetToken.create({
      data: {
        token,
        userId: user.id,
        expiresAt,
      },
    });

    return { message: 'Password reset token generate sucessfully.', token };
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto) {
    const { token, password } = resetPasswordDto;

    const resetToken = await this.prisma.passwordResetToken.findUnique({
      where: {
        token,
      },
      include: {
        user: true,
      },
    });

    if (!resetToken) {
      throw new BadRequestException('Invalid or expired token');
    }

    if (new Date() > resetToken.expiresAt) {
      throw new BadRequestException('Reset token expired');
    }

    const isPasswordSame = await bcrypt.compare(
      password,
      resetToken.user.password,
    );

    if (isPasswordSame) {
      throw new BadRequestException(
        'New Passworld can not be the same old password',
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await this.prisma.user.update({
      where: {
        id: resetToken.userId,
      },
      data: {
        password: hashedPassword,
      },
    });

    await this.prisma.passwordResetToken.delete({
      where: {
        id: resetToken.id,
      },
    });

    return { message: 'Password reset successfully' };
  }
}

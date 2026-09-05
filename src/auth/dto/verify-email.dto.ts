import { IsEmail, IsEmpty, IsNotEmpty, IsString } from 'class-validator';

export class VerifyEmailDto {
  @IsEmail()
  email: string;

  @IsNotEmpty()
  @IsString()
  token: string;
}

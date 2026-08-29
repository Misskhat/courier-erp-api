import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;
}

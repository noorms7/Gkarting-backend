import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  Validate,
} from 'class-validator';
import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';

const STRONG_PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\da-zA-Z]).{8,64}$/;

@ValidatorConstraint({ name: 'NewPasswordsMatch', async: false })
export class NewPasswordsMatchConstraint
  implements ValidatorConstraintInterface
{
  validate(confirmPassword: string, args: ValidationArguments) {
    const object = args.object as ResetPasswordDto | ChangePasswordDto;
    return confirmPassword === object.newPassword;
  }
  defaultMessage() {
    return 'Passwords do not match';
  }
}

export class VerifyEmailDto {
  @ApiProperty()
  @IsString()
  token: string;
}

export class ResendVerificationDto {
  @ApiProperty({ example: 'alex@example.com' })
  @IsEmail()
  email: string;
}

export class ForgotPasswordDto {
  @ApiProperty({ example: 'alex@example.com' })
  @IsEmail()
  email: string;
}

export class ResetPasswordDto {
  @ApiProperty()
  @IsString()
  token: string;

  @ApiProperty({ example: 'NewStrongPass1!' })
  @IsString()
  @MinLength(8)
  @MaxLength(64)
  @Matches(STRONG_PASSWORD_REGEX, {
    message:
      'Password must be 8-64 characters and include an uppercase letter, a lowercase letter, a number, and a symbol',
  })
  newPassword: string;

  @ApiProperty({ example: 'NewStrongPass1!' })
  @IsString()
  @Validate(NewPasswordsMatchConstraint)
  confirmPassword: string;
}

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  currentPassword: string;

  @ApiProperty({ example: 'NewStrongPass1!' })
  @IsString()
  @MinLength(8)
  @MaxLength(64)
  @Matches(STRONG_PASSWORD_REGEX, {
    message:
      'Password must be 8-64 characters and include an uppercase letter, a lowercase letter, a number, and a symbol',
  })
  newPassword: string;

  @ApiProperty({ example: 'NewStrongPass1!' })
  @IsString()
  @Validate(NewPasswordsMatchConstraint)
  confirmPassword: string;
}

export class RefreshTokenDto {
  @ApiProperty()
  @IsString()
  refreshToken: string;
}

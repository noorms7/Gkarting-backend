import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
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

@ValidatorConstraint({ name: 'PasswordsMatch', async: false })
export class PasswordsMatchConstraint implements ValidatorConstraintInterface {
  validate(confirmPassword: string, args: ValidationArguments) {
    const object = args.object as RegisterDto;
    return confirmPassword === object.password;
  }
  defaultMessage() {
    return 'Passwords do not match';
  }
}

// Requires 8+ chars, at least one uppercase, one lowercase, one number,
// and one special character — enforced here AND re-checked server-side
// on password change/reset, never relying on the frontend alone.
const STRONG_PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\da-zA-Z]).{8,64}$/;

// E.164-ish: optional leading +, 7-15 digits total.
const PHONE_REGEX = /^\+?[0-9]{7,15}$/;

export class RegisterDto {
  @ApiProperty({ example: 'Alex' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  firstName: string;

  @ApiProperty({ example: 'Rossi' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  lastName: string;

  @ApiProperty({ example: 'alex@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: '+96170123456' })
  @Matches(PHONE_REGEX, {
    message: 'Phone number must be a valid number (7-15 digits, optional +)',
  })
  phone: string;

  @ApiProperty({ example: 'StrongPass1!' })
  @IsString()
  @MinLength(8)
  @MaxLength(64)
  @Matches(STRONG_PASSWORD_REGEX, {
    message:
      'Password must be 8-64 characters and include an uppercase letter, a lowercase letter, a number, and a symbol',
  })
  password: string;

  @ApiProperty({ example: 'StrongPass1!' })
  @IsString()
  @Validate(PasswordsMatchConstraint)
  confirmPassword: string;
}

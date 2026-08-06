import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  ResetPasswordDto,
} from './dto/misc-auth.dto';
import { AuditService } from '../audit/audit.service';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
    private mail: MailService,
    private audit: AuditService,
  ) {}

  // ------------------------------------------------------------
  // REGISTRATION
  // ------------------------------------------------------------

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ email: dto.email }, { phone: dto.phone }] },
    });
    if (existing) {
      throw new ConflictException(
        existing.email === dto.email
          ? 'An account with this email already exists'
          : 'An account with this phone number already exists',
      );
    }

    const passwordHash = await bcrypt.hash(
      dto.password,
      this.config.get<number>('bcrypt.saltRounds') ?? 12,
    );

    const user = await this.prisma.user.create({
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        phone: dto.phone,
        passwordHash,
      },
    });

    await this.sendVerificationEmail(user.id, user.email, user.firstName);

    await this.audit.log({
      actorId: user.id,
      action: 'USER_REGISTERED',
      entityType: 'User',
      entityId: user.id,
    });

    return {
      message:
        'Account created. Check your email to verify your address before logging in.',
    };
  }

  private async sendVerificationEmail(
    userId: string,
    email: string,
    firstName: string,
  ) {
    const token = this.jwt.sign(
      { sub: userId, email, purpose: 'email-verify' },
      {
        secret: this.config.get('jwt.emailVerifySecret'),
        expiresIn: this.config.get('jwt.emailVerifyExpiresIn'),
      },
    );
    const link = `${this.config.get('frontendUrl')}/verify-email?token=${token}`;
    await this.mail.sendVerificationEmail(email, firstName, link);
  }

  async resendVerification(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    // Always return a generic message — don't leak whether the email exists.
    if (user && !user.isEmailVerified) {
      await this.sendVerificationEmail(user.id, user.email, user.firstName);
    }
    return {
      message:
        'If an unverified account exists for that email, a new verification link has been sent.',
    };
  }

  async verifyEmail(token: string) {
    let payload: any;
    try {
      payload = this.jwt.verify(token, {
        secret: this.config.get('jwt.emailVerifySecret'),
      });
    } catch {
      throw new BadRequestException(
        'This verification link is invalid or has expired',
      );
    }
    if (payload.purpose !== 'email-verify') {
      throw new BadRequestException('Invalid verification token');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
    if (!user) throw new BadRequestException('Account not found');

    if (!user.isEmailVerified) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { isEmailVerified: true, emailVerifiedAt: new Date() },
      });
    }

    return { message: 'Email verified — you can now log in.' };
  }

  // ------------------------------------------------------------
  // LOGIN / TOKENS
  // ------------------------------------------------------------

  async login(dto: LoginDto, meta: { ip?: string; userAgent?: string }) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    // Constant-shape response whether the email exists or not, to avoid
    // user enumeration — but bcrypt.compare against a dummy hash keeps
    // response timing consistent too.
    const passwordHash =
      user?.passwordHash ??
      '$2b$12$CwTycUXWue0Thq9StjUM0uJ8i6Q9c7v1Z6c1E1e1e1e1e1e1e1e1e';
    const passwordValid = await bcrypt.compare(dto.password, passwordHash);

    if (!user || !passwordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }
    if (!user.isActive) {
      throw new UnauthorizedException('This account has been deactivated');
    }
    if (!user.isEmailVerified) {
      throw new UnauthorizedException(
        'Please verify your email before logging in',
      );
    }

    const tokens = await this.issueTokenPair(user.id, user.email);
    await this.persistRefreshToken(
      user.id,
      tokens.refreshToken,
      meta.ip,
      meta.userAgent,
    );

    await this.audit.log({
      actorId: user.id,
      action: 'USER_LOGIN',
      entityType: 'User',
      entityId: user.id,
      ipAddress: meta.ip,
    });

    return {
      ...tokens,
      user: this.publicUser(user),
    };
  }

  private async issueTokenPair(
    userId: string,
    email: string,
  ): Promise<TokenPair> {
    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(
        { sub: userId, email },
        {
          secret: this.config.get('jwt.accessSecret'),
          expiresIn: this.config.get('jwt.accessExpiresIn'),
        },
      ),
      this.jwt.signAsync(
        { sub: userId, email, jti: crypto.randomUUID() },
        {
          secret: this.config.get('jwt.refreshSecret'),
          expiresIn: this.config.get('jwt.refreshExpiresIn'),
        },
      ),
    ]);
    return { accessToken, refreshToken };
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private async persistRefreshToken(
    userId: string,
    refreshToken: string,
    ip?: string,
    userAgent?: string,
  ) {
    const decoded: any = this.jwt.decode(refreshToken);
    const expiresAt = new Date(decoded.exp * 1000);

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: this.hashToken(refreshToken),
        ipAddress: ip,
        userAgent,
        expiresAt,
      },
    });
  }

  async refreshTokens(refreshToken: string) {
    let payload: any;
    try {
      payload = this.jwt.verify(refreshToken, {
        secret: this.config.get('jwt.refreshSecret'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const tokenHash = this.hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findFirst({
      where: { userId: payload.sub, tokenHash, revoked: false },
    });
    if (!stored || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token no longer valid');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Account is inactive or not found');
    }

    // Rotate: revoke the used refresh token, issue a fresh pair.
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revoked: true },
    });

    const tokens = await this.issueTokenPair(user.id, user.email);
    await this.persistRefreshToken(user.id, tokens.refreshToken);

    return tokens;
  }

  async logout(userId: string, refreshToken?: string) {
    if (refreshToken) {
      const tokenHash = this.hashToken(refreshToken);
      await this.prisma.refreshToken.updateMany({
        where: { userId, tokenHash },
        data: { revoked: true },
      });
    } else {
      // No token provided — revoke every active session for this user.
      await this.prisma.refreshToken.updateMany({
        where: { userId, revoked: false },
        data: { revoked: true },
      });
    }
    return { message: 'Logged out' };
  }

  // ------------------------------------------------------------
  // FORGOT / RESET PASSWORD
  // ------------------------------------------------------------

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (user) {
      const token = this.jwt.sign(
        { sub: user.id, email: user.email, purpose: 'password-reset' },
        {
          secret: this.config.get('jwt.resetPasswordSecret'),
          expiresIn: this.config.get('jwt.resetPasswordExpiresIn'),
        },
      );
      const link = `${this.config.get('frontendUrl')}/reset-password?token=${token}`;
      await this.mail.sendPasswordResetEmail(user.email, user.firstName, link);
    }

    // Same message whether or not the account exists.
    return {
      message:
        'If an account exists for that email, a password reset link has been sent.',
    };
  }

  async resetPassword(dto: ResetPasswordDto) {
    let payload: any;
    try {
      payload = this.jwt.verify(dto.token, {
        secret: this.config.get('jwt.resetPasswordSecret'),
      });
    } catch {
      throw new BadRequestException(
        'This reset link is invalid or has expired',
      );
    }
    if (payload.purpose !== 'password-reset') {
      throw new BadRequestException('Invalid reset token');
    }

    const passwordHash = await bcrypt.hash(
      dto.newPassword,
      this.config.get<number>('bcrypt.saltRounds') ?? 12,
    );

    await this.prisma.user.update({
      where: { id: payload.sub },
      data: { passwordHash },
    });

    // Reset means every existing session should die.
    await this.prisma.refreshToken.updateMany({
      where: { userId: payload.sub, revoked: false },
      data: { revoked: true },
    });

    await this.audit.log({
      actorId: payload.sub,
      action: 'PASSWORD_RESET',
      entityType: 'User',
      entityId: payload.sub,
    });

    return { message: 'Password updated — please log in again.' };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException('Account not found');

    const valid = await bcrypt.compare(
      dto.currentPassword,
      user.passwordHash,
    );
    if (!valid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const passwordHash = await bcrypt.hash(
      dto.newPassword,
      this.config.get<number>('bcrypt.saltRounds') ?? 12,
    );
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    await this.audit.log({
      actorId: userId,
      action: 'PASSWORD_CHANGED',
      entityType: 'User',
      entityId: userId,
    });

    return { message: 'Password changed successfully' };
  }

  // ------------------------------------------------------------

  private publicUser(user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    role: string;
    avatarUrl: string | null;
  }) {
    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      role: user.role,
      avatarUrl: user.avatarUrl,
    };
  }
}

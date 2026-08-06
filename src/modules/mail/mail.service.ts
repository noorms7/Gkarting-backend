import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter;

  constructor(private config: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.config.get('mail.host'),
      port: this.config.get('mail.port'),
      secure: this.config.get('mail.secure'),
      auth: {
        user: this.config.get('mail.user'),
        pass: this.config.get('mail.password'),
      },
    });
    this.transporter.verify((error, success) => {
      if (error) {
        this.logger.error('SMTP ERROR', error);
      } else {
        this.logger.log('SMTP READY');
      }
    })
  }

  private wrapper(bodyHtml: string): string {
    return `
    <div style="background:#0A0A0B;padding:40px 20px;font-family:Arial,sans-serif;">
      <div style="max-width:520px;margin:0 auto;background:#141416;border:1px solid #3A3A3F;">
        <div style="padding:28px 32px;border-bottom:1px solid #3A3A3F;">
          <span style="font-size:22px;font-weight:900;letter-spacing:1px;color:#F5F5F3;">
            <span style="color:#E10600;">G</span>KARTING
          </span>
        </div>
        <div style="padding:32px;color:#C9CBCF;font-size:14px;line-height:1.6;">
          ${bodyHtml}
        </div>
        <div style="padding:20px 32px;border-top:1px solid #3A3A3F;color:#6b6b70;font-size:11px;">
          © 2026 GKarting. All Rights Reserved.
        </div>
      </div>
    </div>`;
  }

  async sendCustomEmail(to: string, subject: string, html: string) {
    await this.send({ to, subject, html });
  }

  private async send(options: SendMailOptions) {
  const fromName = this.config.get('mail.fromName');
  const fromAddress = this.config.get('mail.fromAddress');

  try {
    const result = await this.transporter.sendMail({
      from: `"${fromName}" <${fromAddress}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
    });

    this.logger.log(
      `EMAIL SENT SUCCESSFULLY  ${result.messageId}`,
    );

  } catch (err) {
    this.logger.error(
      `EMAIL FAILED  ${options.to}`,
      err,
    );
  }
}
  async sendVerificationEmail(to: string, firstName: string, link: string) {
    const html = this.wrapper(`
      <h2 style="color:#F5F5F3;font-size:20px;margin:0 0 16px;">Verify your email, ${firstName}</h2>
      <p>Confirm your address to activate your GKarting account and start booking races.</p>
      <p style="margin:28px 0;">
        <a href="${link}" style="background:#E10600;color:#fff;padding:14px 28px;text-decoration:none;font-weight:bold;display:inline-block;">Verify Email</a>
      </p>
      <p style="color:#6b6b70;font-size:12px;">This link expires in 24 hours. If you didn't create this account, you can ignore this email.</p>
    `);
    await this.send({ to, subject: 'Verify your GKarting account', html });
  }

  async sendPasswordResetEmail(to: string, firstName: string, link: string) {
    const html = this.wrapper(`
      <h2 style="color:#F5F5F3;font-size:20px;margin:0 0 16px;">Reset your password</h2>
      <p>Hi ${firstName}, we received a request to reset your GKarting password.</p>
      <p style="margin:28px 0;">
        <a href="${link}" style="background:#E10600;color:#fff;padding:14px 28px;text-decoration:none;font-weight:bold;display:inline-block;">Reset Password</a>
      </p>
      <p style="color:#6b6b70;font-size:12px;">This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>
    `);
    await this.send({ to, subject: 'Reset your GKarting password', html });
  }

  async sendBookingConfirmationEmail(
    to: string,
    firstName: string,
    details: {
      bookingRef: string;
      date: string;
      startTime: string;
      durationMins: number;
      kartsCount: number;
      packageName: string;
      totalPrice: string;
    },
  ) {
    const html = this.wrapper(`
      <h2 style="color:#F5F5F3;font-size:20px;margin:0 0 16px;">You're on the grid, ${firstName} 🏁</h2>
      <p>Your booking is confirmed. Here's your race sheet:</p>
      <table style="width:100%;border-collapse:collapse;margin:20px 0;">
        <tr><td style="padding:8px 0;color:#6b6b70;">Reference</td><td style="padding:8px 0;text-align:right;color:#F5F5F3;">${details.bookingRef}</td></tr>
        <tr><td style="padding:8px 0;color:#6b6b70;">Date</td><td style="padding:8px 0;text-align:right;color:#F5F5F3;">${details.date}</td></tr>
        <tr><td style="padding:8px 0;color:#6b6b70;">Time</td><td style="padding:8px 0;text-align:right;color:#F5F5F3;">${details.startTime}</td></tr>
        <tr><td style="padding:8px 0;color:#6b6b70;">Package</td><td style="padding:8px 0;text-align:right;color:#F5F5F3;">${details.packageName} (${details.durationMins} min)</td></tr>
        <tr><td style="padding:8px 0;color:#6b6b70;">Karts</td><td style="padding:8px 0;text-align:right;color:#F5F5F3;">${details.kartsCount}</td></tr>
        <tr><td style="padding:8px 0;color:#6b6b70;">Total</td><td style="padding:8px 0;text-align:right;color:#E10600;font-weight:bold;">${details.totalPrice}</td></tr>
      </table>
      <p style="color:#6b6b70;font-size:12px;">Arrive 15 minutes early for your safety briefing. See you on the track.</p>
    `);
    await this.send({
      to,
      subject: `Booking Confirmed — ${details.bookingRef}`,
      html,
    });
  }

  async sendBookingCancellationEmail(
    to: string,
    firstName: string,
    bookingRef: string,
  ) {
    const html = this.wrapper(`
      <h2 style="color:#F5F5F3;font-size:20px;margin:0 0 16px;">Booking cancelled</h2>
      <p>Hi ${firstName}, your booking <b style="color:#F5F5F3;">${bookingRef}</b> has been cancelled.</p>
      <p style="color:#6b6b70;font-size:12px;">If this wasn't expected, contact us and we'll help sort it out.</p>
    `);
    await this.send({ to, subject: `Booking Cancelled — ${bookingRef}`, html });
  }
}

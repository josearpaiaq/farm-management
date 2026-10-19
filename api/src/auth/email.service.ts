import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import type { EmailCodePurpose } from './email-codes.service';

const SUBJECTS: Record<EmailCodePurpose, string> = {
  verify_email: 'Verifica tu correo',
  login: 'Tu código para iniciar sesión',
  reset_password: 'Recupera tu contraseña',
};

// Sends transactional email through Resend. Without RESEND_API_KEY (local
// development) the email is logged instead, so codes can be read from the
// API console.
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resend: Resend | null;
  private readonly from: string;

  constructor(config: ConfigService) {
    const apiKey = config.get<string>('RESEND_API_KEY');
    this.resend = apiKey ? new Resend(apiKey) : null;
    this.from = config.get<string>('EMAIL_FROM') ?? 'onboarding@resend.dev';
  }

  async sendCode(
    to: string,
    purpose: EmailCodePurpose,
    code: string,
  ): Promise<void> {
    const subject = SUBJECTS[purpose];
    const text = `Tu código es ${code}. Vence en 10 minutos. Si no lo pediste, ignora este correo.`;

    if (!this.resend) {
      this.logger.log(`[dev email] to=${to} subject="${subject}" code=${code}`);
      return;
    }

    const { error } = await this.resend.emails.send({
      from: this.from,
      to,
      subject,
      text,
      html: `<p>Tu código es</p><p style="font-size:28px;font-weight:bold;letter-spacing:4px">${code}</p><p>Vence en 10 minutos. Si no lo pediste, ignora este correo.</p>`,
    });
    if (error) {
      throw new Error(`Resend failed: ${error.name} ${error.message}`);
    }
  }
}

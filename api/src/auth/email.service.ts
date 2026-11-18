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
  private readonly appUrl: string;

  constructor(config: ConfigService) {
    const apiKey = config.get<string>('RESEND_API_KEY');
    this.resend = apiKey ? new Resend(apiKey) : null;
    this.from = config.get<string>('EMAIL_FROM') ?? 'onboarding@resend.dev';
    // Public address of the web app, used in links inside emails.
    this.appUrl = config.get<string>('APP_URL') ?? 'http://localhost:5173';
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

    await this.send(
      to,
      subject,
      text,
      `<p>Tu código es</p><p style="font-size:28px;font-weight:bold;letter-spacing:4px">${code}</p><p>Vence en 10 minutos. Si no lo pediste, ignora este correo.</p>`,
    );
  }

  // Invitation to join an organization. Contains no code: the member signs
  // in with "Entrar con código", so the email never expires.
  async sendInvitation(
    to: string,
    inviterName: string,
    organizationName: string,
  ): Promise<void> {
    const loginUrl = `${this.appUrl}/login/code`;
    const subject = `${inviterName} te invitó a ${organizationName}`;
    const text = `${inviterName} te invitó a ${organizationName} en Gestión de fincas. Para entrar, abre ${loginUrl} y escribe este correo (${to}): te enviaremos un código.`;

    if (!this.resend) {
      this.logger.log(
        `[dev email] to=${to} subject="${subject}" url=${loginUrl}`,
      );
      return;
    }

    await this.send(
      to,
      subject,
      text,
      `<p>${escapeHtml(inviterName)} te invitó a <strong>${escapeHtml(organizationName)}</strong> en Gestión de fincas.</p><p><a href="${loginUrl}">Entrar a la app</a></p><p>Escribe este correo (${escapeHtml(to)}) y te enviaremos un código para entrar.</p>`,
    );
  }

  private async send(
    to: string,
    subject: string,
    text: string,
    html: string,
  ): Promise<void> {
    const { error } = await this.resend!.emails.send({
      from: this.from,
      to,
      subject,
      text,
      html,
    });
    if (error) {
      throw new Error(`Resend failed: ${error.name} ${error.message}`);
    }
  }
}

// Names are user input; keep them from injecting markup into the email.
function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

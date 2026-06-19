import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';

interface SendMailParams {
  to: string;
  subject: string;
  html: string;
}

@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private readonly resend: Resend | null;
  private readonly fromAddress: string;
  private readonly fromName: string;

  constructor() {
    const apiKey = process.env.RESEND_API_KEY;
    this.fromName = process.env.SMTP_FROM_NAME || 'TenderPro';
    this.fromAddress = process.env.SMTP_FROM || 'support@mytenderspro.com';

    if (apiKey) {
      this.resend = new Resend(apiKey);
      this.logger.log(`Resend initialisé (from: ${this.fromAddress})`);
    } else {
      this.resend = null;
      this.logger.warn('RESEND_API_KEY non configuré — les emails ne seront pas envoyés');
    }
  }

  /**
   * Envoie un email via Resend.
   * Retourne true si envoyé avec succès, false sinon.
   * Ne throw jamais — l'envoi d'email ne doit pas casser le flux applicatif.
   */
  async sendMail(params: SendMailParams): Promise<boolean> {
    if (!this.resend) {
      this.logger.warn(`Email NON envoyé à ${params.to} (Resend non configuré)`);
      return false;
    }

    try {
      const { data, error } = await this.resend.emails.send({
        from: `${this.fromName} <${this.fromAddress}>`,
        to: params.to,
        subject: params.subject,
        html: params.html,
      });

      if (error) {
        this.logger.error(`Resend error pour ${params.to}: ${JSON.stringify(error)}`);
        return false;
      }

      this.logger.log(`Email envoyé à ${params.to} (id: ${data?.id})`);
      return true;
    } catch (err: any) {
      this.logger.error(`Erreur d'envoi email à ${params.to}: ${err.message}`);
      return false;
    }
  }
}

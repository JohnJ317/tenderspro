import { Global, Module } from '@nestjs/common';
import { MailerService } from './mailer.service';

@Global() // disponible dans toute l'app sans avoir à l'importer dans chaque module
@Module({
  providers: [MailerService],
  exports: [MailerService],
})
export class MailerModule {}

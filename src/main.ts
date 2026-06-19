import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug'],
    rawBody: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,           // strip les champs non déclarés dans les DTO
      forbidNonWhitelisted: true, // 400 si champ inattendu
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.setGlobalPrefix('api');

  // --- CORS configuration ---
  // Origines autorisées : configurables via CORS_ORIGINS (CSV)
  // Fallback : domaines de production connus + dev local
  const envOrigins = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  const allowedOrigins = envOrigins.length > 0 ? envOrigins : [
    'https://mytenderspro.com',
    'https://www.mytenderspro.com',
    'https://tenders.iaccabinet.com',
    'http://localhost:3000',
    'http://localhost:3001',
  ];

  app.enableCors({
    origin: (origin, callback) => {
      // Autorise les requêtes sans origin (Postman, curl, server-to-server)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  });

  const config = app.get(ConfigService);
  const port = config.get<number>('PORT', 3000);
  await app.listen(port);

  Logger.log(`🚀 TenderPro API prête sur http://localhost:${port}/api`, 'Bootstrap');
  Logger.log(`CORS: origines autorisées = ${allowedOrigins.join(', ')}`, 'Bootstrap');
}

bootstrap();

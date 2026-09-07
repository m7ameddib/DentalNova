import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';

import { ValidationPipe, Logger } from '@nestjs/common';

import { NestExpressApplication } from '@nestjs/platform-express';

import { AppModule } from './app.module';

import { HttpExceptionFilter } from './common/filters/http-exception.filter';

import { DeploymentService } from './common/deployment.service';

import { APP_VERSION } from './common/version';

import * as fs from 'fs';

import * as path from 'path';

import { Request, Response, NextFunction } from 'express';



const logger = new Logger('Bootstrap');

// When this process is launched by a wrapper/launcher script that redirects
// stdout/stderr and then exits (e.g. the desktop app's start script), the
// pipe's read end goes away while this server process keeps running. The
// next write to stdout/stderr (including NestJS's Logger — used right after
// license activation, first setup, and backup creation) then raises an EPIPE
// error on the stream. Since nothing else listens for it, that error is
// otherwise uncaught and terminates the whole process. Swallow EPIPE here so
// a detached console never takes the server down.
for (const stream of [process.stdout, process.stderr]) {
  stream.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code !== 'EPIPE') throw err;
  });
}



async function bootstrap() {

  const app = await NestFactory.create<NestExpressApplication>(AppModule, { cors: false });

  const deployment = app.get(DeploymentService);

  if (deployment.isOnline()) {
    app.set('trust proxy', 1);
    const origins = deployment.allowedOrigins();
    app.enableCors({
      origin: origins.length > 0 ? origins : true,
      credentials: true,
    });
    logger.log(`Online mode — CORS origins: ${origins.join(', ') || '(all)'}`);
  } else {
    app.enableCors({ origin: true, credentials: true });
  }

  app.useGlobalPipes(

    new ValidationPipe({

      whitelist: true,

      transform: true,

      forbidNonWhitelisted: false,

    }),

  );

  app.useGlobalFilters(new HttpExceptionFilter());

  app.setGlobalPrefix('api');

  const clientDistCandidates = [
    path.join(__dirname, '..', 'public'),
    path.join(process.cwd(), 'public'),
    path.join(__dirname, '..', '..', 'client', 'dist'),
    path.join(process.cwd(), 'client', 'dist'),
  ];

  const clientDist = clientDistCandidates.find((p) => fs.existsSync(path.join(p, 'index.html')));
  const serveClientExplicit = process.env.SERVE_CLIENT === '1';
  const serveClientDisabled = process.env.SERVE_CLIENT === '0';
  const serveClient =
    !serveClientDisabled &&
    (serveClientExplicit || process.env.NODE_ENV === 'production' || clientDist != null);

  if (serveClient) {
    if (clientDist) {
      const indexHtml = path.join(clientDist, 'index.html');

      app.useStaticAssets(clientDist, { index: false });

      app.use((req: Request, res: Response, next: NextFunction) => {
        if (req.path.startsWith('/api')) return next();
        res.sendFile(indexHtml);
      });

      logger.log(`Serving DentalNova client from ${clientDist}`);
    } else {
      logger.warn('SERVE_CLIENT enabled but client dist not found');
    }
  }

  const host = process.env.HOST || '0.0.0.0';

  const port = process.env.PORT ? Number(process.env.PORT) : 4000;

  await app.listen(port, host);

  logger.log(`DentalNova v${APP_VERSION} [${deployment.getMode()}] API on http://${host}:${port}/api`);



  const shutdown = async (signal: string) => {

    logger.log(`Received ${signal}, shutting down gracefully...`);

    await app.close();

    process.exit(0);

  };

  process.on('SIGINT', () => void shutdown('SIGINT'));

  process.on('SIGTERM', () => void shutdown('SIGTERM'));

}



bootstrap();



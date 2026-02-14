import "./common/config/load-env";
import { Logger, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { RealtimeWsProxy } from "./modules/realtime/realtime.ws";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: true });
  const logger = new Logger("Bootstrap");

  app.setGlobalPrefix("api");
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: false,
    }),
  );
  app.enableCors({
    origin: true,
    credentials: true,
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  const realtimeWs = app.get(RealtimeWsProxy);
  realtimeWs.attach(app.getHttpServer());
  logger.log(`API listening on http://localhost:${port}/api/health`);
}
void bootstrap();

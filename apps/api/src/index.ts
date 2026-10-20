import { buildApp } from './app';
import { loadEnv } from './shared/config/env';

const env = loadEnv();
const app = buildApp();

try {
  await app.listen({ port: env.PORT });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}

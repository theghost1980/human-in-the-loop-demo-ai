import { buildApp } from './app';

// Temporary: PORT is read directly until env validation with Zod lands (Phase 0 roadmap item).
const port = Number(process.env.PORT ?? 3001);

const app = buildApp();

try {
  await app.listen({ port });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}

import Fastify from 'fastify';
import { healthRoutes } from './features/health/routes';

export function buildApp({ logger = true }: { logger?: boolean } = {}) {
  const app = Fastify({ logger });
  app.register(healthRoutes);
  return app;
}

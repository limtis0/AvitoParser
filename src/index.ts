import { PrismaClient } from "@prisma/client";
import HeroProvider from "./features/avitoParser/utils/heroProvider";
import AvitoCategoryService from "./features/avitoParser/services/avitoCategoryService";
import Fastify, { FastifyInstance } from 'fastify';
import fastifyCors from "@fastify/cors";
import registerAuthRoutes from "./features/api/auth/routes";
import { fastifyAuthDecorate } from "./features/api/auth/authMiddleware";
import { registerListingRoutes } from "./features/api/listings/routes";
import { registerWordlistRoutes } from "./features/api/wordlist/wordlistRoutes";
import { loadWordlistCaches } from "./features/api/wordlist/wordlists";
import { registerCategoryRoutes } from "./features/api/categories/routes";
import { registerBrandlistRoutes } from "./features/api/wordlist/brandlistRoutes";
import { registerStatRoutes } from "./features/api/stats/routes";
import AvitoListingService from "./features/avitoParser/services/avitoListingService";
import events from 'events';

export const prisma = new PrismaClient();
export let app: FastifyInstance;

// Start parser
async function startServer() {
    // Set max listeners to a bigger amount, idk why this triggers
    events.defaultMaxListeners = 64;

    // Load caches
    await loadWordlistCaches();

    // Load parsers
    await HeroProvider.startCloudNode();
    AvitoCategoryService.Start();
    AvitoListingService.Start();

    // Setup API
    app = Fastify();

    app.setErrorHandler((error, request, reply) => {
        console.error(`Error during request to ${request.url}:`, error);
        return reply.code(error.statusCode ?? 500).send({
            error: error.message
        });
    });

    // Register addons
    await app.register(fastifyCors);

    // Register middlewares
    fastifyAuthDecorate();

    // Register routes
    registerAuthRoutes();
    registerListingRoutes();
    registerWordlistRoutes();
    registerCategoryRoutes();
    registerBrandlistRoutes();
    registerStatRoutes();

    // Start API
    app.listen({ port: 3001 }, (err, address) => {
        if (err) {
            console.error(`FATAL: ${err}`)
            process.exit(1)
        }

        console.log(`Server is listening at ${address}...`)
    });
}

startServer();
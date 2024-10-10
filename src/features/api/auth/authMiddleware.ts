import { FastifyReply, FastifyRequest } from "fastify";
import { app } from "@/index";
import { config } from "@/features/config";

declare module 'fastify' {
    export interface FastifyInstance {
        auth(): (request: FastifyRequest, reply: FastifyReply) => void;
    }
}

export function fastifyAuthDecorate() {
    app.decorate('auth', () => {
        return async (request: FastifyRequest, reply: FastifyReply) => {
            const header = request.headers.authorization;
            const isAuthorized = header !== undefined && header === config.store.auth.apiKey;

            if (!isAuthorized) {
                return reply.code(401).send({
                    error: 'Нет прав доступа'
                });
            }
        }
    });
}

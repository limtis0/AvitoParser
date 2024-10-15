import { app, prisma } from "@/index";
import { ignoredBrandlist } from "./wordlists";
import { Prisma } from "@prisma/client";

export function registerBrandlistRoutes() {
    app.get<{
        Querystring: {
            take: number;
            skip: number;
            search?: string;
        }
    }>('/api/brands/blocked', {
        onRequest: [app.auth()],
        schema: {
            querystring: {
                type: 'object',
                required: ['take', 'skip'],
                properties: {
                    take: { type: 'integer', minimum: 1, maximum: 100, default: 30 },
                    skip: { type: 'integer', minimum: 0, default: 0 },
                    search: { type: 'string' }
                }
            }
        }
    }, async (request, reply) => {
        const { take, skip, search } = request.query;

        const whereSearch: Prisma.BlockedBrandWhereInput = {
            name: search ? {
                contains: search,
                mode: Prisma.QueryMode.insensitive
            } : undefined
        };

        const brands = await prisma.blockedBrand.findMany({
            take: take,
            skip: skip,
            where: whereSearch,
            orderBy: {
                name: 'asc'
            }
        });

        const count = await prisma.blockedBrand.count({
            where: whereSearch
        });

        return reply.code(200).send({
            brands: brands,
            count: count
        });
    });

    app.post<{
        Body: {
            name: string;
            reason?: string;
        }
    }>('/api/brand/blocked', {
        onRequest: [app.auth()],
        schema: {
            body: {
                type: 'object',
                required: ['name'],
                properties: {
                    name: { type: 'string', minLength: 1 },
                    reason: { type: 'string' }
                }
            }
        }
    }, async (request, reply) => {
        const name = request.body.name.toLowerCase();

        // Check for conflicts
        if (ignoredBrandlist.has(name)) {
            return reply.code(409).send({
                error: 'Фирма уже добавлена'
            });
        };

        // Add brand to DB and cache
        await prisma.blockedBrand.create({
            data: {
                name: name,
                reason: request.body.reason
            }
        });

        ignoredBrandlist.add(name);

        return reply.code(200).send();
    });

    app.delete<{
        Querystring: {
            name: string[];
        }
    }>('/api/brand/blocked', {
        onRequest: [app.auth()],
        schema: {
            querystring: {
                type: 'object',
                required: ['name'],
                properties: {
                    name: {
                        type: 'array',
                        maxItems: 100,
                        items: { type: 'string' }
                    }
                }
            }
        }
    }, async (request, reply) => {
        const names = request.query.name.map(n => n.toLowerCase());

        // Delete in DB and cache
        await prisma.blockedBrand.deleteMany({
            where: {
                name: {
                    in: names
                }
            }
        });

        names.forEach(w => ignoredBrandlist.delete(w));

        return reply.code(200).send();
    });
}

import { app, prisma } from "@/index";
import AvitoUrlUtils from "@/utils/avitoUrlUtils";

type ParamsType = { id: number };

const paramsSchema = {
    params: {
        type: 'object',
        required: ['id'],
        properties: {
            id: { type: 'integer' }
        }
    }
};

const statsQuery = 'SELECT ' +
    '"categoryId", ' +
    'COUNT(*) as total, ' +
    'SUM("isTracking"::int) as tracking, ' +
    'SUM("isActive"::int) as active, ' +
    'SUM("isIgnored"::int) as ignored ' +
    'FROM "Listing" ' +
    'GROUP BY "categoryId";';

async function getCategoryStats() {
    const stats: Map<
        number,
        {
            ignored: number;
            tracking: number;
            active: number;
            total: number;
        }
    > = new Map();

    const statsRaw: {
        categoryId: number;
        total: bigint;
        tracking: bigint;
        active: bigint;
        ignored: bigint;
    }[] = await prisma.$queryRawUnsafe(statsQuery);

    statsRaw.forEach((s) => {
        stats.set(s.categoryId, {
            tracking: Number(s.tracking),
            ignored: Number(s.ignored),
            active: Number(s.active),
            total: Number(s.total),
        });
    });

    return stats;
}

export function registerCategoryRoutes() {
    app.get('/api/categories', {
        onRequest: [app.auth()]
    }, async (_request, reply) => {
        const categories = await prisma.category.findMany({
            select: {
                id: true,
                name: true,
                url: true
            },
            orderBy: {
                id: 'asc'
            }
        });

        const stats = await getCategoryStats();
        const total = [...stats.values()].reduce((total, current) => {
            return {
                ignoredCount: current.ignored + total.ignoredCount,
                trackingCount: current.tracking + total.trackingCount,
                activeCount: current.active + total.activeCount,
                totalCount: current.total + total.totalCount
            }
        }, {
            ignoredCount: 0,
            trackingCount: 0,
            totalCount: 0,
            activeCount: 0,
        });

        return reply.code(200).send({
            categories: categories.map((c) => {
                const stat = stats.get(c.id);

                if (stat === undefined) {
                    return {
                        ...c,
                        ignoredCount: 0,
                        trackingCount: 0,
                        totalCount: 0,
                        activeCount: 0,
                    }
                }

                return {
                    ...c,
                    ignoredCount: stat.ignored,
                    trackingCount: stat.tracking,
                    activeCount: stat.active,
                    totalCount: stat.total,
                }
            }),
            total: total
        });
    });

    app.post<{
        Body: {
            name: string;
            url: string;
        }
    }>('/api/category', {
        onRequest: [app.auth()],
        schema: {
            body: {
                type: 'object',
                required: ['name', 'url'],
                properties: {
                    name: { type: 'string' },
                    url: { type: 'string' }
                }
            }
        }
    }, async (request, reply) => {
        const { url, name } = request.body;

        if (url.match(AvitoUrlUtils.urlRegex) === null) {
            return reply.code(400).send({
                error: 'Невалидная ссылка'
            });
        }

        const category = await prisma.category.create({
            data: {
                name: name,
                url: AvitoUrlUtils.getCategory(url)
            }
        });

        return reply.code(200).send(category);
    });

    app.patch<{
        Params: ParamsType,
        Body: {
            name?: string;
            url?: string;
        }
    }>('/api/category/:id', {
        onRequest: [app.auth()],
        schema: {
            ...paramsSchema,
            body: {
                type: 'object',
                properties: {
                    name: { type: 'string' },
                    url: { type: 'string' }
                }
            }
        }
    }, async (request, reply) => {
        const { id } = request.params;
        let { url, name } = request.body;

        // Validate params
        if (!url && !name) {
            return reply.code(400).send({
                error: 'Пожалуйста, укажите данные'
            });
        }

        if (url) {
            if (url.match(AvitoUrlUtils.urlRegex) === null) {
                return reply.code(400).send({
                    error: 'Невалидная ссылка'
                });
            }

            url = AvitoUrlUtils.getCategory(url);
        }

        // Check for 404
        const found = await prisma.category.findFirst({
            where: {
                id: id
            }
        });

        if (found === null) {
            return reply.code(404).send({
                error: 'Категория не найдена'
            });
        }

        const category = await prisma.category.update({
            where: {
                id: id
            },
            data: {
                name: name,
                url: url
            }
        });

        return reply.code(200).send(category);
    });

    app.delete<{
        Params: ParamsType
    }>('/api/category/:id', {
        onRequest: [app.auth()],
        schema: {
            ...paramsSchema
        }
    }, async (request, reply) => {
        const id = request.params.id;

        const found = await prisma.category.findFirst({
            where: {
                id: id
            }
        });

        if (found === null) {
            return reply.code(404).send({
                error: 'Категория не найдена'
            });
        }

        await prisma.category.delete({
            where: {
                id: id
            }
        });

        return reply.code(200).send();
    })
}

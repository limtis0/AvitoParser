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

async function getCategoryStats() {
    const stats: Map<
        number, {
            ignored: number,
            tracking: number
        }
    > = new Map();

    const trackingCount = await prisma.listing.groupBy({
        by: ['categoryId'],
        _count: true,
        where: {
            isTracking: true
        }
    });

    trackingCount.forEach((c) => {
        stats.set(c.categoryId, {
            tracking: c._count,
            ignored: 0
        })
    });

    // Same for ignored
    const ignoredCount = await prisma.listing.groupBy({
        by: ['categoryId'],
        _count: true,
        where: {
            isIgnored: true
        }
    });

    ignoredCount.forEach((c) => {
        const stat = stats.get(c.categoryId);

        stats.set(c.categoryId, {
            tracking: stat ? stat.tracking : 0,
            ignored: c._count
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

        return reply.code(200).send({
            categories: categories.map((c) => {
                const stat = stats.get(c.id);

                return {
                    ...c,
                    ignored: stat?.ignored ?? 0,
                    tracking: stat?.tracking ?? 0
                }
            })
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

import { app, prisma } from "@/index";
import { Prisma, WordType } from "@prisma/client";

export function registerStatRoutes() {
    app.get('/api/stats', {
        onRequest: [app.auth()],
    }, async (_request, reply) => {
        // No need to optimize, one time use per session
        const ignoredWordCount = await prisma.word.count({
            where: {
                type: WordType.ignored
            }
        });

        const trackedWordCount = await prisma.word.count({
            where: {
                type: WordType.tracked
            }
        });

        const ignoredBrandCount = await prisma.blockedBrand.count();

        return reply.code(200).send({
            words: {
                ignoredCount: ignoredWordCount,
                trackedCount: trackedWordCount
            },
            brands: {
                ignoredCount: ignoredBrandCount
            }
        });
    });
}

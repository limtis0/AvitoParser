import { app, prisma } from "@/index";
import { ignoredWordlist, trackedWordlist } from "./wordlists";
import { Prisma, WordType } from "@prisma/client";

type WordlistParams = { wordType: WordType };

const wordlistParamsSchema = {
    params: {
        type: 'object',
        required: ['wordType'],
        properties: {
            wordType: { type: 'string', enum: Object.values(WordType) }
        }
    }
}

function resolveWordlists(wordType: WordType) {
    if (wordType === WordType.ignored) {
        return {
            mainWordlist: ignoredWordlist,
            subWordlist: trackedWordlist
        }
    }

    return {
        mainWordlist: trackedWordlist,
        subWordlist: ignoredWordlist
    }
}

export function registerWordlistRoutes() {
    app.get<{
        Params: WordlistParams,
        Querystring: {
            take: number;
            skip: number;
            search?: string;
        }
    }>('/api/words/:wordType', {
        onRequest: [app.auth()],
        schema: {
            ...wordlistParamsSchema,
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
        const wordType = request.params.wordType;

        const whereSearch: Prisma.WordWhereInput = {
            type: wordType,
            word: search ? {
                contains: search,
                mode: Prisma.QueryMode.insensitive
            } : undefined
        };

        const words = await prisma.word.findMany({
            take: take,
            skip: skip,
            where: whereSearch,
            orderBy: {
                word: 'asc'
            }
        });

        const count = await prisma.word.count({
            where: whereSearch
        });

        return reply.code(200).send({
            words: words.map(w => w.word),
            count: count
        });
    });

    app.put<{
        Params: WordlistParams,
        Body: {
            word: string;
        }
    }>('/api/word/:wordType', {
        onRequest: [app.auth()],
        schema: {
            ...wordlistParamsSchema,
            body: {
                type: 'object',
                required: ['word'],
                properties: {
                    word: { type: 'string', minLength: 1 }
                }
            }
        }
    }, async (request, reply) => {
        const word = request.body.word.toLowerCase();
        const wordType = request.params.wordType;

        const { mainWordlist, subWordlist } = resolveWordlists(wordType);

        // Check for conflicts
        if (mainWordlist.has(word)) {
            return reply.code(409).send({
                error: 'Слово уже добавлено'
            });
        }

        if (subWordlist.has(word)) {
            return reply.code(409).send({
                error: `Это слово уже ${wordType === WordType.ignored ? 'игнорируется' : 'отслеживается'}`
            });
        }

        // Add word to DB and cache
        await prisma.word.create({
            data: {
                word: word,
                type: wordType
            }
        });

        mainWordlist.add(word);

        return reply.code(200).send();
    });

    app.delete<{
        Params: WordlistParams,
        Querystring: {
            word: string[];
        }
    }>('/api/words/:wordType', {
        onRequest: [app.auth()],
        schema: {
            ...wordlistParamsSchema,
            querystring: {
                type: 'object',
                required: ['word'],
                properties: {
                    word: {
                        type: 'array',
                        maxItems: 100,
                        items: { type: 'string' }
                    }
                }
            }
        }
    }, async (request, reply) => {
        const words = request.query.word.map(w => w.toLowerCase());
        const wordType = request.params.wordType;

        const { mainWordlist } = resolveWordlists(wordType);

        // Delete in DB and cache
        await prisma.word.deleteMany({
            where: {
                word: {
                    in: words
                },
                type: wordType
            }
        });

        words.forEach(w => mainWordlist.remove(w));

        return reply.code(200).send();
    });
}

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

function resolveWordlists(ignoreWord: boolean) {
    if (ignoreWord) {
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

async function updateListings(word: string, ignoreWord: boolean) {
    return prisma.listing.updateMany({
        where: {
            title: {
                contains: word,
                mode: 'insensitive'
            },
            isIgnored: !ignoreWord
        },
        data: {
            isIgnored: ignoreWord
        }
    }).then((result) => {
        console.log(
            `${ignoreWord ? 'Ignored' : 'Unignored'} ${result.count} listings with word ${word}`
        );
    }).catch((error) => {
        console.error(
            `Error while updating listings with word ${word}: ${error}`
        );
    });
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

    app.post<{
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
        const ignoreWord = wordType === WordType.ignored;

        const { mainWordlist, subWordlist } = resolveWordlists(ignoreWord);

        // Check for conflicts
        if (mainWordlist.has(word)) {
            return reply.code(409).send({
                error: 'Слово уже добавлено'
            });
        }

        if (subWordlist.has(word)) {
            return reply.code(409).send({
                error: `Это слово уже ${ignoreWord ? 'отслеживается' : 'игнорируется'}`
            });
        }

        // Add word to DB and cache
        await prisma.word.create({
            data: {
                word: word,
                type: wordType
            }
        });

        // Add to wordlist
        mainWordlist.add(word);

        // Update existing entries
        await updateListings(word, ignoreWord);

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
        const fromIgnored = wordType === WordType.ignored;

        const { mainWordlist } = resolveWordlists(fromIgnored);

        // Delete in DB and cache
        await prisma.word.deleteMany({
            where: {
                word: {
                    in: words
                },
                type: wordType
            }
        });

        if (fromIgnored) {
            const promises = words.map(async (w) => {
                mainWordlist.delete(w);
                return updateListings(w, false)
            });

            await Promise.all(promises);
        }
        else {
            words.forEach(w => mainWordlist.delete(w));
        }

        return reply.code(200).send();
    });
}

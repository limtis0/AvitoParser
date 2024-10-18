import Conf from 'conf';

const schema = {
    auth: {
        type: 'object',
        properties: {
            passwordHash: { type: ['string', 'null'], default: null },
            apiKey: { type: ['string', 'null'], default: null }
        }
    },
    parser: {
        type: 'object',
        properties: {
            maxPages: { type: 'number', minimum: 1, maximum: 100, default: 3 },
            listingsIntervalMS: { type: 'number', minimum: 1, default: 5e3 },
            listingCheckAfterMS: { type: 'number', minimum: 1, default: 900e3 },
            categoryIntervalMS: { type: 'number', minimum: 1, default: 30e3 }
        }
    }
}

interface IConfig {
    auth: {
        passwordHash: string | null,
        apiKey: string | null,
    },
    parser: {
        maxPages: number,
        listingsIntervalMS: number,
        listingCheckAfterMS: number,
        categoryIntervalMS: number,
    }
};

export const config = new Conf<IConfig>({ projectName: 'avito-parser', schema: schema });

Object.keys(schema).forEach(field => {
    if (!config.get(field)) {
        config.set(field, {});
    }
});

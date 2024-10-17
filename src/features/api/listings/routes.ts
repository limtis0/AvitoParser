import { app, prisma } from "@/index";
import { Prisma } from "@prisma/client";

type ListingOrderBy = 'itemId' | 'title' | 'price' | 'postedAt' | 'updatedAt';
const listingOrderBy: ListingOrderBy[] = ['itemId', 'title', 'price', 'postedAt', 'updatedAt'];

export function registerListingRoutes() {
    app.get<{
        Querystring: {
            take: number;
            skip: number;
            orderBy: ListingOrderBy;
            sortOrder: Prisma.SortOrder;
            isActive?: boolean;
            isIgnored?: boolean;
            isTracking?: boolean;
            wasChecked?: boolean;
            categoryId?: number;
            search?: string;
            dateFrom?: string,
            dateTo?: string
        }
    }>('/api/listings', {
        onRequest: [app.auth()],
        schema: {
            querystring: {
                type: 'object',
                required: ['take', 'skip', 'orderBy', 'sortOrder'],
                properties: {
                    take: { type: 'integer', minimum: 1, maximum: 300, default: 200 },
                    skip: { type: 'integer', minimum: 0, default: 0 },
                    orderBy: { type: 'string', enum: listingOrderBy, default: 'postedAt' },
                    sortOrder: { type: 'string', enum: ['asc', 'desc'], default: 'desc' },
                    isActive: { type: 'boolean' },
                    isIgnored: { type: 'boolean'  },
                    isTracking: { type: 'boolean' },
                    wasChecked: { type: 'boolean' },
                    categoryId: { type: 'integer' },
                    search: { type: 'string' },
                    dateFrom: { type: 'string', format: 'date-time' },
                    dateTo: { type: 'string', format: 'date-time' }
                }
            }
        }
    }, async (request, reply) => {
        const { take, skip, orderBy, sortOrder, search, dateFrom, dateTo, ...where } = request.query;

        // Add search params
        const whereListing: Prisma.ListingWhereInput = where;

        if (search) {
            whereListing.OR = [
                { title: { contains: search, mode: 'insensitive' } },
                { address: { contains: search, mode: 'insensitive' } },
                { brand: { equals: search } }
            ];
        }

        if (dateFrom || dateTo) {
            whereListing.postedAt = {
                gte: dateFrom ? new Date(dateFrom) : undefined,
                lte: dateTo ? new Date(dateTo) : undefined
            }
        }

        const listings = await prisma.listing.findMany({
            take: take,
            skip: skip,
            orderBy: {
                [orderBy]: sortOrder
            },
            select: {
                itemId: true,
                title: true,
                price: true,
                description: true,
                url: true,
                imageUrl: true,
                address: true,
                brand: true,
                postedAt: true,
                updatedAt: true,
                isActive: true,
                isIgnored: true,
                isTracking: true,
                wasChecked: true
            },
            where: whereListing
        });

        const count = await prisma.listing.count({
            where: whereListing
        });

        return reply.code(200).send({
            listings: listings,
            count: count
        });
    });

    app.put<{
        Body: {
            itemIds: string[],
            isActive?: boolean;
            isIgnored?: boolean,
            isTracking?: boolean
        }
    }>('/api/listings/mark', {
        onRequest: [app.auth()],
        schema: {
            body: {
                type: 'object',
                required: ['itemIds'],
                properties: {
                    isActive: { type: 'boolean' },
                    isIgnored: { type: 'boolean' },
                    isTracking: { type: 'boolean' }
                }
            }
        }
    }, async (request, reply) => {
        const { itemIds, ...data } = request.body;

        await prisma.listing.updateMany({
            where: {
                itemId: {
                    in: itemIds
                }
            },
            data: data
        });

        return reply.code(200).send();
    });
}

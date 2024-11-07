import { prisma } from "../../..";
import AvitoParser, { FirewallError } from "../avitoParser";
import { config } from "../../config";
import HeroProvider from "../utils/heroProvider";
import { setTimeout as sleep } from 'timers/promises';
import { setIntervalAsync } from "set-interval-async/fixed";

export default class AvitoListingService {
    static Start() {
        setIntervalAsync(() => this.trackingLoop(), config.store.parser.listingsIntervalMS);
    }

    private static async trackingLoop() {
        try {
            const updatedBefore = new Date(Date.now() - config.store.parser.listingCheckAfterMS);

            const listings = await prisma.listing.findMany({
                where: {
                    isTracking: true,
                    isActive: true,
                    updatedAt: {
                        lte: updatedBefore
                    }
                },
                orderBy: {
                    postedAt: 'desc'
                },
                select: {
                    id: true,
                    url: true
                }
            });

            if (listings.length === 0) {
                // A hack not to print every time
                if (Date.now() % 8 == 0) {
                    console.log('> No tracking listings to update, waiting...')
                }

                await sleep(config.store.parser.listingsIntervalMS);
                return;
            }

            // Sort an array not to be stuck on the same listing
            listings.sort(() => .5 - Math.random());

            const hero = HeroProvider.newHero({ withProxy: true });

            for (const listing of listings) {
                console.log(`> Checking listing ${listing.id}`);

                try {
                    const info = await AvitoParser.parseItem(listing.url, hero);

                    if (info === null) {
                        await prisma.listing.update({
                            where: {
                                id: listing.id
                            },
                            data: {
                                isActive: false
                            }
                        });

                        continue;
                    }

                    console.log(`+ Listing ${listing.id} has been updated`);

                    await prisma.listing.update({
                        where: {
                            id: listing.id
                        },
                        data: {
                            ...info
                        }
                    })
                }
                catch (error) {
                    if (error instanceof FirewallError) {
                        console.error(`IP has been locked, waiting for rotation...`);
                        await sleep(config.store.proxy.rotationIntervalMS);
                        continue;
                    }
                    else {
                        console.error(`Error while parsing listing: ${error}`);
                    }
                }

                await sleep(config.store.parser.listingsIntervalMS);
            }

            await HeroProvider.closeHero(hero);
        }
        catch (error) {
            console.error(`! Error in newListingsLoop: ${error}`);
        }
        finally {
            await sleep(config.store.parser.listingsIntervalMS);
        }
    }
}

import { prisma } from "../../..";
import AvitoParser, { FirewallError } from "../avitoParser";
import { config } from "../../config";
import HeroProvider from "../utils/heroProvider";
import { setTimeout as sleep } from 'timers/promises';

export default class AvitoListingService {
    static Start() {
        this.trackingLoop();
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
                setTimeout(() => { this.trackingLoop() }, config.store.parser.listingsIntervalMS);
                return;
            }

            const hero = HeroProvider.newHero();

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
            setTimeout(() => { this.trackingLoop() }, config.store.parser.listingsIntervalMS);
        }
    }
}

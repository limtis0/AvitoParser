import Hero from "@ulixee/hero";
import { prisma } from "../../..";
import AvitoParser, { FirewallError } from "../avitoParser";
import { config } from "../../config";
import HeroProvider from "../utils/heroProvider";
import AvitoUrlUtils from "../../../utils/avitoUrlUtils";
import { setTimeout as sleep } from 'timers/promises'
import { isTextInWordlist, ignoredWordlist, trackedWordlist } from "@/features/api/wordlist/wordlists";

export default class AvitoCategoryService {
    private static readonly SkipOnNumDuplicates = 20;

    static Start() {
        this.loop();
    }

    private static async loop() {
        try {
            const categories = await prisma.category.findMany({
                select: {
                    id: true,
                    name: true,
                    url: true,
                }
            });

            if (categories.length === 0) {
                setTimeout(() => { this.loop() }, config.store.parser.listingsIntervalMS);
                return;
            }

            const hero = HeroProvider.newHero();

            for (const category of categories) {
                for (let page = 1; page <= config.store.parser.maxPages; page++) {
                    const pageUrl = AvitoUrlUtils.getCategory(category.url, {
                        page: page,
                        sortNew: true
                    });

                    const result = await this.addCategory({
                        url: pageUrl,
                        categoryId: category.id,
                        hero: hero
                    });

                    if (!result) {
                        continue;
                    }

                    console.log(`+ Added ${result.amountAdded} listings from ${category.name} (${result.duplicateCount} duplicates)`);

                    // Skip if too many duplicates found
                    if (result.duplicateCount >= this.SkipOnNumDuplicates) {
                        break;
                    }
                }

                await sleep(config.store.parser.categoryIntervalMS);
            }

            await HeroProvider.closeHero(hero);
        }
        catch (error) {
            console.error(`! Error in newListingsLoop: ${error}`);
        }
        finally {
            setTimeout(() => { this.loop() }, config.store.parser.listingsIntervalMS);
        }
    }

    private static async addCategory({ url, categoryId, hero }: { url: string; categoryId: number; hero: Hero; }) {
        let listings = [];

        // Parse listings
        try {
            listings = await AvitoParser.parseCategory(url, hero);
        }
        catch (error) {
            if (error instanceof FirewallError) {
                console.error(`IP has been locked, waiting for rotation...`);  // TODO: Add handler
            }
            else {
                console.error(`Error while parsing category: ${error}`);
            }

            return;
        }

        // Count duplicates to skip category if needed
        const duplicateCount = await prisma.listing.count({
            where: {
                itemId: {
                    in: listings.map(l => l.itemId)
                }
            }
        });

        if (duplicateCount === listings.length) {
            return {
                amountAdded: 0,
                duplicateCount: duplicateCount
            }
        }

        let data = listings.map(l => {
            const isTracked = isTextInWordlist(l.title, trackedWordlist);
            const isIgnored = !isTracked && isTextInWordlist(l.title, ignoredWordlist);

            return {
                ...l,
                isTracked: isTracked,
                isIgnored: isIgnored,
                categoryId: categoryId
            }
        });

        await prisma.listing.createMany({
            data: data,
            skipDuplicates: true
        });

        return {
            amountAdded: data.length - duplicateCount,
            duplicateCount: duplicateCount
        }
    }
}

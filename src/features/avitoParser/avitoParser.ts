import Hero from '@ulixee/hero';
import HeroProvider from './utils/heroProvider';
import AvitoUrlUtils from '../../utils/avitoUrlUtils';
import { parseRussianTextDate } from '@/utils/dateParser';

const GeneralSelectors = {
    firewall: '.firewall-container',
}

const CategorySelectors = {
    categoryItem: 'div[data-marker="item"]',
    itemUrl: '[itemprop="url"]',
    itemTitle: '[itemprop="name"]',  // h3
    itemPrice: '[itemprop="price"]',  // <meta itemprop="price" content="4300"> (content="0" if not set)
    itemDescription: 'div[class*="description"] > p', // Might not be present
    itemAddress: 'div[data-marker="item"] div[class^="geo"]',
    itemPostedAt: '[data-marker="item-date"]',
    itemImage: 'img',  // "itemprop" is not set on videos
    itemBrand: 'div[class*="userInfo"] a'  // href "/brands/BRAND_ID?..."
}

const ListingSelectors = {
    isClosed: 'div[class^="closed-warning-block"]',
    title: 'h1[itemprop="name"]',
    postedAt: 'span[data-marker="item-view/item-date"]',
    address: 'div[itemprop="address"] > p:first-child',
    price: 'span[itemprop="price"]',
    ratings: 'a[data-marker="rating-caption/rating"]'
}

const Regex = {
    brandUrl: /brands|user\/([a-zA-Z0-9]+)/,
    userIdUrl: /user\/([a-zA-Z0-9]+)\/ratings/
}

export class FirewallError extends Error {
    constructor(msg: string) {
        super(msg);
        Object.setPrototypeOf(this, FirewallError.prototype);
    }
}

export default class AvitoParser {
    public static async parseCategory(pageUrl: string, hero?: Hero) {
        const newHero = !hero;

        if (!hero) {
            hero = HeroProvider.newHero();
        }

        // Load page
        await hero.goto(pageUrl);

        // Check for IP block
        const firewall = hero.querySelector(GeneralSelectors.firewall);

        if (await firewall.$exists) {
            throw new FirewallError('IP is blocked');
        }

        await hero.waitForElement(hero.querySelector(CategorySelectors.categoryItem));

        // Select all the items
        const itemElements = hero.querySelectorAll(CategorySelectors.categoryItem);

        if (await itemElements.length === 0) {
            throw new Error(`Could not parse category ${pageUrl} (0 elements found)`);
        }

        const result: {
            itemId: string;
            url: string;
            title: string;
            price: number;
            description: string | null;
            address: string;
            imageUrl: string;
            postedAt: Date;
            brand: string | null;
        }[] = [];

        // Preload images
        for (const element of await itemElements) {
            await element.scrollIntoView();
            try {
                await element.querySelector(CategorySelectors.itemImage).$waitForExists({
                    timeoutMs: 5000
                });
            } catch (error) {
                continue;
            }

            const selected = {
                url: element.querySelector(CategorySelectors.itemUrl),
                title: element.querySelector(CategorySelectors.itemTitle),
                price: element.querySelector(CategorySelectors.itemPrice),
                description: element.querySelector(CategorySelectors.itemDescription),
                address: element.querySelector(CategorySelectors.itemAddress),
                image: element.querySelector(CategorySelectors.itemImage),
                postedAt: element.querySelector(CategorySelectors.itemPostedAt),
                brand: element.querySelector(CategorySelectors.itemBrand)
            };

            const evaluated = {
                itemId: await element.getAttribute('data-item-id'),
                url: await selected.url.getAttribute('href'),
                title: await selected.title.innerText,
                price: await selected.price.getAttribute('content'),
                description: (await selected.description.$exists) ? await selected.description.textContent : null,
                address: await selected.address.innerText,
                imageUrl: await selected.image.getAttribute('src'),
                postedAt: await selected.postedAt.innerText,
                brandUrl: (await selected.brand.$exists) ? await selected.brand.getAttribute('href') : null
            };

            for (const key of ['itemId', 'url', 'imageUrl']) {
                if (evaluated[key as keyof typeof evaluated] === null) {
                    throw new Error(`No "${key}" present in element at ${pageUrl}`);
                }
            }

            // Resolve brand name
            let brand = evaluated.brandUrl;

            if (brand) {
                const match = brand.match(Regex.brandUrl);
                
                if (match === null) {
                    console.error(`Could not match brandUrl with regex ${brand}`);
                    brand = null;
                }
                else {
                    brand = match[1];
                }
            }

            result.push({
                itemId: evaluated.itemId!.toLowerCase().trim(),
                url: AvitoUrlUtils.getAbsolute(evaluated.url!.split('?')[0]),
                title: evaluated.title.trim(),
                price: evaluated.price ? Number(evaluated.price) : 0,
                description: evaluated.description,
                address: evaluated.address.trim(),
                imageUrl: evaluated.imageUrl!,
                postedAt: parseRussianTextDate(evaluated.postedAt),
                brand: brand
            });
        }

        if (newHero) {
            await HeroProvider.closeHero(hero);
        }

        return result;
    }

    public static async parseItem(pageUrl: string, hero?: Hero) {
        const newHero = !hero;

        if (!hero) {
            hero = HeroProvider.newHero();
        }

        pageUrl = AvitoUrlUtils.getAbsolute(pageUrl);

        const navigation = await hero.goto(pageUrl);

        // Check for 404
        if (navigation.response.statusCode === 404) {
            return null;
        }

        // Check for IP block
        const firewall = hero.querySelector(GeneralSelectors.firewall);

        if (await firewall.$exists) {
            throw new FirewallError('IP is blocked');
        }

        // Check if listing is closed
        const isClosed = await hero.querySelector(ListingSelectors.isClosed).$exists;

        if (isClosed) {
            return null;
        }

        // Get data
        const selected = {
            title: hero.querySelector(ListingSelectors.title),
            price: hero.querySelector(ListingSelectors.price),
            address: hero.querySelector(ListingSelectors.address)
        };

        const evaluated = {
            title: await selected.title.innerText,
            price: await selected.price.getAttribute('content'),
            address: await selected.address.innerText
        }

        // Get userId from rating request
        const tab = hero.activeTab;

        const ratingsButton = await hero.waitForElement(hero.querySelector(ListingSelectors.ratings), {
            waitForClickable: true
        });

        if (!ratingsButton) {
            throw new Error('Rating button is not found');
        }

        await ratingsButton.$click();

        const ratingsRequest = await tab.waitForResource({
            url: Regex.userIdUrl,
            type: 'Fetch'
        });

        const userId = ratingsRequest.url.match(Regex.userIdUrl)![1];

        // Close browser
        if (newHero) {
            await HeroProvider.closeHero(hero);
        }

        return {
            title: evaluated.title,
            price: evaluated.price ? Number(evaluated.price) : 0,
            adrress: evaluated.address,
            userId: userId,
        }
    }
}

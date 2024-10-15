import { prisma } from "@/index";
import { WordType } from "@prisma/client";

export let ignoredWordlist: Set<string>;
export let trackedWordlist: Set<string>;
export let ignoredBrandlist: Set<string>;

export async function loadWordlistCaches() {
    await Promise.all([loadBrandlist(), loadWordlists()]);
}

async function loadWordlists() {
    ignoredWordlist = new Set();
    trackedWordlist = new Set();

    // Query from DB
    const words = await prisma.word.findMany({
        select: {
            word: true,
            type: true
        }
    });

    // Load into cache
    words.forEach(({ word, type }) => {
        if (type === WordType.ignored) {
            ignoredWordlist.add(word);
        }
        else {
            trackedWordlist.add(word);
        }
    });
}

async function loadBrandlist() {
    const brands = await prisma.blockedBrand.findMany({
        select: {
            name: true
        }
    });
    
    ignoredBrandlist = new Set(brands.map(b => b.name));
}

export function isTextInWordlist(text: string, wordlist: Set<string>) {
    const words = text.trim().split(/\s{1,}/g);
    return words.some(w => wordlist.has(w.toLowerCase()));
}


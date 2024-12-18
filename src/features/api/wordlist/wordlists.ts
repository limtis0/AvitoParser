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
        word = word.toLowerCase();
        
        if (type === WordType.ignored) {
            ignoredWordlist.add(word);
        }
        else {
            trackedWordlist.add(word);
        }
    });

    console.log(`"Ignore" Wordlist is loaded (${ignoredWordlist.size} entries)`);
    console.log(`"Track" Wordlist is loaded (${trackedWordlist.size} entries)`);
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
    const words = text
        .replace(/[^А-Яа-яA-Za-z\s]/g, ' ') // Replace all non-word characters
        .trim()
        .split(/\s+/); // Split by one or more spaces
    return words.some(w => wordlist.has(w.toLowerCase())); // Check case-insensitively
}


import { prisma } from "@/index";
import { Trie } from "@kamilmielnik/trie";
import { WordType } from "@prisma/client";

export let ignoredWordlist: Trie;
export let trackedWordlist: Trie;

export async function loadWordlists() {
    ignoredWordlist = new Trie();
    trackedWordlist = new Trie();

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

export function isTextInWordlist(text: string, wordlist: Trie) {
    const words = text.trim().split(/\s{1,}/g);
    return words.some(w => wordlist.has(w.toLowerCase()));
}


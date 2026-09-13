import type { Localised } from "@/lib/game-engine/types";

/**
 * Content for "Find the Different One".
 *
 * Each pair is a repeated background object and a single odd one.
 * Difficulty comes from how alike the two are, which is what makes
 * this an attention task rather than a knowledge task:
 *
 *   low    — obviously unrelated things
 *   medium — same family, clearly different shape
 *   high   — same object, one detail apart (red vs green apple)
 */

export type Similarity = "low" | "medium" | "high";

export interface OddPair {
  id: string;
  similarity: Similarity;
  base: { glyph: string; label: Localised };
  odd: { glyph: string; label: Localised };
}

export const ODD_PAIRS: OddPair[] = [
  {
    id: "apple-elephant",
    similarity: "low",
    base: { glyph: "🍎", label: { EN: "Apple", HI: "सेब", AS: "আপেল" } },
    odd: { glyph: "🐘", label: { EN: "Elephant", HI: "हाथी", AS: "হাতী" } },
  },
  {
    id: "flower-spoon",
    similarity: "low",
    base: { glyph: "🌺", label: { EN: "Flower", HI: "फूल", AS: "ফুল" } },
    odd: { glyph: "🥄", label: { EN: "Spoon", HI: "चम्मच", AS: "চামুচ" } },
  },
  {
    id: "house-fish",
    similarity: "low",
    base: { glyph: "🏠", label: { EN: "House", HI: "घर", AS: "ঘৰ" } },
    odd: { glyph: "🐟", label: { EN: "Fish", HI: "मछली", AS: "মাছ" } },
  },
  {
    id: "umbrella-banana",
    similarity: "low",
    base: { glyph: "☂️", label: { EN: "Umbrella", HI: "छाता", AS: "ছাতি" } },
    odd: { glyph: "🍌", label: { EN: "Banana", HI: "केला", AS: "কল" } },
  },
  {
    id: "lamp-bicycle",
    similarity: "low",
    base: { glyph: "🪔", label: { EN: "Lamp", HI: "दीया", AS: "চাকি" } },
    odd: { glyph: "🚲", label: { EN: "Bicycle", HI: "साइकिल", AS: "চাইকেল" } },
  },

  {
    id: "apple-cherry",
    similarity: "medium",
    base: { glyph: "🍎", label: { EN: "Apple", HI: "सेब", AS: "আপেল" } },
    odd: { glyph: "🍒", label: { EN: "Cherry", HI: "चेरी", AS: "চেৰী" } },
  },
  {
    id: "cow-goat",
    similarity: "medium",
    base: { glyph: "🐄", label: { EN: "Cow", HI: "गाय", AS: "গৰু" } },
    odd: { glyph: "🐐", label: { EN: "Goat", HI: "बकरी", AS: "ছাগলী" } },
  },
  {
    id: "tea-milk",
    similarity: "medium",
    base: { glyph: "🍵", label: { EN: "Tea", HI: "चाय", AS: "চাহ" } },
    odd: { glyph: "🥛", label: { EN: "Milk", HI: "दूध", AS: "গাখীৰ" } },
  },
  {
    id: "boat-ship",
    similarity: "medium",
    base: { glyph: "🛶", label: { EN: "Boat", HI: "नाव", AS: "নাও" } },
    odd: { glyph: "⛵", label: { EN: "Sailboat", HI: "पालवाली नाव", AS: "পাল নাও" } },
  },
  {
    id: "bird-chicken",
    similarity: "medium",
    base: { glyph: "🐦", label: { EN: "Bird", HI: "चिड़िया", AS: "চৰাই" } },
    odd: { glyph: "🐓", label: { EN: "Rooster", HI: "मुर्गा", AS: "কুকুৰা" } },
  },

  {
    id: "red-green-apple",
    similarity: "high",
    base: { glyph: "🍎", label: { EN: "Red apple", HI: "लाल सेब", AS: "ৰঙা আপেল" } },
    odd: { glyph: "🍏", label: { EN: "Green apple", HI: "हरा सेब", AS: "সেউজীয়া আপেল" } },
  },
  {
    id: "elephant-rhino",
    similarity: "high",
    base: { glyph: "🐘", label: { EN: "Elephant", HI: "हाथी", AS: "হাতী" } },
    odd: { glyph: "🦏", label: { EN: "Rhino", HI: "गैंडा", AS: "গঁড়" } },
  },
  {
    id: "cup-teacup",
    similarity: "high",
    base: { glyph: "☕", label: { EN: "Cup of tea", HI: "चाय का कप", AS: "চাহৰ কাপ" } },
    odd: { glyph: "🍵", label: { EN: "Green tea", HI: "हरी चाय", AS: "সেউজীয়া চাহ" } },
  },
  {
    id: "fish-tropical",
    similarity: "high",
    base: { glyph: "🐟", label: { EN: "Fish", HI: "मछली", AS: "মাছ" } },
    odd: { glyph: "🐠", label: { EN: "Striped fish", HI: "धारीदार मछली", AS: "ৰেঙনি মাছ" } },
  },
  {
    id: "daisy-sunflower",
    similarity: "high",
    base: { glyph: "🌼", label: { EN: "Small flower", HI: "छोटा फूल", AS: "সৰু ফুল" } },
    odd: { glyph: "🌻", label: { EN: "Sunflower", HI: "सूरजमुखी", AS: "সূৰ্যমুখী" } },
  },
  {
    id: "tree-pine",
    similarity: "high",
    base: { glyph: "🌳", label: { EN: "Tree", HI: "पेड़", AS: "গছ" } },
    odd: { glyph: "🌲", label: { EN: "Pine tree", HI: "चीड़ का पेड़", AS: "দেৱদাৰু গছ" } },
  },
];

export function pairsBySimilarity(similarity: Similarity): OddPair[] {
  return ODD_PAIRS.filter((p) => p.similarity === similarity);
}

import type { Localised } from "@/lib/game-engine/types";

/**
 * The object bank.
 *
 * Chosen to be familiar to an elderly person in the North Eastern
 * Region: tea, the rhino and elephant of Kaziranga, bamboo, the
 * river boat, paddy rice, the dhol. Recognition memory works best
 * on things a person has lived with, so this list is deliberately
 * domestic and regional rather than generic.
 */

export interface GameObject {
  id: string;
  glyph: string;
  label: Localised;
}

export const OBJECTS: GameObject[] = [
  { id: "tea", glyph: "🍵", label: { EN: "Tea", HI: "चाय", AS: "চাহ" } },
  { id: "elephant", glyph: "🐘", label: { EN: "Elephant", HI: "हाथी", AS: "হাতী" } },
  { id: "rhino", glyph: "🦏", label: { EN: "Rhino", HI: "गैंडा", AS: "গঁড়" } },
  { id: "bamboo", glyph: "🎋", label: { EN: "Bamboo", HI: "बाँस", AS: "বাঁহ" } },
  { id: "fish", glyph: "🐟", label: { EN: "Fish", HI: "मछली", AS: "মাছ" } },
  { id: "rice", glyph: "🍚", label: { EN: "Rice", HI: "चावल", AS: "ভাত" } },
  { id: "banana", glyph: "🍌", label: { EN: "Banana", HI: "केला", AS: "কল" } },
  { id: "coconut", glyph: "🥥", label: { EN: "Coconut", HI: "नारियल", AS: "নাৰিকল" } },
  { id: "flower", glyph: "🌺", label: { EN: "Flower", HI: "फूल", AS: "ফুল" } },
  { id: "lotus", glyph: "🪷", label: { EN: "Lotus", HI: "कमल", AS: "পদুম" } },
  { id: "umbrella", glyph: "☂️", label: { EN: "Umbrella", HI: "छाता", AS: "ছাতি" } },
  { id: "boat", glyph: "🛶", label: { EN: "Boat", HI: "नाव", AS: "নাও" } },
  { id: "lamp", glyph: "🪔", label: { EN: "Lamp", HI: "दीया", AS: "চাকি" } },
  { id: "spoon", glyph: "🥄", label: { EN: "Spoon", HI: "चम्मच", AS: "চামুচ" } },
  { id: "house", glyph: "🏠", label: { EN: "House", HI: "घर", AS: "ঘৰ" } },
  { id: "bicycle", glyph: "🚲", label: { EN: "Bicycle", HI: "साइकिल", AS: "চাইকেল" } },
  { id: "clock", glyph: "⏰", label: { EN: "Clock", HI: "घड़ी", AS: "ঘড়ী" } },
  { id: "book", glyph: "📖", label: { EN: "Book", HI: "किताब", AS: "কিতাপ" } },
  { id: "key", glyph: "🔑", label: { EN: "Key", HI: "चाबी", AS: "চাবি" } },
  { id: "apple", glyph: "🍎", label: { EN: "Apple", HI: "सेब", AS: "আপেল" } },
  { id: "bird", glyph: "🐦", label: { EN: "Bird", HI: "चिड़िया", AS: "চৰাই" } },
  { id: "cow", glyph: "🐄", label: { EN: "Cow", HI: "गाय", AS: "গৰু" } },
  { id: "tree", glyph: "🌳", label: { EN: "Tree", HI: "पेड़", AS: "গছ" } },
  { id: "sun", glyph: "☀️", label: { EN: "Sun", HI: "सूरज", AS: "বেলি" } },
  { id: "drum", glyph: "🥁", label: { EN: "Drum", HI: "ढोल", AS: "ঢোল" } },
  { id: "basket", glyph: "🧺", label: { EN: "Basket", HI: "टोकरी", AS: "টুকুৰী" } },
  { id: "glasses", glyph: "👓", label: { EN: "Glasses", HI: "चश्मा", AS: "চছমা" } },
  { id: "cup", glyph: "🥛", label: { EN: "Milk", HI: "दूध", AS: "গাখীৰ" } },
];

export const OBJECTS_BY_ID = new Map(OBJECTS.map((o) => [o.id, o]));

import type { Language } from "@prisma/client";

/**
 * CULTURAL CONTENT — Story Recall
 * -----------------------------------------------------------------
 * Short, gentle, familiar stories for the Story Recall activity,
 * held entirely separately from game logic so content can grow (and
 * be reviewed, regionalised, or added to) without touching code.
 *
 * The settings are everyday and familiar to the North East — a
 * market trip, a tea garden — without stereotyping any one community.
 * Nothing here is an examination: the tone is warm and the questions
 * are simple recall.
 *
 * Translation note: English and Hindi are hand-written. The Assamese
 * is written carefully but should have a final pass from a native
 * speaker before release — it is marked here honestly rather than
 * presented as verified.
 */

type Localised = Record<Language, string>;

export interface StoryOption {
  id: string;
  label: Localised;
}

export interface StoryQuestion {
  id: string;
  prompt: Localised;
  options: StoryOption[];
  correctOptionId: string;
}

export interface Story {
  id: string;
  /** How long the story is shown before the questions, in seconds. */
  readingSeconds: number;
  text: Localised;
  questions: StoryQuestion[];
}

export const STORIES: Story[] = [
  {
    id: "market-trip",
    readingSeconds: 18,
    text: {
      EN: "Aai went to the market in the morning. She bought some rice, a fish, and a banana. Then she walked back home and made lunch for the family.",
      HI: "आई सुबह बाज़ार गईं। उन्होंने थोड़े चावल, एक मछली और एक केला खरीदा। फिर वे घर लौटकर परिवार के लिए खाना बनाने लगीं।",
      AS: "আই ৰাতিপুৱা বজাৰলৈ গ'ল। তেওঁ অলপ চাউল, এটা মাছ আৰু এটা কল কিনিলে। তাৰ পিছত ঘৰলৈ উভতি আহি পৰিয়ালৰ বাবে দুপৰীয়াৰ আহাৰ বনালে।",
    },
    questions: [
      {
        id: "where",
        prompt: {
          EN: "Where did Aai go?",
          HI: "आई कहाँ गईं?",
          AS: "আই ক'লৈ গ'ল?",
        },
        options: [
          { id: "market", label: { EN: "The market", HI: "बाज़ार", AS: "বজাৰ" } },
          { id: "temple", label: { EN: "The temple", HI: "मंदिर", AS: "মন্দিৰ" } },
          { id: "river", label: { EN: "The river", HI: "नदी", AS: "নদী" } },
        ],
        correctOptionId: "market",
      },
      {
        id: "count",
        prompt: {
          EN: "How many things did she buy?",
          HI: "उन्होंने कितनी चीज़ें खरीदीं?",
          AS: "তেওঁ কেইটা বস্তু কিনিলে?",
        },
        options: [
          { id: "two", label: { EN: "Two", HI: "दो", AS: "দুটা" } },
          { id: "three", label: { EN: "Three", HI: "तीन", AS: "তিনিটা" } },
          { id: "four", label: { EN: "Four", HI: "चार", AS: "চাৰিটা" } },
        ],
        correctOptionId: "three",
      },
      {
        id: "made",
        prompt: {
          EN: "What did she make at home?",
          HI: "उन्होंने घर पर क्या बनाया?",
          AS: "তেওঁ ঘৰত কি বনালে?",
        },
        options: [
          { id: "lunch", label: { EN: "Lunch", HI: "दोपहर का खाना", AS: "দুপৰীয়াৰ আহাৰ" } },
          { id: "tea", label: { EN: "Tea", HI: "चाय", AS: "চাহ" } },
          { id: "sweets", label: { EN: "Sweets", HI: "मिठाई", AS: "মিঠাই" } },
        ],
        correctOptionId: "lunch",
      },
    ],
  },
  {
    id: "tea-garden",
    readingSeconds: 20,
    text: {
      EN: "Raju visited the tea garden with his grandson. They saw the green tea plants and a small bird singing. On the way back, they shared a sweet orange.",
      HI: "राजू अपने पोते के साथ चाय बगान गए। उन्होंने हरी चाय की झाड़ियाँ और एक छोटी चिड़िया को गाते देखा। लौटते समय उन्होंने एक मीठा संतरा बाँटकर खाया।",
      AS: "ৰাজু নাতিৰ সৈতে চাহ বাগানলৈ গ'ল। তেওঁলোকে সেউজীয়া চাহ গছ আৰু গান গোৱা এটা সৰু চৰাই দেখিলে। উভতি অহাৰ বাটত তেওঁলোকে এটা মিঠা কমলা ভাগ কৰি খালে।",
    },
    questions: [
      {
        id: "who",
        prompt: {
          EN: "Who did Raju go with?",
          HI: "राजू किसके साथ गए?",
          AS: "ৰাজু কাৰ সৈতে গ'ল?",
        },
        options: [
          { id: "grandson", label: { EN: "His grandson", HI: "अपने पोते", AS: "নাতিৰ" } },
          { id: "friend", label: { EN: "His friend", HI: "अपने दोस्त", AS: "বন্ধুৰ" } },
          { id: "neighbour", label: { EN: "His neighbour", HI: "अपने पड़ोसी", AS: "চুবুৰীয়াৰ" } },
        ],
        correctOptionId: "grandson",
      },
      {
        id: "saw",
        prompt: {
          EN: "What did they see?",
          HI: "उन्होंने क्या देखा?",
          AS: "তেওঁলোকে কি দেখিলে?",
        },
        options: [
          { id: "bird", label: { EN: "A small bird", HI: "एक छोटी चिड़िया", AS: "এটা সৰু চৰাই" } },
          { id: "cow", label: { EN: "A cow", HI: "एक गाय", AS: "এটা গৰু" } },
          { id: "boat", label: { EN: "A boat", HI: "एक नाव", AS: "এখন নাও" } },
        ],
        correctOptionId: "bird",
      },
      {
        id: "ate",
        prompt: {
          EN: "What did they eat on the way back?",
          HI: "लौटते समय उन्होंने क्या खाया?",
          AS: "উভতি অহাৰ বাটত তেওঁলোকে কি খালে?",
        },
        options: [
          { id: "orange", label: { EN: "An orange", HI: "एक संतरा", AS: "এটা কমলা" } },
          { id: "banana", label: { EN: "A banana", HI: "एक केला", AS: "এটা কল" } },
          { id: "apple", label: { EN: "An apple", HI: "एक सेब", AS: "এটা আপেল" } },
        ],
        correctOptionId: "orange",
      },
    ],
  },
];

export const STORIES_BY_ID = new Map(STORIES.map((s) => [s.id, s]));

/** Pick a story deterministically by index (wraps). */
export function storyByIndex(index: number): Story {
  return STORIES[index % STORIES.length];
}

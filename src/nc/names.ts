import { pick } from "../i18n";

/**
 * The Other Scripts books and editions are published in English only, and the server sends only
 * English names for them (its Samaritan books do come with Malayalam and Hindi). So a Malayalam or
 * Hindi reader saw English book names on Malayalam and Hindi pages. These names fill that gap.
 * A name the server does send always wins; a book not listed here keeps its English name.
 * First drafts of the Malayalam and Hindi names: Jincy (Malayalam) and a Hindi reader should check them.
 */
type Names = Record<string, string>;
type Translated = { ml: string; hi: string };

/** By book slug. The Malayalam title of the Letter of Aristeas is Sir's own (the 6 Oct Book Card). */
const BOOKS: Record<string, Translated> = {
  "wisdom-of-solomon": { ml: "സോളമന്റെ ജ്ഞാനം", hi: "सुलैमान की प्रज्ञा" },
  sirach: { ml: "പ്രഭാഷകൻ (സീറാക്ക്)", hi: "सिराख (प्रवक्ता)" },
  "psalm-151": { ml: "സങ്കീർത്തനം 151", hi: "भजन 151" },
  "psalms-151-155": { ml: "സങ്കീർത്തനങ്ങൾ 151–155", hi: "भजन 151–155" },
  "letter-of-aristeas": { ml: "അരിസ്തെയാസിന്റെ കത്ത്", hi: "अरिस्तियास का पत्र" },
  "1-enoch": { ml: "1 ഹാനോക്ക്", hi: "1 हनोक" },
  jubilees: { ml: "ജൂബിലികളുടെ പുസ്തകം", hi: "जुबिलियों की पुस्तक" },
  "qumran-hebrew-witnesses": { ml: "ഖുംറാൻ ഹീബ്രു സാക്ഷ്യങ്ങൾ", hi: "कुमरान इब्रानी साक्ष्य" },
};

/** By edition code: the heading over each group of books. */
const EDITIONS: Record<string, Translated> = {
  "academic-nc-en": { ml: "OriginalScript അക്കാദമിക് ഇംഗ്ലീഷ് (മറ്റു കൃതികൾ)", hi: "OriginalScript अकादमिक अंग्रेज़ी (अन्य ग्रंथ)" },
  "samaritan-pentateuch": { ml: "ശമര്യ പഞ്ചഗ്രന്ഥം", hi: "सामरी पंचग्रंथ" },
};

function named(names: Names | undefined, lang: string, own: Translated | undefined) {
  return names?.[lang] || (lang === "ml" || lang === "hi" ? own?.[lang] : undefined) || pick(names, lang);
}

/** A book's name in the reader's language: the server's, else ours, else English. */
export const ncBookName = (names: Names | undefined, lang: string, slug: string) => named(names, lang, BOOKS[slug]);

/** An edition's name in the reader's language: the server's, else ours, else English. */
export const ncEditionName = (names: Names | undefined, lang: string, code: string) => named(names, lang, EDITIONS[code]);

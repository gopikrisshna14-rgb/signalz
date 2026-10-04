import type { Person } from "@/lib/types";

const GERMAN = /\b(und|wir|ich|der|die|das|nicht|mit|für|unser|unsere|ist|auf|bei)\b/gi;
const ENGLISH = /\b(and|we|the|our|with|for|is|are|this|that|hiring)\b/gi;

/** German for DACH accounts unless the person's own texts are in English. */
export function languageFor(country: string | null, person: Person | null): "German" | "English" {
  if (!country || !["DE", "AT", "CH"].includes(country)) return "English";
  const text = [person?.posts.map((p) => p.text).join(" "), person?.title].filter(Boolean).join(" ");
  const de = text.match(GERMAN)?.length ?? 0;
  const en = text.match(ENGLISH)?.length ?? 0;
  return en > de + 2 ? "English" : "German";
}

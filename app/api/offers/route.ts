import { NextResponse } from "next/server";
import type { Offer, OfferType } from "@/lib/types";

/**
 * La Bonne Alternance — API gouvernementale gratuite
 * https://labonnealternance.apprentissage.beta.gouv.fr/api/v1/
 *
 * On cherche les codes ROME liés au sport, à la communication et à l'événementiel.
 */
const LBA_BASE = "https://labonnealternance.apprentissage.beta.gouv.fr/api/v1";
const CALLER   = "altrack-app";

const ROME_COMM  = "E1103";          // Communication
const ROME_EVENT = "G1202";          // Animation culturelle / événementiel
const ROME_SPORT = "L1509";          // Management d'une structure sportive
const ROME_CODES = `${ROME_COMM},${ROME_EVENT},${ROME_SPORT}`;

// Villes françaises à forte activité sportive
const LOCATIONS = [
  { lat: 48.8566, lon: 2.3522 },   // Paris
  { lat: 45.7640, lon: 4.8357 },   // Lyon
  { lat: 43.2965, lon: 5.3698 },   // Marseille
  { lat: 43.6047, lon: 1.4442 },   // Toulouse
  { lat: 44.8378, lon: -0.5792 },  // Bordeaux
  { lat: 43.7102, lon: 7.2620 },   // Nice
  { lat: 48.5734, lon: 7.7521 },   // Strasbourg
  { lat: 47.2184, lon: -1.5536 },  // Nantes
];

/* ── Typage minimal de la réponse LBA ──────────────────────── */
interface LBAOffer {
  job?: {
    id?:           string;
    title?:        string;
    place?:        { city?: string; fullAddress?: string };
    creationDate?: string;
    url?:          string;
  };
  company?: {
    name?:  string;
    place?: { city?: string };
  };
  url?:    string;
  romes?:  Array<{ code?: string; label?: string }>;
  source?: string;
}

interface LBAResponse {
  peJobs?:  { results?: LBAOffer[] };
  lbaJobs?: { results?: LBAOffer[] };
}

/* ── Helpers ────────────────────────────────────────────────── */
function detectType(title: string, romeCode: string): OfferType {
  const t = title.toLowerCase();
  if (
    romeCode === ROME_COMM ||
    t.includes("communication") ||
    t.includes("social media") ||
    t.includes("digital") ||
    t.includes("contenu") ||
    t.includes("rédact") ||
    t.includes("editorial") ||
    t.includes("médias") ||
    t.includes("presse")
  ) return "communication";
  return "event";
}

function detectSport(title: string, company: string): string {
  const text = `${title} ${company}`.toLowerCase();
  if (text.includes("football") || text.includes(" foot") || text.includes("fifa"))
    return "Football";
  if (text.includes("basket"))           return "Basketball";
  if (text.includes("rugby"))            return "Rugby";
  if (text.includes("tennis"))           return "Tennis";
  if (text.includes("handball"))         return "Handball";
  if (text.includes("volley"))           return "Volleyball";
  if (text.includes("natation") || text.includes("swimming"))
    return "Natation";
  if (text.includes("cyclisme") || text.includes("vélo") || text.includes("tour de france"))
    return "Cyclisme";
  if (text.includes("athlétisme") || text.includes("athletisme"))
    return "Athlétisme";
  if (text.includes("boxe") || text.includes("combat"))
    return "Sports de combat";
  if (text.includes("golf"))             return "Golf";
  if (text.includes("ski") || text.includes("montagne") || text.includes("snowboard"))
    return "Sports hiver";
  if (
    text.includes("sport") ||
    text.includes("stade") ||
    text.includes("club") ||
    text.includes("ligue") ||
    text.includes("fédération") ||
    text.includes("olympique") ||
    text.includes("arena")
  ) return "Multi-sport";
  return "Multi-sport";
}

function toISODate(raw?: string): string {
  if (!raw) return new Date().toISOString().slice(0, 10);
  try {
    return new Date(raw).toISOString().slice(0, 10);
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

function labelSource(lbaSource?: string): string {
  if (!lbaSource) return "La Bonne Alternance";
  const s = lbaSource.toLowerCase();
  if (s.includes("france travail") || s.includes("pole emploi") || s.includes("pe"))
    return "France Travail";
  if (s.includes("hellowork"))    return "HelloWork";
  if (s.includes("indeed"))       return "Indeed";
  if (s.includes("linkedin"))     return "LinkedIn";
  if (s.includes("apec"))         return "APEC";
  return "La Bonne Alternance";
}

/* ── Handler ────────────────────────────────────────────────── */
export async function GET() {
  const seen   = new Set<string>();
  const offers: Offer[] = [];

  const fetches = LOCATIONS.map(loc =>
    fetch(
      `${LBA_BASE}/jobs?romes=${ROME_CODES}&latitude=${loc.lat}&longitude=${loc.lon}&radius=40&caller=${CALLER}`,
      {
        headers: { Accept: "application/json" },
        next: { revalidate: 3600 },      // cache 1 h côté serveur
      }
    )
      .then(r => (r.ok ? r.json() as Promise<LBAResponse> : null))
      .catch(() => null)
  );

  const results = await Promise.allSettled(fetches);

  for (const r of results) {
    if (r.status !== "fulfilled" || !r.value) continue;
    const data = r.value;

    const jobs: LBAOffer[] = [
      ...(data.peJobs?.results  ?? []),
      ...(data.lbaJobs?.results ?? []),
    ];

    for (const item of jobs) {
      const id = item.job?.id;
      if (!id || seen.has(id)) continue;
      seen.add(id);

      const title   = item.job?.title   ?? "";
      const company = item.company?.name ?? "Entreprise";
      const city    =
        item.job?.place?.city ??
        item.company?.place?.city ??
        "France";
      const romeCode = item.romes?.[0]?.code ?? "";
      const jobUrl   =
        item.job?.url ?? item.url ??
        "https://labonnealternance.apprentissage.beta.gouv.fr";

      if (!title) continue;

      offers.push({
        id,
        title,
        company,
        location: city,
        type:     detectType(title, romeCode),
        sport:    detectSport(title, company),
        postedAt: toISODate(item.job?.creationDate),
        source:   labelSource(item.source),
        url:      jobUrl,
      });
    }
  }

  // Tri : offres les plus récentes en premier
  offers.sort((a, b) => b.postedAt.localeCompare(a.postedAt));

  return NextResponse.json(offers);
}

import { NextResponse } from "next/server";
import type { Offer, OfferType } from "@/lib/types";

/* ============================================================
   ALTRACK — Agrégateur multi-sources
   Sources :
     1. La Bonne Alternance (API gov → France Travail + partenaires)
     2. Indeed France          (flux RSS public)
     3. APEC                   (API REST publique)
     4. France Travail direct  (API REST publique)
   ============================================================ */

const CALLER = "altrack-app";

/* ── Colonnes ROME ciblées ──────────────────────────────────── */
const ROME_CODES = "E1103,G1202,L1509";   // comm / événementiel / sport

/* ── Villes ─────────────────────────────────────────────────── */
const CITIES = [
  { lat: 48.8566, lon: 2.3522, label: "Paris" },
  { lat: 45.7640, lon: 4.8357, label: "Lyon" },
  { lat: 43.2965, lon: 5.3698, label: "Marseille" },
  { lat: 43.6047, lon: 1.4442, label: "Toulouse" },
  { lat: 44.8378, lon: -0.5792, label: "Bordeaux" },
  { lat: 43.7102, lon: 7.2620, label: "Nice" },
  { lat: 48.5734, lon: 7.7521, label: "Strasbourg" },
  { lat: 47.2184, lon: -1.5536, label: "Nantes" },
];

/* ── Mots-clés pour Indeed / APEC ───────────────────────────── */
const QUERIES_SPORT = [
  "alternance communication sport",
  "alternance événementiel sport",
  "alternance marketing sport",
  "alternance chargé communication sportif",
];

/* ============================================================
   HELPERS COMMUNS
   ============================================================ */
function detectType(title: string, romeCode = ""): OfferType {
  const t = title.toLowerCase();
  if (
    romeCode === "E1103" ||
    t.includes("communication") ||
    t.includes("social media") ||
    t.includes("digital") ||
    t.includes("contenu") ||
    t.includes("rédact") ||
    t.includes("éditorial") ||
    t.includes("médias") ||
    t.includes("presse") ||
    t.includes("brand") ||
    t.includes("influence")
  ) return "communication";
  return "event";
}

function detectSport(title: string, company = ""): string {
  const txt = `${title} ${company}`.toLowerCase();
  if (txt.includes("football") || txt.includes(" foot") || /\bpsg\b/.test(txt) || /\bol\b/.test(txt))
    return "Football";
  if (txt.includes("basket"))                          return "Basketball";
  if (txt.includes("rugby"))                           return "Rugby";
  if (txt.includes("tennis"))                          return "Tennis";
  if (txt.includes("handball"))                        return "Handball";
  if (txt.includes("volley"))                          return "Volleyball";
  if (txt.includes("natation") || txt.includes("swim")) return "Natation";
  if (txt.includes("cyclisme") || txt.includes("tour de france")) return "Cyclisme";
  if (txt.includes("athlétisme"))                      return "Athlétisme";
  if (txt.includes("boxe") || txt.includes("combat"))  return "Sports de combat";
  if (txt.includes("golf"))                            return "Golf";
  if (txt.includes("ski") || txt.includes("snowboard")) return "Sports hiver";
  if (txt.includes("esport") || txt.includes("gaming")) return "Esport";
  return "Multi-sport";
}

function toISODate(raw?: string | null): string {
  if (!raw) return new Date().toISOString().slice(0, 10);
  try { return new Date(raw).toISOString().slice(0, 10); }
  catch { return new Date().toISOString().slice(0, 10); }
}

function safeFetch(url: string, opts?: RequestInit): Promise<Response | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  return fetch(url, {
    ...opts,
    signal: ctrl.signal,
    headers: {
      "Accept": "application/json, text/xml, */*",
      "User-Agent": "Altrack/1.0 (aggregateur alternance sport)",
      ...(opts?.headers ?? {}),
    },
  })
    .then(r => { clearTimeout(timer); return r; })
    .catch(() => { clearTimeout(timer); return null; });
}

/* ============================================================
   SOURCE 1 — LA BONNE ALTERNANCE
   https://labonnealternance.apprentissage.beta.gouv.fr
   Couvre : France Travail (Pôle Emploi) + HelloWork + partenaires
   ============================================================ */
interface LBAJob {
  job?: {
    id?: string; title?: string;
    place?: { city?: string }; creationDate?: string; url?: string;
  };
  company?: { name?: string; place?: { city?: string } };
  url?: string;
  romes?: { code?: string }[];
  source?: string;
}

async function fetchLBA(): Promise<Offer[]> {
  const requests = CITIES.map(c =>
    safeFetch(
      `https://labonnealternance.apprentissage.beta.gouv.fr/api/v1/jobs?romes=${ROME_CODES}&latitude=${c.lat}&longitude=${c.lon}&radius=40&caller=${CALLER}`,
      { next: { revalidate: 3600 } } as RequestInit
    ).then(r => r?.ok ? r.json() : null).catch(() => null)
  );

  const pages = await Promise.all(requests);
  const seen  = new Set<string>();
  const out: Offer[] = [];

  for (const data of pages) {
    if (!data) continue;
    const jobs: LBAJob[] = [...(data?.peJobs?.results ?? []), ...(data?.lbaJobs?.results ?? [])];
    for (const item of jobs) {
      const id = item.job?.id;
      if (!id || seen.has(id)) continue;
      seen.add(id);
      const title   = item.job?.title ?? "";
      if (!title) continue;
      const company = item.company?.name ?? "Entreprise";
      // Détection source secondaire (France Travail, HelloWork…)
      const src = (() => {
        const s = (item.source ?? "").toLowerCase();
        if (s.includes("france travail") || s.includes("pole emploi")) return "France Travail";
        if (s.includes("hellowork"))   return "HelloWork";
        if (s.includes("indeed"))      return "Indeed";
        if (s.includes("linkedin"))    return "LinkedIn";
        return "La Bonne Alternance";
      })();
      out.push({
        id,
        title,
        company,
        location: item.job?.place?.city ?? item.company?.place?.city ?? "France",
        type:     detectType(title, item.romes?.[0]?.code),
        sport:    detectSport(title, company),
        postedAt: toISODate(item.job?.creationDate),
        source:   src,
        url:      item.job?.url ?? item.url ?? "https://labonnealternance.apprentissage.beta.gouv.fr",
      });
    }
  }
  return out;
}

/* ============================================================
   SOURCE 2 — INDEED FRANCE (RSS)
   Flux RSS publics, pas de clé requise
   ============================================================ */
function parseRSS(xml: string) {
  const items: Array<{ title: string; link: string; pubDate: string; desc: string }> = [];
  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) ?? [];
  for (const block of blocks) {
    const g = (tag: string) => {
      const cdata = block.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]>`, "i"))?.[1];
      if (cdata !== undefined) return cdata.trim();
      const plain = block.match(new RegExp(`<${tag}[^>]*>([^<]*)<\\/${tag}>`, "i"))?.[1];
      return (plain ?? "").trim();
    };
    const link = g("link") || g("guid") ||
      block.match(/<link[^/]* href="([^"]+)"/i)?.[1] ?? "";
    items.push({ title: g("title"), link, pubDate: g("pubDate"), desc: g("description") });
  }
  return items;
}

/** Extrait "Company" depuis le titre Indeed : "Titre - Company - Ville" */
function indeedCompany(title: string): { jobTitle: string; company: string; city: string } {
  const parts = title.split(/\s*[-–—|]\s*/);
  if (parts.length >= 3) {
    return { jobTitle: parts[0], company: parts[parts.length - 2], city: parts[parts.length - 1] };
  }
  if (parts.length === 2) {
    return { jobTitle: parts[0], company: parts[1], city: "" };
  }
  return { jobTitle: title, company: "Entreprise", city: "" };
}

async function fetchIndeed(): Promise<Offer[]> {
  const seen = new Set<string>();
  const out: Offer[] = [];
  const idx = { n: 0 };

  await Promise.all(
    QUERIES_SPORT.map(q =>
      safeFetch(
        `https://fr.indeed.com/rss?q=${encodeURIComponent(q)}&l=France&sort=date`,
        { next: { revalidate: 3600 } } as RequestInit
      )
        .then(r => r?.ok ? r.text() : null)
        .catch(() => null)
        .then(xml => {
          if (!xml) return;
          for (const item of parseRSS(xml)) {
            if (!item.title || !item.link) continue;
            // Déduplique par URL canonique
            const canon = item.link.replace(/&from=[^&]*/i, "").replace(/&newcount=[^&]*/i, "");
            if (seen.has(canon)) continue;
            seen.add(canon);
            const { jobTitle, company, city } = indeedCompany(item.title);
            out.push({
              id:       `indeed-${++idx.n}-${Date.now()}`,
              title:    jobTitle,
              company,
              location: city || "France",
              type:     detectType(jobTitle),
              sport:    detectSport(jobTitle, company),
              postedAt: toISODate(item.pubDate),
              source:   "Indeed",
              url:      item.link,
            });
          }
        })
    )
  );
  return out;
}

/* ============================================================
   SOURCE 3 — APEC
   API REST publique (sans authentification)
   ============================================================ */
interface APECOffer {
  numAnnonce?:    number;
  intitule?:      string;
  nomEntreprise?: string;
  lieu?:          string;
  datePublication?: string;
}

async function fetchAPEC(): Promise<Offer[]> {
  const APEC_URL =
    "https://www.apec.fr/cms/webservices/rechercheOffre/summary" +
    "?motsCles=alternance+communication+sport" +
    "&typeDeContrat=Alternance" +
    "&nombreResultats=50&page=0";

  const res = await safeFetch(APEC_URL, {
    headers: {
      "Accept": "application/json",
      "Referer": "https://www.apec.fr/",
    },
    next: { revalidate: 3600 },
  } as RequestInit);

  if (!res?.ok) return [];
  const data = await res.json().catch(() => null);
  if (!data) return [];

  const results: APECOffer[] = data?.results ?? data?.listeAnnonces ?? [];
  return results
    .filter(o => o.intitule)
    .map((o, i) => {
      const id      = String(o.numAnnonce ?? `apec-${i}`);
      const title   = o.intitule ?? "";
      const company = o.nomEntreprise ?? "Entreprise";
      return {
        id,
        title,
        company,
        location: o.lieu ?? "France",
        type:     detectType(title),
        sport:    detectSport(title, company),
        postedAt: toISODate(o.datePublication),
        source:   "APEC",
        url:      `https://www.apec.fr/candidat/recherche-emploi.html/emploi/detail-offre/${id}`,
      };
    });
}

/* ============================================================
   SOURCE 4 — FRANCE TRAVAIL (direct)
   API Offres d'emploi — endpoint public de recherche
   ============================================================ */
interface FTOffer {
  id?:             string;
  intitule?:       string;
  entreprise?:     { nom?: string };
  lieuTravail?:    { libelle?: string; commune?: string };
  dateCreation?:   string;
  origineOffre?:   { urlOrigine?: string };
}

async function fetchFranceTravail(): Promise<Offer[]> {
  // Point d'entrée public (sans OAuth) de recherche textuelle
  const FT_URL =
    "https://api.emploi-store.fr/partenaire/offresdemploi/v2/offres/search" +
    "?motsCles=alternance+communication+sport" +
    "&typeContrat=A" +          // A = Apprentissage/Alternance
    "&range=0-49";

  const res = await safeFetch(FT_URL, {
    next: { revalidate: 3600 },
  } as RequestInit);

  if (!res?.ok) return [];
  const data = await res.json().catch(() => null);
  if (!data) return [];

  const results: FTOffer[] = data?.resultats ?? [];
  return results
    .filter(o => o.intitule)
    .map(o => {
      const title   = o.intitule ?? "";
      const company = o.entreprise?.nom ?? "Entreprise";
      return {
        id:       o.id ?? `ft-${Math.random()}`,
        title,
        company,
        location: o.lieuTravail?.libelle ?? o.lieuTravail?.commune ?? "France",
        type:     detectType(title),
        sport:    detectSport(title, company),
        postedAt: toISODate(o.dateCreation),
        source:   "France Travail",
        url:      o.origineOffre?.urlOrigine ?? "https://candidat.francetravail.fr",
      };
    });
}

/* ============================================================
   HANDLER — agrège, déduplique, trie
   ============================================================ */
export async function GET() {
  const [r1, r2, r3, r4] = await Promise.allSettled([
    fetchLBA(),
    fetchIndeed(),
    fetchAPEC(),
    fetchFranceTravail(),
  ]);

  const all: Offer[] = [
    ...(r1.status === "fulfilled" ? r1.value : []),
    ...(r2.status === "fulfilled" ? r2.value : []),
    ...(r3.status === "fulfilled" ? r3.value : []),
    ...(r4.status === "fulfilled" ? r4.value : []),
  ];

  // Déduplique par (title + company) normalisé
  const seen = new Set<string>();
  const offers = all.filter(o => {
    const key = `${o.title.toLowerCase().slice(0, 40)}|${o.company.toLowerCase().slice(0, 20)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Tri : plus récent en premier
  offers.sort((a, b) => b.postedAt.localeCompare(a.postedAt));

  return NextResponse.json(offers, {
    headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=300" },
  });
}

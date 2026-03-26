"use client";

import { useMemo, useState } from "react";
import { mockOffers } from "@/lib/mockData";
import { OfferType, TrackedApplication, ApplicationStatus } from "@/lib/types";

const statusLabel: Record<ApplicationStatus, string> = {
  a_postuler: "À postuler",
  postule: "Postulé",
  entretien: "Entretien",
  refuse: "Refusé"
};

const offerPalette = ["var(--orange)", "var(--pink)", "var(--yellow)", "var(--green)"];
const STORAGE_KEY = "altrack-applications";

function useLocalApplications() {
  const [items, setItems] = useState<TrackedApplication[]>(() => {
    if (typeof window === "undefined") return [];

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as TrackedApplication[]) : [];
    } catch {
      return [];
    }
  });

  const save = (next: TrackedApplication[]) => {
    setItems(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  return { items, save };
}

export function OfferBoard() {
  const [typeFilter, setTypeFilter] = useState<"all" | OfferType>("all");
  const [search, setSearch] = useState("");
  const [selectedOfferId, setSelectedOfferId] = useState(mockOffers[0]?.id ?? "");
  const [status, setStatus] = useState<ApplicationStatus>("a_postuler");
  const [note, setNote] = useState("");
  const { items, save } = useLocalApplications();

  const filteredOffers = useMemo(() => {
    return mockOffers.filter((offer) => {
      const typeMatch = typeFilter === "all" || offer.type === typeFilter;
      const searchMatch = `${offer.title} ${offer.company} ${offer.sport}`.toLowerCase().includes(search.toLowerCase());
      return typeMatch && searchMatch;
    });
  }, [search, typeFilter]);

  const offersById = useMemo(() => Object.fromEntries(mockOffers.map((offer) => [offer.id, offer])), []);

  const upsertApplication = () => {
    if (!selectedOfferId) return;

    const existing = items.find((it) => it.offerId === selectedOfferId);
    const next: TrackedApplication[] = existing
      ? items.map((it) =>
          it.offerId === selectedOfferId
            ? { ...it, status, note, appliedAt: new Date().toISOString().slice(0, 10) }
            : it
        )
      : [
          {
            id: crypto.randomUUID(),
            offerId: selectedOfferId,
            status,
            note,
            appliedAt: new Date().toISOString().slice(0, 10)
          },
          ...items
        ];

    save(next);
    setNote("");
  };

  return (
    <main>
      <section className="hero">
        <div className="hero-top">
          <div>
            <h1>Altrack Sport Alternance</h1>
            <p>Trouve les meilleures offres en communication / événementiel sport et suis tes candidatures.</p>
          </div>
          <button className="cta">Nouvelle candidature</button>
        </div>
        <div className="chips">
          <span className="chip orange">Communication</span>
          <span className="chip pink">Événementiel</span>
          <span className="chip yellow">Football • Rugby • Basket</span>
          <span className="chip green">Suivi intelligent</span>
        </div>
      </section>

      <section className="layout">
        <div className="panel feed">
          <div className="panel filters">
            <h2 className="title">Flux d'offres</h2>
            <div className="form-grid">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher club, sport, métier..."
              />
              <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as "all" | OfferType)}>
                <option value="all">Tous les domaines</option>
                <option value="communication">Communication</option>
                <option value="event">Événementiel</option>
              </select>
            </div>
          </div>

          <div className="offers-grid">
            {filteredOffers.map((offer, index) => (
              <article
                key={offer.id}
                className="offer-card"
                style={{ background: offerPalette[index % offerPalette.length], color: offer.type === "event" ? "#111" : "#fff" }}
              >
                <h3>{offer.title}</h3>
                <div className="offer-meta">
                  <span>{offer.company} • {offer.location}</span>
                  <span className="badge">{offer.sport}</span>
                </div>
                <div className="offer-actions">
                  <a href={offer.url} target="_blank" rel="noreferrer">
                    <button className="btn dark">Voir l'offre</button>
                  </a>
                  <span className="badge">Publié le {offer.postedAt}</span>
                  <span className="badge">{offer.source}</span>
                </div>
              </article>
            ))}
          </div>
        </div>

        <aside className="panel tracker">
          <h2>Suivi candidatures</h2>
          <p style={{ color: "var(--muted)", marginTop: 6 }}>Ajoute une offre, définis un statut et garde des notes.</p>

          <div className="form-grid" style={{ marginTop: 8 }}>
            <select value={selectedOfferId} onChange={(e) => setSelectedOfferId(e.target.value)}>
              {mockOffers.map((offer) => (
                <option key={offer.id} value={offer.id}>
                  {offer.title} — {offer.company}
                </option>
              ))}
            </select>

            <select value={status} onChange={(e) => setStatus(e.target.value as ApplicationStatus)}>
              {Object.entries(statusLabel).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <textarea
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Note (date d'entretien, relance, contact RH...)"
            style={{ marginTop: 8 }}
          />

          <button className="btn dark" onClick={upsertApplication} style={{ marginTop: 10 }}>
            Enregistrer
          </button>

          <div className="app-list">
            {items.length === 0 ? (
              <p style={{ color: "var(--muted)" }}>Aucune candidature suivie pour le moment.</p>
            ) : (
              items.map((application) => {
                const offer = offersById[application.offerId];
                if (!offer) return null;

                return (
                  <div className="app-item" key={application.id}>
                    <strong>{offer.company}</strong>
                    <p style={{ margin: "6px 0" }}>{offer.title}</p>
                    <span className={`status s-${application.status}`}>{statusLabel[application.status]}</span>
                    {application.note ? <p style={{ margin: "8px 0 0", color: "var(--muted)" }}>{application.note}</p> : null}
                    <p style={{ margin: "6px 0 0", fontSize: 13 }}>Mise à jour : {application.appliedAt}</p>
                  </div>
                );
              })
            )}
          </div>
        </aside>
      </section>
    </main>
  );
}

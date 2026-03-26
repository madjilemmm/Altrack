"use client";

import { useMemo, useState } from "react";
import { mockOffers } from "@/lib/mockData";
import { Offer, OfferType, TrackedApplication, ApplicationStatus } from "@/lib/types";

const statusLabel: Record<ApplicationStatus, string> = {
  a_postuler: "À postuler",
  postule: "Postulé",
  entretien: "Entretien",
  refuse: "Refusé"
};

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
      const searchMatch = `${offer.title} ${offer.company} ${offer.sport}`
        .toLowerCase()
        .includes(search.toLowerCase());

      return typeMatch && searchMatch;
    });
  }, [search, typeFilter]);

  const offersById = useMemo(
    () => Object.fromEntries(mockOffers.map((offer) => [offer.id, offer])),
    []
  );

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

  const removeApplication = (id: string) => {
    save(items.filter((it) => it.id !== id));
  };

  return (
    <main>
      <div className="card" style={{ marginBottom: 20 }}>
        <h1>Altrack ⚽</h1>
        <p style={{ color: "var(--muted)", marginTop: -6 }}>
          Flux d'offres d'alternance en communication & événementiel sportif + suivi de candidatures.
        </p>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <h2>Filtrer les offres</h2>
        <div className="form-grid">
          <div>
            <label>Recherche</label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="club, métier, sport..."
            />
          </div>
          <div>
            <label>Domaine</label>
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as "all" | OfferType)}>
              <option value="all">Tous</option>
              <option value="communication">Communication</option>
              <option value="event">Événementiel</option>
            </select>
          </div>
        </div>
      </div>

      <section style={{ marginBottom: 20 }}>
        <h2>Flux d'offres ({filteredOffers.length})</h2>
        <div className="grid">
          {filteredOffers.map((offer) => (
            <OfferCard key={offer.id} offer={offer} tracked={items.some((it) => it.offerId === offer.id)} />
          ))}
        </div>
      </section>

      <section className="card" style={{ marginBottom: 20 }}>
        <h2>Suivi des candidatures</h2>
        <div className="form-grid">
          <div>
            <label>Offre</label>
            <select value={selectedOfferId} onChange={(e) => setSelectedOfferId(e.target.value)}>
              {mockOffers.map((offer) => (
                <option key={offer.id} value={offer.id}>
                  {offer.title} — {offer.company}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>Statut</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as ApplicationStatus)}>
              {Object.entries(statusLabel).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <label>Note personnelle</label>
          <textarea
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="ex: relance prévue mardi"
          />
        </div>
        <div style={{ marginTop: 12 }}>
          <button className="btn-primary" onClick={upsertApplication}>
            Enregistrer / Mettre à jour
          </button>
        </div>

        <div style={{ marginTop: 18 }}>
          {items.length === 0 ? (
            <p style={{ color: "var(--muted)" }}>Aucune candidature suivie pour le moment.</p>
          ) : (
            <div className="grid">
              {items.map((application) => {
                const offer = offersById[application.offerId];

                if (!offer) return null;

                return (
                  <div className="card" key={application.id}>
                    <h3 style={{ marginBottom: 6 }}>{offer.title}</h3>
                    <p style={{ margin: 0, color: "var(--muted)" }}>{offer.company}</p>
                    <p style={{ marginTop: 8 }}>
                      <span className={application.status === "refuse" ? "badge" : "badge badge-pending"}>
                        {statusLabel[application.status]}
                      </span>
                    </p>
                    <p style={{ fontSize: 14 }}>{application.note || "Aucune note"}</p>
                    <small>Dernière mise à jour : {application.appliedAt}</small>
                    <div style={{ marginTop: 10 }}>
                      <button className="btn-outline" onClick={() => removeApplication(application.id)}>
                        Supprimer
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function OfferCard({ offer, tracked }: { offer: Offer; tracked: boolean }) {
  return (
    <article className="card">
      <h3 style={{ marginBottom: 8 }}>{offer.title}</h3>
      <p style={{ margin: "0 0 8px", color: "var(--muted)" }}>
        {offer.company} • {offer.location}
      </p>
      <p style={{ margin: "0 0 8px" }}>
        <span className="badge badge-ok">{offer.sport}</span>
      </p>
      <p style={{ margin: "0 0 8px", fontSize: 14 }}>
        Source: <strong>{offer.source}</strong> — Publié le {offer.postedAt}
      </p>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <a href={offer.url} target="_blank" rel="noreferrer">
          <button className="btn-primary">Voir l'offre</button>
        </a>
        {tracked ? <span className="badge badge-pending">Suivi actif</span> : null}
      </div>
    </article>
  );
}

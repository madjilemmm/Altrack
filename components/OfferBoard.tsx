"use client";

import { useMemo, useState } from "react";
import { mockOffers } from "@/lib/mockData";
import { Offer, OfferType, TrackedApplication, ApplicationStatus } from "@/lib/types";

const STATUS_LABEL: Record<ApplicationStatus, string> = {
  a_postuler: "À postuler",
  postule:    "Postulé",
  entretien:  "Entretien",
  refuse:     "Refusé",
};

const STATUS_CLASS: Record<ApplicationStatus, string> = {
  a_postuler: "s-idle",
  postule:    "s-sent",
  entretien:  "s-active",
  refuse:     "s-dead",
};

const STORAGE_KEY = "altrack-v2";

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

  const filteredOffers = useMemo(() =>
    mockOffers.filter(o => {
      const typeOk = typeFilter === "all" || o.type === typeFilter;
      const q = search.toLowerCase();
      const textOk = [o.title, o.company, o.sport, o.location].join(" ").toLowerCase().includes(q);
      return typeOk && textOk;
    }),
    [search, typeFilter]
  );

  const offersById = useMemo(
    () => Object.fromEntries(mockOffers.map(o => [o.id, o])),
    []
  );

  const trackedSet = useMemo(() => new Set(items.map(it => it.offerId)), [items]);

  const upsert = () => {
    if (!selectedOfferId) return;
    const today = new Date().toISOString().slice(0, 10);
    const exists = items.find(it => it.offerId === selectedOfferId);
    const next = exists
      ? items.map(it =>
          it.offerId === selectedOfferId
            ? { ...it, status, note, appliedAt: today }
            : it
        )
      : [{ id: crypto.randomUUID(), offerId: selectedOfferId, status, note, appliedAt: today }, ...items];
    save(next);
    setNote("");
  };

  const remove = (id: string) => save(items.filter(it => it.id !== id));

  const interviewCount = items.filter(it => it.status === "entretien").length;
  const postedCount    = items.filter(it => it.status === "postule").length;

  return (
    <div className="app">
      {/* ── Sidebar ─────────────────────────────── */}
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
          </div>
          <div>
            <div className="brand-name">Altrack</div>
            <div className="brand-sub">Sport · Alternance</div>
          </div>
        </div>

        <div className="section-label">Menu</div>
        <nav className="nav">
          <div className="nav-item active">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
            </svg>
            Offres d'alternance
            <span className="nav-badge">{mockOffers.length}</span>
          </div>
        </nav>

        <div className="section-label" style={{ marginTop: 20 }}>Statistiques</div>
        <div className="stats-grid">
          <div className="stat-box">
            <div className="stat-val">{mockOffers.length}</div>
            <div className="stat-lbl">Offres</div>
          </div>
          <div className="stat-box">
            <div className="stat-val">{items.length}</div>
            <div className="stat-lbl">Suivies</div>
          </div>
          <div className="stat-box accent">
            <div className="stat-val">{interviewCount}</div>
            <div className="stat-lbl">Entretiens</div>
          </div>
          <div className="stat-box">
            <div className="stat-val">{postedCount}</div>
            <div className="stat-lbl">Postulé</div>
          </div>
        </div>

        <div className="sidebar-footer">
          <div className="footer-pulse">
            <span className="pulse-dot" />
            Données locales · en direct
          </div>
        </div>
      </aside>

      {/* ── Main ────────────────────────────────── */}
      <div className="main">
        {/* Topbar */}
        <header className="topbar">
          <div className="topbar-left">
            <h1 className="page-title">Flux d'offres</h1>
            <span className="count-tag">{filteredOffers.length}</span>
          </div>
          <div className="searchbar">
            <svg className="search-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <input
              className="search-input"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Poste, club, sport, ville..."
            />
          </div>
        </header>

        {/* Content */}
        <div className="content">
          {/* Filter bar */}
          <div className="filter-bar">
            {(["all", "communication", "event"] as const).map(f => (
              <button
                key={f}
                className={`filter-pill ${typeFilter === f ? "active" : ""}`}
                onClick={() => setTypeFilter(f)}
              >
                {f === "all" ? "Toutes les offres" : f === "communication" ? "Communication" : "Événementiel"}
              </button>
            ))}
          </div>

          {/* Board */}
          <div className="board">
            {/* Offer list */}
            <div className="offer-list">
              {filteredOffers.length === 0 ? (
                <div className="empty">
                  <div className="empty-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                      <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                    </svg>
                  </div>
                  <div className="empty-title">Aucune offre trouvée</div>
                  <div className="empty-sub">Essaie un autre mot-clé ou change le filtre.</div>
                </div>
              ) : (
                filteredOffers.map(offer => (
                  <OfferCard
                    key={offer.id}
                    offer={offer}
                    tracked={trackedSet.has(offer.id)}
                    onSelect={() => setSelectedOfferId(offer.id)}
                  />
                ))
              )}
            </div>

            {/* Tracker */}
            <aside className="tracker">
              <div className="tracker-header">
                <span className="tracker-title">Mes candidatures</span>
                <span className="tracker-count">{items.length}</span>
              </div>

              <div className="tracker-form">
                <div className="form-field">
                  <label className="form-label">Offre</label>
                  <select
                    className="form-select"
                    value={selectedOfferId}
                    onChange={e => setSelectedOfferId(e.target.value)}
                  >
                    {mockOffers.map(o => (
                      <option key={o.id} value={o.id}>{o.title} — {o.company}</option>
                    ))}
                  </select>
                </div>

                <div className="form-field">
                  <label className="form-label">Statut</label>
                  <select
                    className="form-select"
                    value={status}
                    onChange={e => setStatus(e.target.value as ApplicationStatus)}
                  >
                    {(Object.entries(STATUS_LABEL) as [ApplicationStatus, string][]).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </div>

                <div className="form-field">
                  <label className="form-label">Note</label>
                  <textarea
                    className="form-textarea"
                    rows={2}
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    placeholder="Entretien le…, contact RH…"
                  />
                </div>

                <button className="btn-save" onClick={upsert}>
                  Enregistrer
                </button>
              </div>

              <div className="app-list">
                {items.length === 0 ? (
                  <div className="app-empty">Aucune candidature suivie pour le moment.</div>
                ) : (
                  items.map(app => {
                    const offer = offersById[app.offerId];
                    if (!offer) return null;
                    return (
                      <div key={app.id} className="app-item">
                        <div className="app-item-row">
                          <div>
                            <div className="app-item-company">{offer.company}</div>
                            <div className="app-item-title">{offer.title}</div>
                          </div>
                          <button className="btn-del" onClick={() => remove(app.id)} aria-label="Supprimer">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                              <path d="M18 6 6 18M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                        <div className="app-item-meta">
                          <span className={`status-pill ${STATUS_CLASS[app.status]}`}>
                            {STATUS_LABEL[app.status]}
                          </span>
                          <span className="app-date">{app.appliedAt}</span>
                        </div>
                        {app.note && <div className="app-note">{app.note}</div>}
                      </div>
                    );
                  })
                )}
              </div>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}

function OfferCard({
  offer,
  tracked,
  onSelect,
}: {
  offer: Offer;
  tracked: boolean;
  onSelect: () => void;
}) {
  return (
    <div className={`offer-card ${tracked ? "tracked" : ""}`}>
      <div className={`offer-stripe ${offer.type === "communication" ? "stripe-comm" : "stripe-event"}`} />
      <div className="offer-body">
        <div className="offer-head">
          <div>
            <div className="offer-title">{offer.title}</div>
            <div className="offer-company">{offer.company} · {offer.location}</div>
          </div>
          <div className="offer-actions">
            {tracked && (
              <span className="tracked-badge">
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Suivi
              </span>
            )}
            <a href={offer.url} target="_blank" rel="noreferrer" className="btn-ext">
              Voir
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15,3 21,3 21,9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </a>
          </div>
        </div>
        <div className="offer-footer">
          <span className="tag tag-sport">{offer.sport}</span>
          <span className="tag tag-source">{offer.source}</span>
          <span className="tag tag-date">{offer.postedAt}</span>
          <button className="btn-track" onClick={onSelect}>
            {tracked ? "Modifier" : "+ Suivre"}
          </button>
        </div>
      </div>
    </div>
  );
}

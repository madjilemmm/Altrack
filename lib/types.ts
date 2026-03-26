export type OfferType = "communication" | "event";

export type Offer = {
  id: string;
  title: string;
  company: string;
  location: string;
  type: OfferType;
  sport: string;
  postedAt: string;
  source: string;
  url: string;
};

export type ApplicationStatus = "a_postuler" | "postule" | "entretien" | "refuse";

export type TrackedApplication = {
  id: string;
  offerId: string;
  note: string;
  status: ApplicationStatus;
  appliedAt: string;
};

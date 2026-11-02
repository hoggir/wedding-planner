export const EVENTS = {
  wedding: {
    label: "Pernikahan · Di rumah",
    noun: "pernikahan",
    file: "wedding.json",
    api: "/api/plan",
    scenarioLabel: "Di rumah",
    catalogCategory: "Di rumah",
    exportName: "pernikahan-rumah",
  },
  weddingHall: {
    label: "Pernikahan · Di gedung",
    noun: "pernikahan",
    file: "wedding-gedung.json",
    api: "/api/plan?event=wedding&scenario=hall",
    scenarioLabel: "Di gedung",
    catalogCategory: "Dengan venue",
    exportName: "pernikahan-gedung",
  },
  engagement: {
    label: "Lamaran",
    noun: "lamaran",
    file: "lamaran.json",
    api: "/api/plan?event=engagement",
    catalogCategory: "Lamaran",
    exportName: "lamaran",
  },
};

export function parseRoute(hash) {
  const parts = hash.replace(/^#/, "").split("/");
  return parts[0] === "gedung"
    ? { eventType: "weddingHall", page: parts[1] || "overview" }
    : parts[0] === "lamaran"
      ? { eventType: "engagement", page: parts[1] || "overview" }
      : { eventType: "wedding", page: parts[0] || "overview" };
}

export function planHref(eventType, page = "overview") {
  const prefix =
    eventType === "weddingHall"
      ? "gedung/"
      : eventType === "engagement"
        ? "lamaran/"
        : "";
  return `#${prefix}${page}`;
}

export function eventDetails(data) {
  return data.event || data.wedding;
}

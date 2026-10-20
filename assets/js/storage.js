/* =========================================================================
   Pohrana profila i rezultata u localStorage
   ========================================================================= */

const PROFILE_KEY = "efz_profile_v1";
const LEADERBOARD_KEY = "efz_leaderboard_v1";

export function loadProfile() {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) {
      return {
        subType: "own", // "own" (u svoje ime) ili "other" (opunomoćenik)
        oib: "11805144057",
        name: "",
        phone: "",
        email: "",
        category: "",
        price: "",
        subsidy: ""
      };
    }
    const data = JSON.parse(raw);
    return {
      subType: data.subType || "own",
      oib: (data.oib || "11805144057").trim(),
      name: (data.name || "").trim(),
      phone: (data.phone || "").trim(),
      email: (data.email || "").trim(),
      category: data.category || "",
      price: (data.price || "").trim(),
      subsidy: (data.subsidy || "").trim()
    };
  } catch (err) {
    console.error("Greška pri učitavanju profila:", err);
    return { subType: "own", oib: "11805144057", name: "", phone: "", email: "", category: "", price: "", subsidy: "" };
  }
}

export function saveProfile(profile) {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch (err) {
    console.error("Greška pri spremanju profila:", err);
  }
}

export function clearProfile() {
  try {
    localStorage.removeItem(PROFILE_KEY);
  } catch (err) {
    console.error(err);
  }
}

export function loadLeaderboard() {
  try {
    const raw = localStorage.getItem(LEADERBOARD_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch (err) {
    console.error("Greška pri učitavanju ljestvice:", err);
    return [];
  }
}

export function saveLeaderboard(list) {
  try {
    localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(list));
  } catch (err) {
    console.error("Greška pri spremanju ljestvice:", err);
  }
}

export function clearLeaderboard() {
  try {
    localStorage.removeItem(LEADERBOARD_KEY);
  } catch (err) {
    console.error(err);
  }
}

export function getBestTime(runs = loadLeaderboard()) {
  const validTimes = runs
    .filter(r => !r.dnf && typeof r.timeMs === "number" && r.timeMs > 0)
    .map(r => r.timeMs);
  if (validTimes.length === 0) return null;
  return Math.min(...validTimes);
}

export const PUBLICATION_THRESHOLD = 10;

export type Statistic = { label: string; count: number };

export function publishableGroups(groups: Statistic[]) {
  return groups
    .filter((group) => group.count >= PUBLICATION_THRESHOLD && group.label.trim() !== "")
    .sort((a, b) => a.label.localeCompare(b.label, "fr"));
}

export function validPetitionUrl(value: string) {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password
      && url.hostname.includes(".") && url.hostname !== "localhost";
  } catch {
    return false;
  }
}

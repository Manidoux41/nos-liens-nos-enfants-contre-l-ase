import { database } from "./db";
import { aseOptions, optionLabel, residenceOptions } from "./survey";
import { publishableGroups } from "./statistics";

export async function publicStatistics() {
  const db = database();
  return db.$transaction(async (transaction) => {
    const settings = await transaction.siteSettings.findUnique({ where: { id: 1 } });
    if (!settings?.statsPublished) return { published: false as const, residence: [], ase: [], jurisdictions: [], settings };
    const where = { status: "APPROVED" as const, expiresAt: { gt: new Date() } };
    const [residence, ase, jurisdictions] = await Promise.all([
      transaction.surveyResponse.groupBy({ by: ["residence"], where, _count: { _all: true } }),
      transaction.surveyResponse.groupBy({ by: ["ase"], where, _count: { _all: true } }),
      transaction.jurisdiction.findMany({
        select: { name: true, _count: { select: { responses: { where } } } },
      }),
    ]);
    return {
      published: true as const,
      residence: publishableGroups(residence.filter((group) => /^\d/.test(group.residence)).map((group) => ({ label: optionLabel(residenceOptions, group.residence), count: group._count._all }))),
      ase: publishableGroups(ase.filter((group) => /^\d/.test(group.ase)).map((group) => ({ label: optionLabel(aseOptions, group.ase), count: group._count._all }))),
      jurisdictions: publishableGroups(jurisdictions.map((group) => ({ label: group.name, count: group._count.responses }))),
      settings,
    };
  }, { isolationLevel: "RepeatableRead" });
}

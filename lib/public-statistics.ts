import { database } from "./db.ts";
import { aseOptions, optionLabel, residenceOptions, returnHomeOptions, CONSENT_VERSION } from "./survey.ts";
import { publishableGroups } from "./statistics.ts";
import { DEFAULT_POLL_ID, EMAIL_CONSENT_VERSION } from "./polls.ts";

export async function publicStatistics(pollId = DEFAULT_POLL_ID) {
  const db = database();
  return db.$transaction(async (transaction) => {
    const settings = await transaction.siteSettings.findUnique({ where: { id: 1 } });
    const poll = await transaction.poll.findUnique({ where: { id: pollId }, select: { status: true, resultsPublished: true } });
    if (!settings?.statsPublished || !poll?.resultsPublished || poll.status === "DRAFT") return { published: false as const, residence: [], ase: [], jurisdictions: [], years: [], returns: [], settings };
    const where = { pollId, status: "APPROVED" as const, expiresAt: { gt: new Date() } };
    const [residence, ase, jurisdictions, years, returns] = await Promise.all([
      transaction.surveyResponse.groupBy({ by: ["residence"], where, _count: { _all: true } }),
      transaction.surveyResponse.groupBy({ by: ["ase"], where, _count: { _all: true } }),
      transaction.jurisdiction.findMany({
        select: { name: true, _count: { select: { responses: { where } } } },
      }),
      transaction.surveyResponse.groupBy({ by: ["placementYear"], where: { ...where, consentVersion: { in: [CONSENT_VERSION, EMAIL_CONSENT_VERSION] }, placementYear: { not: null } }, _count: { _all: true } }),
      transaction.surveyResponse.groupBy({ by: ["returnHome"], where: { ...where, consentVersion: { in: [CONSENT_VERSION, EMAIL_CONSENT_VERSION] }, returnHome: { not: null, notIn: ["UNDISCLOSED", "NOT_APPLICABLE"] } }, _count: { _all: true } }),
    ]);
    return {
      published: true as const,
      residence: publishableGroups(residence.filter((group) => /^\d/.test(group.residence)).map((group) => ({ label: optionLabel(residenceOptions, group.residence), count: group._count._all }))),
      ase: publishableGroups(ase.filter((group) => /^\d/.test(group.ase)).map((group) => ({ label: optionLabel(aseOptions, group.ase), count: group._count._all }))),
      jurisdictions: publishableGroups(jurisdictions.map((group) => ({ label: group.name, count: group._count.responses }))),
      years: publishableGroups(years.map((group) => ({ label: String(group.placementYear), count: group._count._all }))),
      returns: publishableGroups(returns.map((group) => ({ label: optionLabel(returnHomeOptions, group.returnHome || ""), count: group._count._all }))),
      settings,
    };
  }, { isolationLevel: "RepeatableRead" });
}

import { Prisma } from "@prisma/client";
import { database } from "./db.ts";
import { deletionHash } from "./request-security.ts";
import type { SurveyAnswer } from "./survey";

export async function pruneExpiredAnswers() {
  const now = new Date();
  const result = await database().$transaction([
    database().surveyResponse.deleteMany({ where: { expiresAt: { lte: now } } }),
    database().session.deleteMany({ where: { expiresAt: { lte: now } } }),
    database().verification.deleteMany({ where: { expiresAt: { lte: now } } }),
    database().requestBucket.deleteMany({ where: { expiresAt: { lte: now } } }),
    database().rateLimit.deleteMany({ where: { lastRequest: { lt: BigInt(Date.now() - 86400_000) } } }),
    database().auditLog.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 365 * 86400_000) } } }),
  ]);
  return result[0].count;
}

export async function saveAnswer(answer: SurveyAnswer): Promise<"saved" | "exists"> {
  const data = {
    deletionHash: deletionHash(answer.id),
    residence: answer.residence,
    ase: answer.ase,
    placementYear: answer.placementYear ?? null,
    returnHome: answer.returnHome ?? null,
    judgeNames: answer.judgeNames.trim(),
    socialWorkerNames: answer.socialWorkerNames.trim(),
    jurisdictionReported: answer.jurisdiction.trim(),
    consentVersion: answer.consentVersion,
    privateConsent: answer.privateConsent,
    expiresAt: new Date(Date.now() + 365 * 86400_000),
  };
  try {
    await database().surveyResponse.create({ data });
    return "saved";
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
    const existing = await database().surveyResponse.findUnique({ where: { deletionHash: data.deletionHash } });
    if (existing && existing.expiresAt > new Date()
      && existing.residence === data.residence && existing.ase === data.ase
      && existing.placementYear === data.placementYear && existing.returnHome === data.returnHome
      && existing.judgeNames === data.judgeNames && existing.socialWorkerNames === data.socialWorkerNames
      && existing.jurisdictionReported === data.jurisdictionReported && existing.consentVersion === data.consentVersion
      && existing.privateConsent === data.privateConsent) return "exists";
    throw new Error("Submission identifier conflict.");
  }
}

export async function deleteAnswer(id: string) {
  await database().surveyResponse.deleteMany({ where: { deletionHash: deletionHash(id) } });
}

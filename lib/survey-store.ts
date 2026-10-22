import { Prisma } from "@prisma/client";
import { database } from "./db.ts";
import { deletionHash } from "./request-security.ts";
import type { SurveyAnswer } from "./survey";
import { timingSafeEqual } from "node:crypto";
import { surveyDigest, surveyEmailHash } from "./survey-email.ts";
import { SurveyError } from "./polls.ts";

export async function pruneExpiredAnswers() {
  const now = new Date();
  const result = await database().$transaction([
    database().surveyResponse.deleteMany({ where: { expiresAt: { lte: now } } }),
    database().session.deleteMany({ where: { expiresAt: { lte: now } } }),
    database().verification.deleteMany({ where: { expiresAt: { lte: now } } }),
    database().requestBucket.deleteMany({ where: { expiresAt: { lte: now } } }),
    database().rateLimit.deleteMany({ where: { lastRequest: { lt: BigInt(Date.now() - 86400_000) } } }),
    database().auditLog.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 365 * 86400_000) } } }),
    database().surveyEmailChallenge.deleteMany({ where: { expiresAt: { lte: now } } }),
  ]);
  return result[0].count;
}

function responseData(answer: SurveyAnswer) {
  return {
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
}

function sameAnswer(existing: Prisma.SurveyResponseGetPayload<object>, data: ReturnType<typeof responseData>) {
  return existing.expiresAt > new Date()
    && existing.residence === data.residence && existing.ase === data.ase
    && existing.placementYear === data.placementYear && existing.returnHome === data.returnHome
    && existing.judgeNames === data.judgeNames && existing.socialWorkerNames === data.socialWorkerNames
    && existing.jurisdictionReported === data.jurisdictionReported && existing.consentVersion === data.consentVersion
    && existing.privateConsent === data.privateConsent;
}

export async function saveAnswer(answer: SurveyAnswer): Promise<"saved" | "exists"> {
  const data = responseData(answer);
  try {
    await database().surveyResponse.create({ data });
    return "saved";
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
    const existing = await database().surveyResponse.findUnique({ where: { deletionHash: data.deletionHash } });
    if (existing && sameAnswer(existing, data)) return "exists";
    throw new Error("Submission identifier conflict.");
  }
}

export type VerifiedSubmission = { answer: SurveyAnswer; pollId: string; email: string; challengeId: string; code: string };

export async function saveVerifiedAnswer(submission: VerifiedSubmission): Promise<"saved" | "exists"> {
  const { answer, pollId, challengeId, code } = submission;
  const emailHash = surveyEmailHash(submission.email, pollId);
  const data = { ...responseData(answer), pollId, emailHash };
  try {
    const result = await database().$transaction(async (tx) => {
      // Coordinate writes with publication/closure updates until the response is committed.
      await tx.$queryRaw`SELECT id FROM "Poll" WHERE id = ${pollId}::uuid FOR SHARE`;
      const poll = await tx.poll.findUnique({ where: { id: pollId } });
      if (!poll || poll.status !== "PUBLISHED") return "closed" as const;
      const existing = await tx.surveyResponse.findUnique({ where: { deletionHash: data.deletionHash } });
      if (existing) return existing.pollId === pollId && existing.emailHash === emailHash && sameAnswer(existing, data) ? "exists" as const : "conflict" as const;
      const now = new Date();
      const attempt = await tx.surveyEmailChallenge.updateMany({
        where: { id: challengeId, pollId, emailHash, attempts: { lt: 5 }, expiresAt: { gt: now } },
        data: { attempts: { increment: 1 } },
      });
      if (!attempt.count) return "code" as const;
      const challenge = await tx.surveyEmailChallenge.findUniqueOrThrow({ where: { id: challengeId } });
      const expected = surveyDigest(`code:${challengeId}:${code}`);
      if (!timingSafeEqual(Buffer.from(challenge.codeHash, "hex"), Buffer.from(expected, "hex"))) return "code" as const;
      await tx.surveyResponse.deleteMany({ where: { pollId, emailHash, expiresAt: { lte: now } } });
      const duplicate = await tx.surveyResponse.count({ where: { pollId, emailHash } });
      if (duplicate) return "duplicate" as const;
      await tx.surveyResponse.create({ data });
      await tx.surveyEmailChallenge.delete({ where: { id: challengeId } });
      return "saved" as const;
    });
    if (result === "saved" || result === "exists") return result;
    if (result === "closed") throw new SurveyError(409, "Ce sondage n’accepte pas de nouvelles réponses.");
    if (result === "duplicate") throw new SurveyError(409, "Cette adresse a déjà répondu à ce sondage. Retirez la réponse précédente avec son code privé pour pouvoir participer à nouveau.");
    if (result === "conflict") throw new SurveyError(409, "Ce code de réponse a déjà été utilisé pour un autre contenu.");
    throw new SurveyError(400, "Code incorrect, expiré ou déjà utilisé. Après cinq tentatives, demandez un nouveau code.");
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2002", "P2034"].includes(error.code)) {
      throw new SurveyError(409, "Une participation est déjà enregistrée ou en cours. Réessayez avec la même réponse et le même code privé.");
    }
    throw error;
  }
}

export async function deleteAnswer(id: string) {
  await database().$transaction(async (tx) => {
    const response = await tx.surveyResponse.findUnique({ where: { deletionHash: deletionHash(id) } });
    if (response?.emailHash) await tx.surveyEmailChallenge.deleteMany({ where: { pollId: response.pollId, emailHash: response.emailHash } });
    await tx.surveyResponse.deleteMany({ where: { deletionHash: deletionHash(id) } });
  });
}

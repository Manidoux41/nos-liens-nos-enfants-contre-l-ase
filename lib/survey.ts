import { EMAIL_CONSENT_VERSION } from "./polls.ts";

export const departments = [
  ["01", "Ain"], ["02", "Aisne"], ["03", "Allier"], ["04", "Alpes-de-Haute-Provence"],
  ["05", "Hautes-Alpes"], ["06", "Alpes-Maritimes"], ["07", "Ardèche"], ["08", "Ardennes"],
  ["09", "Ariège"], ["10", "Aube"], ["11", "Aude"], ["12", "Aveyron"], ["13", "Bouches-du-Rhône"],
  ["14", "Calvados"], ["15", "Cantal"], ["16", "Charente"], ["17", "Charente-Maritime"],
  ["18", "Cher"], ["19", "Corrèze"], ["2A", "Corse-du-Sud"], ["2B", "Haute-Corse"],
  ["21", "Côte-d’Or"], ["22", "Côtes-d’Armor"], ["23", "Creuse"], ["24", "Dordogne"],
  ["25", "Doubs"], ["26", "Drôme"], ["27", "Eure"], ["28", "Eure-et-Loir"],
  ["29", "Finistère"], ["30", "Gard"], ["31", "Haute-Garonne"], ["32", "Gers"],
  ["33", "Gironde"], ["34", "Hérault"], ["35", "Ille-et-Vilaine"], ["36", "Indre"],
  ["37", "Indre-et-Loire"], ["38", "Isère"], ["39", "Jura"], ["40", "Landes"],
  ["41", "Loir-et-Cher"], ["42", "Loire"], ["43", "Haute-Loire"], ["44", "Loire-Atlantique"],
  ["45", "Loiret"], ["46", "Lot"], ["47", "Lot-et-Garonne"], ["48", "Lozère"],
  ["49", "Maine-et-Loire"], ["50", "Manche"], ["51", "Marne"], ["52", "Haute-Marne"],
  ["53", "Mayenne"], ["54", "Meurthe-et-Moselle"], ["55", "Meuse"], ["56", "Morbihan"],
  ["57", "Moselle"], ["58", "Nièvre"], ["59", "Nord"], ["60", "Oise"], ["61", "Orne"],
  ["62", "Pas-de-Calais"], ["63", "Puy-de-Dôme"], ["64", "Pyrénées-Atlantiques"],
  ["65", "Hautes-Pyrénées"], ["66", "Pyrénées-Orientales"], ["67", "Bas-Rhin"],
  ["68", "Haut-Rhin"], ["69", "Rhône / Métropole de Lyon"], ["70", "Haute-Saône"],
  ["71", "Saône-et-Loire"], ["72", "Sarthe"], ["73", "Savoie"], ["74", "Haute-Savoie"],
  ["75", "Paris"], ["76", "Seine-Maritime"], ["77", "Seine-et-Marne"], ["78", "Yvelines"],
  ["79", "Deux-Sèvres"], ["80", "Somme"], ["81", "Tarn"], ["82", "Tarn-et-Garonne"],
  ["83", "Var"], ["84", "Vaucluse"], ["85", "Vendée"], ["86", "Vienne"],
  ["87", "Haute-Vienne"], ["88", "Vosges"], ["89", "Yonne"], ["90", "Territoire de Belfort"],
  ["91", "Essonne"], ["92", "Hauts-de-Seine"], ["93", "Seine-Saint-Denis"],
  ["94", "Val-de-Marne"], ["95", "Val-d’Oise"], ["971", "Guadeloupe"], ["972", "Martinique"],
  ["973", "Guyane"], ["974", "La Réunion"], ["976", "Mayotte"],
] as const;

export const residenceOptions: readonly (readonly [string, string])[] = [
  ...departments,
  ["OTHER", "Autre territoire / hors de France"],
  ["UNDISCLOSED", "Je préfère ne pas répondre"],
];

export const aseOptions: readonly (readonly [string, string])[] = [
  ...departments,
  ["OTHER", "Autre territoire"],
  ["UNKNOWN", "Je ne sais pas"],
  ["NONE", "Je ne dépends pas d’une ASE"],
  ["UNDISCLOSED", "Je préfère ne pas répondre"],
];

export const returnHomeOptions = [
  ["ALL", "Tous mes enfants concernés sont revenus au foyer"],
  ["SOME", "Certains sont revenus, d’autres non"],
  ["NONE", "Aucun n’est revenu au foyer"],
  ["NOT_APPLICABLE", "Je ne suis pas concerné par un placement"],
  ["UNDISCLOSED", "Je préfère ne pas répondre"],
] as const;
export type ReturnHome = typeof returnHomeOptions[number][0];
export const MIN_PLACEMENT_YEAR = 1900;
export const LEGACY_CONSENT_VERSION = "2026-10-22-statistiques-v2";
export const CONSENT_VERSION = "2026-10-22-parcours-v3";
export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export type SurveyAnswer = {
  id: string;
  residence: string;
  ase: string;
  placementYear?: number | null;
  returnHome?: ReturnHome | null;
  judgeNames: string;
  socialWorkerNames: string;
  jurisdiction: string;
  privateConsent: boolean;
  consent: true;
  consentVersion: typeof CONSENT_VERSION | typeof LEGACY_CONSENT_VERSION | typeof EMAIL_CONSENT_VERSION;
};

export function isSurveyAnswer(value: unknown): value is SurveyAnswer {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort().join(",");
  const legacy = record.consentVersion === LEGACY_CONSENT_VERSION
    && keys === "ase,consent,consentVersion,id,judgeNames,jurisdiction,privateConsent,residence,socialWorkerNames";
  const current = (record.consentVersion === CONSENT_VERSION || record.consentVersion === EMAIL_CONSENT_VERSION)
    && keys === "ase,consent,consentVersion,id,judgeNames,jurisdiction,placementYear,privateConsent,residence,returnHome,socialWorkerNames"
    && (record.placementYear === null || (typeof record.placementYear === "number"
      && Number.isInteger(record.placementYear) && record.placementYear >= MIN_PLACEMENT_YEAR
      && record.placementYear <= new Date().getUTCFullYear()))
    && (record.returnHome === null || returnHomeOptions.some(([code]) => code === record.returnHome))
    && !(record.returnHome === "NOT_APPLICABLE" && record.placementYear !== null);
  return (legacy || current)
    && typeof record.id === "string" && UUID_PATTERN.test(record.id)
    && residenceOptions.some(([code]) => code === record.residence)
    && aseOptions.some(([code]) => code === record.ase)
    && validPrivateText(record.judgeNames, 600)
    && validPrivateText(record.socialWorkerNames, 600)
    && validPrivateText(record.jurisdiction, 200)
    && typeof record.privateConsent === "boolean"
    && (!(String(record.judgeNames).trim() || String(record.socialWorkerNames).trim()) || record.privateConsent === true)
    && record.consent === true;
}

function validPrivateText(value: unknown, max: number) {
  return typeof value === "string" && value.length <= max && !/[\u0000-\u0008\u000b-\u001f\u007f<>]/.test(value);
}

export function optionLabel(options: readonly (readonly [string, string])[], code: string) {
  const option = options.find(([value]) => value === code);
  return option ? `${option[0].match(/^\d/) ? `${option[0]} — ` : ""}${option[1]}` : "";
}

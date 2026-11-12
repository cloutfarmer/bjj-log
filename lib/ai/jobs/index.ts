import { cleanNote } from "./cleanNote";
import { dailyBrief } from "./dailyBrief";
import { monthlyRecap } from "./monthlyRecap";
import { tagCleanup } from "./tagCleanup";
import { tagNote } from "./tagNote";
import { weeklySummary } from "./weeklySummary";

export const JOBS = { tagNote, cleanNote, tagCleanup, dailyBrief, weeklySummary, monthlyRecap } as const;

export type { TagNoteArgs, TagNoteOut } from "./tagNote";
export type { CleanNoteArgs, CleanNoteOut } from "./cleanNote";
export type { TagCleanupArgs, TagCleanupOut } from "./tagCleanup";
export type { DailyBriefArgs, DailyBriefOut } from "./dailyBrief";
export type { WeeklySummaryArgs, WeeklySummaryOut } from "./weeklySummary";
export type { MonthlyRecapArgs, MonthlyRecapOut } from "./monthlyRecap";
export { tagNote, cleanNote, tagCleanup, dailyBrief, weeklySummary, monthlyRecap };

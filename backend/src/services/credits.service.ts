import { getUserById, updateUserCredits } from "./userStore";

export const DEFAULT_COST = 10;

export function ensureCredits(userId: string, cost = DEFAULT_COST): void {
  const user = getUserById(userId);
  if (!user) {
    throw new Error("User not found.");
  }
  if (user.creditsBalance < cost) {
    throw new Error("Insufficient credits.");
  }
}

export function deductCredits(userId: string, cost = DEFAULT_COST): void {
  const user = getUserById(userId);
  if (!user) {
    throw new Error("User not found.");
  }
  const next = Math.max(0, user.creditsBalance - cost);
  updateUserCredits(userId, next);
}

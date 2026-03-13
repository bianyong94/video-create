export type UserRecord = {
  id: string;
  email: string;
  subscription: "FREE" | "PRO" | "ENTERPRISE";
  creditsBalance: number;
};

const users = new Map<string, UserRecord>();

users.set("demo-user", {
  id: "demo-user",
  email: "demo@example.com",
  subscription: "FREE",
  creditsBalance: 100,
});

export function getUserById(userId: string): UserRecord | null {
  return users.get(userId) ?? null;
}

export function updateUserCredits(userId: string, nextBalance: number): void {
  const user = users.get(userId);
  if (!user) return;
  users.set(userId, { ...user, creditsBalance: nextBalance });
}

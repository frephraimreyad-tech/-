/**
 * Utility for calculating team XP based on attendance percentage:
 * - If attendance rate >= 60%, returns 100 XP fixed.
 * - If attendance rate < 60%, returns XP equal to the attendance rate percentage.
 */

export function calculateTeamXP(totalMembers: number, presentMembers: number): { percentage: number; xp: number } {
  if (!totalMembers || totalMembers <= 0) {
    return { percentage: 0, xp: 0 };
  }

  // Explicit float division: multiply by 1.0 before dividing by total
  const ratio = (presentMembers * 1.0) / totalMembers;
  const percentage = Math.round(ratio * 100);
  const xp = percentage >= 60 ? 100 : percentage;

  console.log(`[calculateTeamXP] present: ${presentMembers}, total: ${totalMembers}, percentage: ${percentage}%, xp: ${xp}`);
  return { percentage, xp };
}

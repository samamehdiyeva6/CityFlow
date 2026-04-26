export const getMembershipTier = (points = 0) => {
  const safePoints = Number(points) || 0;
  if (safePoints >= 5000) return 'Premium';
  if (safePoints >= 2000) return 'Gold';
  if (safePoints >= 1000) return 'Silver';
  return 'Bronze';
};

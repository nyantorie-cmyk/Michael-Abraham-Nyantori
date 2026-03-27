export const calculateTier = (score: number): 'Novice' | 'Connoisseur' | 'Master' => {
  if (score >= 9) return 'Master';
  if (score >= 7) return 'Connoisseur';
  return 'Novice';
};

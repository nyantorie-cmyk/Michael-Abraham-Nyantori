import { UserProfile } from './types';

export const MOCK_USER: UserProfile = {
  id: 'u1',
  name: 'Julian Savvy',
  type: 'Individual',
  email: 'julian@example.com',
  phone: '+1 (555) 0123',
  loyaltyScore: 8,
  activityHistory: [
    { id: 'a1', type: 'Event', title: 'Napa Valley Tasting', date: '2024-02-15', points: 2 },
    { id: 'a2', type: 'Purchase', title: 'Savvy Reserve 2019', date: '2024-02-10', points: 1 },
    { id: 'a3', type: 'Referral', title: 'Referred Marcus', date: '2024-01-20', points: 3 },
  ]
};

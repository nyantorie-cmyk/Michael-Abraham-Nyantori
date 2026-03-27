export type ProfileType = 'Individual' | 'Business';

export interface CommunityActivity {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  type: 'like' | 'comment' | 'share';
  content: string;
  timestamp: string;
  photoUrl?: string;
}

export interface UserPhoto {
  id: string;
  url: string;
  caption: string;
  date: string;
  tag?: {
    type: 'Shop' | 'Hotel' | 'Event';
    name: string;
  };
}

export interface CommunityMember {
  id: string;
  name: string;
  score: number;
  avatar: string;
  tier: string;
  photos?: UserPhoto[];
}

export interface Notification {
  id: string;
  userId: string; // Recipient
  type: 'EventAnnouncement' | 'FriendRequest' | 'LoyaltyUpdate' | 'SpecialOffer' | 'General' | 'FriendUpdate';
  title: string;
  message: string;
  timestamp: string;
  isRead: boolean;
  link?: string;
  metadata?: any;
}

export interface UserProfile {
  id: string;
  name: string;
  type: ProfileType;
  email: string;
  phone: string;
  city?: string;
  loyaltyScore: number; // 1-10
  activityHistory: Activity[];
  photos?: UserPhoto[];
  friends?: string[]; // IDs of community members
  businessName?: string;
  businessLocation?: string;
  membershipId?: string;
}

export interface Activity {
  id: string;
  type: 'Event' | 'Purchase' | 'Referral';
  title: string;
  date: string;
  points: number;
}

export interface WineEvent {
  id: string;
  title: string;
  date: string;
  time?: string;
  location: string;
  venue?: string;
  hosts?: string[];
  specialGuest?: string;
  description: string;
  image: string;
  isPast: boolean;
  price?: string | number;
  attendeeCount?: number;
}

export interface StoreLocation {
  id: string;
  name: string;
  type: 'Liquor Store' | 'Social Hall' | 'Supermarket' | 'Wholesale' | 'Bar and Lounge' | 'Hotel';
  address: string;
  lat: number;
  lng: number;
  phone: string;
}

export interface WineNews {
  id: string;
  title: string;
  summary: string;
  content: string;
  date: string;
  category: string;
  image: string;
  source: string;
  comments: Comment[];
  views?: number;
  commentCount?: number;
}

export interface Comment {
  id: string;
  userName: string;
  userAvatar: string;
  text: string;
  date: string;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
  category: string;
  stock: number;
  rating?: number;
  reviews?: number;
  options?: string[];
}

export interface CartItem extends Product {
  quantity: number;
  selectedOption?: string;
}

export interface Ticket {
  id: string;
  userId: string;
  eventId: string;
  eventTitle: string;
  eventDate: string;
  eventTime: string;
  eventLocation: string;
  eventVenue: string;
  qrCode: string;
  purchaseDate: string;
  paymentStatus: 'pending' | 'paid';
  price?: number;
}

export type OrderStatus = 'pending' | 'packed' | 'on transit' | 'delivered' | 'cancelled';

export interface Order {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  items: CartItem[];
  total: number;
  status: OrderStatus;
  createdAt: string;
  shippingAddress: string;
  phone: string;
}

export interface QRCode {
  id: string;
  code: string;
  title: string;
  description?: string;
  type: 'Points' | 'Discount' | 'Reward';
  value?: number;
  isActive: boolean;
  usageLimit?: number;
  usageCount?: number;
  expiryDate?: any;
  createdAt: any;
}

export interface QRClaim {
  id: string;
  qrId: string;
  userId: string;
  claimedAt: any;
  pointsAwarded?: number;
}

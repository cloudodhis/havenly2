export interface PublicProfile {
  uid: string;
  name: string;
  photoUrl?: string;
  businessName?: string;
  businessDescription?: string;
  website?: string;
  contactEmail?: string;
  contactPhone?: string;
  createdAt: string;
}

export interface Property {
  id: string;
  title: string;
  location: string;
  lat: number;
  lng: number;
  price: number;
  currency: string;
  rating?: number;
  imageUrl: string;
  imageUrls?: string[];
  beds: number;
  baths: number;
  guests: number;
  sqft: number;
  securityDeposit?: number;
  firstMonthRent?: number;
  type: string;
  listingType: 'rent' | 'sale';
  amenities: string[];
  isAIRecommended?: boolean;
  isFeatured?: boolean;
  priority?: 'Top' | 'High' | 'Normal';
  promotionType?: 'Free' | 'Paid';
  featuredUntil?: string;
  status: 'pending' | 'active' | 'reported' | 'expired' | 'removed' | 'changes_requested';
  landlordId: string;
  createdAt: string;
  moderationNotes?: string;
  fraudIndicators?: string[];
}

export interface Review {
  id: string;
  reviewerId: string;
  reviewerName: string;
  targetId: string; // Property ID, Landlord ID, or Renter ID
  targetName: string;
  targetType: 'property' | 'landlord' | 'renter';
  rating: number;
  comment: string;
  status: 'approved' | 'flagged' | 'pending' | 'removed';
  createdAt: string;
  flagReason?: string;
  flaggedBy?: string;
  adminNotes?: string;
}

export interface Report {
  id: string;
  type: 'listing' | 'landlord' | 'renter' | 'message';
  reportedItemId: string;
  reportedItemName: string;
  reportedBy: string;
  reportedByName: string;
  reason: string;
  status: 'pending' | 'review' | 'resolved' | 'dismissed';
  priority: 'low' | 'medium' | 'high';
  createdAt: string;
  evidence?: string[];
  notes?: string;
}

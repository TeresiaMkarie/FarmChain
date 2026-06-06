export type UserRole = 'Farmer' | 'Buyer' | 'Admin';

export interface UserRecord {
  address: string;
  role: UserRole;
  metadataHash: string;
  registeredAt: number;
  active: boolean;
}

export interface Product {
  id: number;
  onChainId?: number;
  farmerPk: string;
  name: string;
  category: 'grain' | 'vegetable' | 'fruit' | 'dairy' | 'livestock';
  quantity: number;
  unit: 'kg' | 'ton' | 'piece' | 'liter';
  priceXlm: number;
  imageCids: string[];
  metadataHash?: string;
  description?: string;
  status: 'pending' | 'active' | 'sold' | 'cancelled';
  createdAt: string;
  farmerName?: string;
  location?: string;
}

export type OrderStatus =
  | 'created'
  | 'funded'
  | 'shipped'
  | 'completed'
  | 'disputed'
  | 'refunded'
  | 'resolved'
  | 'cancelled';

export interface OrderDispute {
  id: string;
  raisedBy: string;
  reason: string | null;
  status: 'open' | 'resolved';
  resolution: string | null;
  createdAt: string;
}

export interface Order {
  id: string;
  productId: string;
  onChainOrderId?: number;
  escrowId?: string;
  farmerPk: string;
  buyerPk: string;
  amount: number;
  quantity?: number;
  deliveryAddress?: string;
  status: OrderStatus;
  trackingHash?: string;
  trackingInfo?: string;
  txHash?: string;
  createdAt: string;
  updatedAt: string;
  product?: Product;
  productName?: string;
  imageCids?: string[];
  dispute?: OrderDispute | null;
}

export interface Receipt {
  id: string;
  orderId: string;
  txHash: string | null;
  createdAt: string;
  buyerPk: string;
  farmerPk: string;
  amount: number;
  quantity: number;
  productName: string | null;
  unit: string | null;
  category: string | null;
}

export interface Dispute {
  id: string;
  orderId: string;
  raisedBy: string;
  reason: string | null;
  status: 'open' | 'resolved';
  resolution: string | null;
  createdAt: string;
  productId: string;
  buyerPk: string;
  farmerPk: string;
  amount: number;
  productName: string | null;
}

export interface ApiUser {
  id: string;
  publicKey: string;
  role: UserRole;
  name: string;
  phone?: string;
  location?: string;
  kycStatus: 'pending' | 'verified' | 'rejected';
  chainVerified: boolean;
  createdAt: string;
}

export interface UserProfile {
  public_key: string;
  role: string;
  name: string;
  phone: string | null;
  email: string | null;
  avatar_url: string | null;
  location: string | null;
  country: string | null;
  county: string | null;
  city: string | null;
  address_line: string | null;
  latitude: number | null;
  longitude: number | null;
  payout_wallet: string | null;
  preferred_currency: string;
  preferred_language: string;
  kyc_status: string;
  chain_verified: boolean;
}

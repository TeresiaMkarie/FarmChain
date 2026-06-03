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
  status: 'pending' | 'active' | 'sold' | 'cancelled';
  createdAt: string;
  farmerName?: string;
  location?: string;
}

export type OrderStatus =
  | 'created'
  | 'funded'
  | 'shipped'
  | 'delivered'
  | 'completed'
  | 'disputed'
  | 'refunded';

export interface Order {
  id: string;
  productId: string;
  onChainOrderId?: number;
  escrowId?: string;
  farmerPk: string;
  buyerPk: string;
  amount: number;
  status: OrderStatus;
  trackingHash?: string;
  trackingInfo?: string;
  txHash?: string;
  createdAt: string;
  updatedAt: string;
  product?: Product;
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

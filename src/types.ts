export interface Settings {
  basePrice: number;
  stepPrice: number;
  premiumPrice: number;
  vipPassword?: string;
  aboutUs: string;
  bankAccount: string;
  contactEmail: string;
  orderCount?: number;
}

export interface Order {
  id: number;
  size: string;
  price: number;
  currency: string;
  isPremium: boolean;
  isVip?: boolean;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  photoName?: string;
  photoPath?: string;
  timestamp: string;
}

export type Currency = 'NOK' | 'EUR' | 'USD' | 'UAH';

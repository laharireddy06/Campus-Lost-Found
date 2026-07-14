export const CATEGORIES = [
  "Electronics",
  "ID Cards",
  "Wallets",
  "Keys",
  "Books",
  "Bags",
  "Clothing",
  "Other",
] as const;

export const ITEM_TYPES = ["Lost", "Found"] as const;
export const PRIORITIES = ["Normal", "Urgent"] as const;
export const STATUSES = ["Active", "Reunited"] as const;

export type Category = (typeof CATEGORIES)[number];
export type ItemType = (typeof ITEM_TYPES)[number];
export type Priority = (typeof PRIORITIES)[number];
export type Status = (typeof STATUSES)[number];

export interface ItemData {
  id: number;
  user_id: string;
  title: string;
  description?: string;
  category: string;
  type: string;
  images?: string;
  location?: string;
  status: string;
  priority: string;
  contact_info?: string;
  reunited_at?: string;
  reunited_by?: string;
  created_at?: string;
  updated_at?: string;
}
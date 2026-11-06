export type Category = 'salumi' | 'formaggi' | 'verdure' | 'salse'
export type Tab = Category | 'altro'

export const CATEGORIES: { key: Tab; label: string }[] = [
  { key: 'salumi', label: 'Salumi' },
  { key: 'formaggi', label: 'Formaggi' },
  { key: 'verdure', label: 'Verdure' },
  { key: 'salse', label: 'Salse' },
  { key: 'altro', label: 'Altro' },
]

export interface Player {
  id: string
  first_name: string
  last_name: string
}

export interface EventRow {
  id: string
  event_date: string
  deadline: string
  closed: boolean
  created_at: string
}

export interface CatalogItem {
  id: string
  name: string
  name_key: string
  category: Category
  archived: boolean
  created_at: string
}

export interface Ingredient {
  id: string
  event_id: string
  catalog_id?: string | null
  category: Category
  name: string
  sort: number
}

export interface OrderItem {
  id: string
  name: string
  category: Category
}

export interface Order {
  id: string
  event_id: string
  player_id: string
  items: OrderItem[]
  extra: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

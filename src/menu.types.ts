export interface MenuItem {
  id: string
  name: string
  description?: string
  pricePrefix?: string
  price: string
  hidden?: boolean
}

export interface MenuCategory {
  id: string
  title: string
  items: MenuItem[]
}

export interface MenuData {
  id: 'en' | 'el'
  language: string
  restaurant: string
  subtitle?: string
  note?: string
  currency: string
  categories: MenuCategory[]
}

import { create } from 'zustand'

export const useCartStore = create((set) => ({
  items: [],
  clearCart: () => set({ items: [] }),
  setCartItems: (items) => set({ items }),
}))

import { create } from 'zustand'

export const useNotificationStore = create((set) => ({
  notifications: [],
  clearNotifications: () => set({ notifications: [] }),
  setNotifications: (notifications) => set({ notifications }),
}))

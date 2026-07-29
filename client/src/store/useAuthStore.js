import { create } from 'zustand'

export const useAuthStore = create((set) => ({
  accessToken: null,
  isAuthenticated: false,
  role: null,
  user: null,
  resetAuth: () =>
    set({
      accessToken: null,
      isAuthenticated: false,
      role: null,
      user: null,
    }),
  setAuthSnapshot: ({ accessToken, role, user }) =>
    set({
      accessToken,
      isAuthenticated: Boolean(accessToken && user),
      role,
      user,
    }),
}))

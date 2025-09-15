import { configureStore } from '@reduxjs/toolkit'
import { assetsApi } from './state/assetsApi'

export const store = configureStore({
  reducer: {
    [assetsApi.reducerPath]: assetsApi.reducer,
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(assetsApi.middleware)
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch

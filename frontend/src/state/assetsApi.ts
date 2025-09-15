import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'

export interface Asset {
  id: string
  name: string
  type: 'building' | 'road' | 'poi'
  height?: number | null
  centroid: [number, number]
}

export const assetsApi = createApi({
  reducerPath: 'assetsApi',
  baseQuery: fetchBaseQuery({ baseUrl: 'http://localhost:4000/api/' }),
  endpoints: (builder) => ({
    getAssets: builder.query<{ items: Asset[]; total: number }, { bbox?: string; type?: string; minHeight?: number; maxHeight?: number; q?: string; limit?: number; offset?: number }>({
      query: (params) => ({ url: 'assets', params }),
    }),
    getAssetById: builder.query<Asset, string>({
      query: (id) => `assets/${id}`,
    })
  })
})

export const { useGetAssetsQuery, useGetAssetByIdQuery } = assetsApi

export type LonLat = [number, number];

export interface Asset {
  id: string;
  name: string;
  type: "building" | "road" | "poi";
  height?: number | null;
  centroid: LonLat;
}

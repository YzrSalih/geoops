import React, { useEffect, useMemo, useRef, useState } from 'react'
import Map from 'ol/Map'
import View from 'ol/View'
import TileLayer from 'ol/layer/Tile'
import VectorLayer from 'ol/layer/Vector'
import VectorSource from 'ol/source/Vector'
import OSM from 'ol/source/OSM'
import { fromLonLat, toLonLat } from 'ol/proj'
import { useGetAssetsQuery, useGetAssetByIdQuery } from '../state/assetsApi'
import { bbox as olBbox } from 'ol/loadingstrategy'
import { Style, Circle as CircleStyle, Fill, Stroke } from 'ol/style'
import Feature from 'ol/Feature'
import Point from 'ol/geom/Point'
import { defaults as defaultControls } from 'ol/control'

export default function MapView() {
  const mapDiv = useRef<HTMLDivElement | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  // Styles (halo + inner dot)
  const baseStyles = useMemo(() => [
    new Style({ image: new CircleStyle({ radius: 8, fill: new Fill({ color: 'rgba(255,255,255,0.85)' }) }) }),
    new Style({ image: new CircleStyle({ radius: 5, fill: new Fill({ color: '#2563eb' }), stroke: new Stroke({ color: '#1e3a8a', width: 1.5 }) }) })
  ], [])
  const hoverStyles = useMemo(() => [
    new Style({ image: new CircleStyle({ radius: 9, fill: new Fill({ color: 'rgba(255,255,255,0.95)' }) }) }),
    new Style({ image: new CircleStyle({ radius: 6, fill: new Fill({ color: '#06b6d4' }), stroke: new Stroke({ color: '#164e63', width: 2 }) }) })
  ], [])
  const selectedStyles = useMemo(() => [
    new Style({ image: new CircleStyle({ radius: 11, fill: new Fill({ color: 'rgba(255,255,255,1)' }) }) }),
    new Style({ image: new CircleStyle({ radius: 7, fill: new Fill({ color: '#ef4444' }), stroke: new Stroke({ color: '#7f1d1d', width: 2 }) }) })
  ], [])

  // Filters
  const [typeFilter, setTypeFilter] = useState<'' | 'building' | 'road' | 'poi'>('')
  const [q, setQ] = useState('')
  const [minHeight, setMinHeight] = useState('')
  const [maxHeight, setMaxHeight] = useState('')
  const debouncedQ = useDebouncedValue(q, 300)

  const vectorSource = useMemo(() => new VectorSource({ strategy: olBbox }), [])
  const vectorLayer = useMemo(() => new VectorLayer({ source: vectorSource }), [vectorSource])

  const map = useMemo(() => new Map({
    target: undefined,
    layers: [
      new TileLayer({ source: new OSM() }),
      vectorLayer,
    ],
    view: new View({ center: fromLonLat([21.012, 52.229]), zoom: 12 }),
    controls: defaultControls({ zoom: true, rotate: false, attribution: false })
  }), [vectorLayer])

  useEffect(() => {
    if (!mapDiv.current) return
    map.setTarget(mapDiv.current)
    return () => map.setTarget(undefined)
  }, [map])

  // Update style to reflect hover/selection
  useEffect(() => {
    vectorLayer.setStyle((feat) => {
      const id = feat.get('id') as string
      if (id === selectedId) return selectedStyles
      if (id === hoveredId) return hoverStyles
      return baseStyles
    })
  }, [vectorLayer, selectedId, hoveredId, baseStyles, hoverStyles, selectedStyles])

  // Fetch assets when view changes (bbox)
  const [bboxStr, setBboxStr] = useState<string | undefined>(undefined)
  useEffect(() => {
    const updateBbox = () => {
      const extent = map.getView().calculateExtent()
      const bottomLeft = toLonLat([extent[0], extent[1]])
      const topRight = toLonLat([extent[2], extent[3]])
      const bbox = [bottomLeft[0], bottomLeft[1], topRight[0], topRight[1]].join(',')
      setBboxStr(bbox)
    }
    updateBbox()
    map.getView().on('change:center', updateBbox)
    map.getView().on('change:resolution', updateBbox)
    return () => {
      map.getView().un('change:center', updateBbox)
      map.getView().un('change:resolution', updateBbox)
    }
  }, [map])

  const minH = minHeight !== '' ? Number(minHeight) : undefined
  const maxH = maxHeight !== '' ? Number(maxHeight) : undefined
  const { data, isFetching } = useGetAssetsQuery({
    bbox: bboxStr,
    limit: 1000,
    type: typeFilter || undefined,
    q: debouncedQ || undefined,
    minHeight: Number.isFinite(minH as number) ? minH : undefined,
    maxHeight: Number.isFinite(maxH as number) ? maxH : undefined,
  })

  useEffect(() => {
    vectorSource.clear()
    if (!data?.items) return
    // Convert to features
    const features = data.items.map((a) => new Feature({
      geometry: new Point(fromLonLat(a.centroid)),
      id: a.id,
      name: a.name,
      type: a.type,
      height: a.height ?? null
    }))
    vectorSource.addFeatures(features)
  }, [data, vectorSource])

  // pointer cursor + hover highlight
  useEffect(() => {
    const onMove = (evt: any) => {
      let found: string | null = null
      map.forEachFeatureAtPixel(evt.pixel, (feat: any) => {
        found = feat.get('id')
        return true
      })
      setHoveredId(found)
      const vp = map.getViewport() as HTMLElement
      vp.style.cursor = found ? 'pointer' : ''
    }
    map.on('pointermove', onMove)
    return () => map.un('pointermove', onMove)
  }, [map])

  // click selection
  useEffect(() => {
    const onClick = (evt: any) => {
      let found: string | null = null
      map.forEachFeatureAtPixel(evt.pixel, (feat: any) => {
        found = feat.get('id')
        return true
      })
      setSelectedId(found)
    }
    map.on('singleclick', onClick)
    return () => map.un('singleclick', onClick)
  }, [map])

  const flyTo = (lon: number, lat: number) => {
    map.getView().animate({ center: fromLonLat([lon, lat]), duration: 350, zoom: Math.max(14, map.getView().getZoom() || 12) })
  }

  return (
    <div className="app">
      <div ref={mapDiv} className="map">
        <div className="attribution">© OpenStreetMap contributors</div>
      </div>
       <div className="sidebar">
         <div className="panel">
           <div className="panel-header">
             <div className="brand">GeoOps</div>
             <div className="muted small">{isFetching ? 'Yükleniyor…' : typeof data?.total === 'number' ? `${data?.total} kayıt` : ''}</div>
           </div>
           <div className="filters">
             <label className="field">
               <span className="label">Tür</span>
               <select className="input" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as any)}>
                 <option value="">Hepsi</option>
                 <option value="building">Building</option>
                 <option value="road">Road</option>
                 <option value="poi">POI</option>
               </select>
             </label>
             <label className="field">
               <span className="label">Metin ara</span>
               <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Örn: Alpha" />
             </label>
             <div className="grid2">
               <label className="field">
                 <span className="label">Min yükseklik</span>
                 <input className="input" inputMode="numeric" value={minHeight} onChange={(e) => setMinHeight(e.target.value.replace(/[^0-9.\-]/g,''))} placeholder="örn. 10" />
               </label>
               <label className="field">
                 <span className="label">Max yükseklik</span>
                 <input className="input" inputMode="numeric" value={maxHeight} onChange={(e) => setMaxHeight(e.target.value.replace(/[^0-9.\-]/g,''))} placeholder="örn. 150" />
               </label>
             </div>
             <div className="actions">
               <button className="btn btn-ghost" onClick={() => { setTypeFilter(''); setQ(''); setMinHeight(''); setMaxHeight(''); }}>Temizle</button>
             </div>
           </div>
         </div>
         <DetailPanel id={selectedId} onClose={() => setSelectedId(null)} onFlyTo={flyTo} />
       </div>
     </div>
   )
}

function DetailPanel({ id, onClose, onFlyTo }: { id: string | null, onClose: () => void, onFlyTo: (lon: number, lat: number) => void }) {
  const { data, isFetching, isError } = useGetAssetByIdQuery(id!, { skip: !id })
  if (!id) return <aside className="panel"><div className="panel-header"><div className="brand">Detay</div></div><div className="empty">Nesne seçilmedi</div></aside>
  if (isFetching) return <aside className="panel"><div className="panel-header"><div className="brand">Detay</div></div><div className="empty">Yükleniyor…</div></aside>
  if (isError || !data) return <aside className="panel"><div className="panel-header"><div className="brand">Detay</div></div><div className="empty">Bulunamadı</div></aside>
  return (
    <aside className="panel">
      <div className="panel-header">
        <div className="brand">{data.name}</div>
        <div className="header-actions">
          <button className="btn btn-ghost" onClick={onClose}>Kapat</button>
          <button className="btn btn-primary" onClick={() => onFlyTo(data.centroid[0], data.centroid[1])}>Haritaya git</button>
        </div>
      </div>
      <ul className="details">
        <li><span className="muted">ID</span><span>{data.id}</span></li>
        <li><span className="muted">Type</span><span>{data.type}</span></li>
        {data.height != null && <li><span className="muted">Height</span><span>{data.height} m</span></li>}
        <li><span className="muted">LonLat</span><span>{data.centroid[0].toFixed(6)}, {data.centroid[1].toFixed(6)}</span></li>
      </ul>
    </aside>
  )
}

function useDebouncedValue<T>(value: T, delay = 300) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

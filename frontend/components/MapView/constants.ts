import { API_BASE } from '../../constants';

export interface MapStyle {
  id: string;
  name: string;
  url: string;
  attribution: string;
  className?: string;
}

export const MAP_STYLES: MapStyle[] = [
  {
    id: 'dark',
    name: 'Dark Mode',
    url: `${API_BASE}/api/v1/maps/tiles/osm/{z}/{x}/{y}.png`,
    className: 'map-tiles-dark',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  },
  {
    id: 'light',
    name: 'Standard Light',
    url: `${API_BASE}/api/v1/maps/tiles/osm/{z}/{x}/{y}.png`,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  },
  {
    id: 'satellite',
    name: 'Satellite',
    url: `${API_BASE}/api/v1/maps/tiles/satellite/{z}/{x}/{y}.png`,
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
  },
  {
    id: 'topo',
    name: 'OpenTopoMap',
    url: `${API_BASE}/api/v1/maps/tiles/topo/{z}/{x}/{y}.png`,
    attribution: 'Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)'
  },
  {
    id: 'cycle',
    name: 'CyclOSM',
    url: `${API_BASE}/api/v1/maps/tiles/cycle/{z}/{x}/{y}.png`,
    attribution: '&copy; <a href="https://github.com/cyclosm/cyclosm-cartocss-style/releases">CyclOSM</a> contributors &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }
];

export type MapStyleType = MapStyle;

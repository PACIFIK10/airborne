import { MapContainer, TileLayer, useMapEvents } from "react-leaflet";
import AircraftLayer from "./AircraftLayer.jsx";

function BoundsWatcher({ onChange }) {
  const map = useMapEvents({
    moveend: () => onChange(map.getBounds()),
    zoomend: () => onChange(map.getBounds()),
  });
  return null;
}

function InitialBounds({ onChange }) {
  const map = useMapEvents({});
  if (!InitialBounds.sent) {
    InitialBounds.sent = true;
    setTimeout(() => onChange(map.getBounds()), 0);
  }
  return null;
}

export default function FlightMap({
  flights,
  trailsRef,
  onBoundsChange,
  onSelect,
  selectedId,
}) {
  return (
    <MapContainer center={[39.95, -75.16]} zoom={7} className="map" worldCopyJump>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <InitialBounds onChange={onBoundsChange} />
      <BoundsWatcher onChange={onBoundsChange} />
      <AircraftLayer
        flights={flights}
        trailsRef={trailsRef}
        selectedId={selectedId}
        onSelect={onSelect}
      />
    </MapContainer>
  );
}

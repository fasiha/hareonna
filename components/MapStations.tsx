import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";

/* Leaflet */
function MapStations() {
  const position = [51.505, -0.09] as [number, number];
  return (
    <MapContainer
      center={position}
      zoom={13}
      style={{ width: "100%", height: "600px" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Marker position={position}>
        <Popup>
          A pretty CSS3 popup. <br /> Easily customizable.
        </Popup>
      </Marker>
    </MapContainer>
  );
}
export default MapStations;

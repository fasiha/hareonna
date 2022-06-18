import dynamic from "next/dynamic";

export const MapStationsDynamic = dynamic(() => import("./MapStations"), {
  ssr: false,
});

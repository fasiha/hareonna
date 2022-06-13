## Steps
Install [Node](https://nodejs.org) and [Git](https://git-scm.com). Run
```
git clone https://github.com/fasiha/hareonna.git
cd hareonna
npm i
```

Download into this `hareonna` directory the following files:
- https://www.ncei.noaa.gov/pub/data/ghcn/daily/ghcnd-stations.txt (10 MB)
- https://www.ncei.noaa.gov/pub/data/ghcn/daily/ghcnd-inventory.txt (33 MB)
- https://www.ncei.noaa.gov/data/global-historical-climatology-network-daily/archive/daily-summaries-latest.tar.gz (7.1 GB as if 2022 June)

Run:
```
node jsonify_stations.js
node filter_stations.js
node closest_station.js
```
This outputs a small <10 MB file, `good-stations-summary.json`, with a number of percentiles for temperature highs/lows for all "good" weather stations that have had temperature data for the last three years (though some stations may have (considerable) missing temperature data within the three year period).

Finally, you need a bunch of Python to render some maps (coming soon to JavaScript/browser):
```bash
# requires numpy, matplotlib, basemap, basemap-data-hires (conda-forge package)
python plots.py
```

This generates a list of most similar weather stations: [closest.md](./closest.md).

And some plots: these are *very* hard to read, sorry! I'll make them into browser apps shortly:

![Zoomed in temperatures](./zoom.png)

![Map](./map.png)

## Notes

All: https://www.ncei.noaa.gov/data/global-historical-climatology-network-daily/access/


- Tehachapi: USC00048829
- SFO: USW00023234

https://www.ncei.noaa.gov/data/global-historical-climatology-network-daily/access/USC00048829.csv

https://nominatim.org/release-docs/develop/api/Search/
- https://nominatim.openstreetmap.org/search?q=tehachapi&format=json
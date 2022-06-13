import json
import matplotlib.pyplot as plt
import numpy as np
from geo import distance

plt.style.use('ggplot')
plt.ion()
with open('good-stations-summary.json', 'r') as fid:
  stations = json.load(fid)

origin = [37.6642278, -122.4439774]
ps, loidx, hiidx = [0.05, 0.95], 2, 6
ps, loidx, hiidx = [0.1, 0.9], 3, 5

distances = distance(origin[0], origin[1], [s['lat'] for s in stations],
                     [s['lon'] for s in stations])
closestStation = stations[np.argmin(distances)]
closestTemp = np.array(
    [closestStation['summary']['lows'][loidx], closestStation['summary']['his'][hiidx]])

stats = []
for i, [station, dist] in enumerate(zip(stations, distances)):
  s = station['summary']
  assert ps[0] == s['ps'][loidx]
  assert ps[1] == s['ps'][hiidx]
  tempDist = np.sum((closestTemp - [s['lows'][loidx], s['his'][hiidx]])**2)
  stats.append(
      [s['lows'][loidx], s['his'][hiidx], tempDist, dist, i, station['lat'], station['lon']])

stats.sort(key=lambda v: v[2])  # sort by temp L2 distance
sarr = np.array(stats)


def stationToMd(station):
  newline = '\n'
  s = station['summary']
  l = []
  for p, lo, hi in zip(s['ps'], s['lows'], s['his']):
    l.append(f'| {p*100}% | {lo} | {hi} |')
  ret = f"""| percentile | low (°C) | high (°C) |
|---|---|---|
{newline.join(l)}"""
  return ret


with open('closest.md', 'w') as fid:
  for rank, [lo, hi, tempd, d, i, *rest] in enumerate(stats[:250]):
    s = stations[i]
    url = f'http://www.openstreetmap.org/?mlat={s["lat"]}&mlon={s["lon"]}&zoom=7'
    out = f'''## № {rank+1}: {lo} °C, {hi} °C: [{s["desc"]}]({url})
{d:,.1f} km away ({s["name"]})
<details>
<summary>Percentile data ({max(s["summary"]["goodPcts"])*100:0.1f}% available)</summary>

{stationToMd(s)}

</details>

'''
    fid.write(out)

plt.figure()
plt.scatter(sarr[0, 0], sarr[0, 1], c='r', s=400, label='closest to SSF Bart')
plt.scatter(sarr[:, 0], sarr[:, 1], c=sarr[:, 3], label='distance (km)')
plt.colorbar()

pDays = round(ps[0] * 365.25)
plt.xlabel(f'{pDays} days/year with colder lows (°C)')
plt.ylabel(f'{pDays} days/year with hotter high (°C)')
plt.title('Most similar lows/highs as South San Francisco')
plt.legend(framealpha=0.5)

plt.savefig('full.png', dpi=300)

plt.xlim(closestTemp[0] + 1.75 * np.array([-1, 1]))
plt.ylim(closestTemp[1] + 1.75 * np.array([-1, 1]))
plt.savefig('zoom.png', dpi=300)

# map
sarr = np.flipud(sarr)
sizes = np.log10(1 / (.001 + sarr[:, 2]))
sizes = 2 * (sizes - np.min(sizes)) + 1

plt.figure()
plt.scatter(sarr[:, 6], sarr[:, 5], c=0.5 * np.log10(.0001 + sarr[:, 2]), s=sizes**2, alpha=0.5)
c = plt.gci().get_clim()
plt.gci().set_clim((c[0], c[0] + 3))

from mpl_toolkits.basemap import Basemap

map = Basemap(projection='cyl', resolution='h')
map.drawmapboundary(fill_color='white')
map.drawcoastlines()

plt.axis([-180, 180, -60, 60])
plt.tight_layout()
plt.savefig('map.png', dpi=300)

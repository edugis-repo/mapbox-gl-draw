// snapToFeature exports function to snap event.lngLat to previously existing feature

// Converts numeric degrees to radians
function toRad(Value) {
  return Value * Math.PI / 180;
}

//This function takes in latitude and longitude of two location and returns the distance between them as the crow flies (in km)
function calcCrow(lat1, lon1, lat2, lon2) {
  const R = 6371; // km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  lat1 = toRad(lat1);
  lat2 = toRad(lat2);

  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c;
  return d;
}

function getNearestPoint(lngLat, coords, nearestDistance, nearestPoint) {
  if (Array.isArray(coords) && coords.length && Array.isArray(coords[0])) {
    for (const subCoord of coords) {
      nearestDistance = getNearestPoint(lngLat, subCoord, nearestDistance, nearestPoint);
    }
    return nearestDistance;
  }
  const distance = calcCrow(lngLat.lng, lngLat.lat, coords[0], coords[1]);
  if (nearestDistance === undefined || nearestDistance > distance) {
    nearestDistance = distance;
    nearestPoint[0] = coords[0];
    nearestPoint[1] = coords[1];
  }
  return nearestDistance;
}

export default function (event, ctx) {
  if (ctx.options.snapEnabled) {
    const map = ctx.map;
    const resultLngLat = event.lngLat;// {lng: lngLat.lng, lat: lngLat.lat};
    const buffer = ctx.options.snapClickBuffer;
    const box = [[event.point.x - buffer, event.point.y - buffer], [event.point.x + buffer, event.point.y + buffer]];
    const testlayers = ['drawPoints', 'drawLines', 'drawPolygons',
      //'gl-draw-polygon-fill-inactive.hot',
      //'gl-draw-polygon-stroke-inactive.hot',
      //'gl-draw-line-inactive.hot',
      //'gl-draw-polygon-and-line-vertex-stroke-inactive.hot',
      //'gl-draw-polygon-and-line-vertex-inactive.hot',
      //'gl-draw-point-point-stroke-inactive.hot',
      //'gl-draw-point-inactive.hot',
      //'gl-draw-polygon-fill-inactive.cold',
      'gl-draw-polygon-stroke-inactive.cold',
      'gl-draw-line-inactive.cold',
      //'gl-draw-polygon-and-line-vertex-stroke-inactive.cold',
      //'gl-draw-polygon-and-line-vertex-inactive.cold',
      //'gl-draw-point-point-stroke-inactive.cold',
      'gl-draw-point-inactive.cold',
    ];
    const layers = map.getStyle().layers.filter(layer => testlayers.includes(layer.id)).map(layer => layer.id);
    const uniqueFeatures = new Set();
    const features = map.queryRenderedFeatures(box, {layers}).filter((feature) => {
      if (!Object.prototype.hasOwnProperty.call(feature.properties, 'id')) {
        return true;
      }
      if (uniqueFeatures.has(feature.properties.id)) {
        return false;
      }
      uniqueFeatures.add(feature.properties.id);
      return true;
    });
    if (features.length) {
      // get nearest feature point
      let nearestDistance;
      const nearestPoint = [0, 0];
      for (const feature of features) {
        const storedFeature = ctx.store.get(feature.properties.id);
        if (storedFeature.coordinates) {
          nearestDistance = getNearestPoint(event.lngLat, storedFeature.coordinates, nearestDistance, nearestPoint);
        } else {
          // use slightly unprecise coordinate result from queryRenderedFeatures
          nearestDistance = getNearestPoint(event.lngLat, feature.geometry.coordinates, nearestDistance, nearestPoint);
        }
      }
      if (nearestDistance) {
        //resultLngLat = {lng: nearestPoint[0], lat: nearestPoint[1]};
        resultLngLat.lng = nearestPoint[0];
        resultLngLat.lat = nearestPoint[1];
      }
    }
    return resultLngLat;
  }
}

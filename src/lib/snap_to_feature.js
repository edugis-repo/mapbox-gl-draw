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

function dot(u, v) {
  return u[0] * v[0] + u[1] * v[1];
}

function getSegmentPoint(p, segment) {
  const a = segment[0];
  const b = segment[1];
  // based on https://github.com/Turfjs/turf/blob/f2023aee26f50fa1fe804fba86be212a99b1a181/packages/turf-point-to-line-distance/index.ts
  const nearestPoint = [0,0];
  const v = [b[0] - a[0], b[1] - a[1]];
  const w = [p.lng - a[0], p.lat - a[1]];

  const c1 = dot(w, v);
  if (c1 <= 0) {
    // a is nearest to p
    return a;
  } else {
    const c2 = dot(v, v);
    if (c2 <= c1) {
      // b is nearest to p
      return b;
    } else {
      const b2 = c1 / c2;
      const Pb = [a[0] + b2 * v[0], a[1] + b2 * v[1]];
      // Pb is point on line
      return Pb;
    }
  }
}


function updateNearestPointDistance(lngLat, point, nearestDistance, nearestPoint) {
  const distance = calcCrow(lngLat.lng, lngLat.lat, point[0], point[1]);
  if (nearestDistance === undefined || nearestDistance > distance) {
    nearestDistance = distance;
    nearestPoint[0] = point[0];
    nearestPoint[1] = point[1];
  }
  return nearestDistance;
}

function getNearestPointOnFeature(lngLat, geometry, nearestDistance, nearestPoint) {
  switch (geometry.type) {
    case 'Point': 
      const point = geometry.coordinates;
      nearestDistance = updateNearestPointDistance(lngLat, point, nearestDistance, nearestPoint);
      break;
    case 'LineString':
      for (let i = 0; i < geometry.coordinates.length - 1; i++) {
        const segment = [geometry.coordinates[i], geometry.coordinates[i+1]];
        const point = getSegmentPoint(lngLat, segment);
        nearestDistance = updateNearestPointDistance(lngLat, point, nearestDistance, nearestPoint);
      }
      break;
    case 'Polygon': 
      for (const ring of geometry.coordinates) {
        for (let i = 0; i < ring.length; i++) {
          const segment = [ring[i], ring[i === ring.length -1 ? 0 : i+1]];
          const point = getSegmentPoint(lngLat, segment);
          nearestDistance = updateNearestPointDistance(lngLat, point, nearestDistance, nearestPoint);
        }
      }
      break;
    case 'MultiPoint': 
      for (const point of geometry.coordinates) {
        nearestDistance = updateNearestPointDistance(lngLat, point, nearestDistance, nearestPoint);
      }
      break;
    case 'MultiLineString':
      for (const lineString of geometry.coordinates) {
        for (let i = 0; i < lineString.length - 1; i++) {
          const segment = [lineString[i], lineString[i+1]];
          const point = getSegmentPoint(lngLat, segment);
          nearestDistance = updateNearestPointDistance(lngLat, point, nearestDistance, nearestPoint);
        }
      }
      break;
    case 'MultiPolygon': 
      for (const polygon of geometry.coordinates) {
        for (const ring of polygon) {
          for (let i = 0; i < ring.length; i++) {
            const segment = [ring[i], ring[i === ring.length - 1 ? 0 : i+1]];
            const point = getSegmentPoint(lngLat, segment);
            nearestDistance = updateNearestPointDistance(lngLat, point, nearestDistance, nearestPoint);
          }
        }
      }
      break;
  }
  return nearestDistance;
}


function isAltDown(event) {
  return event.originalEvent ? event.originalEvent.altKey : false;
}

export default function (event, ctx) {
  if (ctx.options.snapEnabled && !isAltDown(event)) {
    const selectedFeatureIds = ctx.api.getSelectedIds();
    if (ctx.events.currentModeName().indexOf('select') !== -1 && selectedFeatureIds.length === 0) {
      // mode is 'simple_select' or 'direct_select', nothing selected
      return;
    }
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
      if (selectedFeatureIds.includes(feature.properties.id)) {
        return false; // do not snap to self
      }
      return true;
    });
    if (features.length) {
      // get nearest feature point
      let nearestDistance;
      const nearestPoint = [0, 0];
      for (const feature of features) {
        const storedFeature = ctx.store.get(feature.properties.id);
        if (storedFeature.coordinates) {
          nearestDistance = getNearestPointOnFeature(event.lngLat, storedFeature, nearestDistance, nearestPoint);
        } else {
          // use slightly unprecise coordinate result from queryRenderedFeatures
          nearestDistance = getNearestPointOnFeature(event.lngLat, feature.geometry, nearestDistance, nearestPoint);
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

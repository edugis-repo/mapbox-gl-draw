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

// path: comma separated path to segment, ie polygon#,ring#,node# or linestring#,node# for multilnestring
function getSegmentPoint(p, segment, featureId, path) {
  const a = segment[0];
  const b = segment[1];
  // based on https://github.com/Turfjs/turf/blob/f2023aee26f50fa1fe804fba86be212a99b1a181/packages/turf-point-to-line-distance/index.ts
  const v = [b[0] - a[0], b[1] - a[1]];
  const w = [p.lng - a[0], p.lat - a[1]];

  const c1 = dot(w, v);
  if (c1 <= 0) {
    // a is nearest to p
    return {coords: a, interpolated: false};
  } else {
    const c2 = dot(v, v);
    if (c2 <= c1) {
      // b is nearest to p
      return {coords: b, interpolated: false};
    } else {
      const b2 = c1 / c2;
      const Pb = [a[0] + b2 * v[0], a[1] + b2 * v[1]];
      // Pb is point on line
      return {coords: Pb, interpolated: true, segment: [a, b], featureId, path};
    }
  }
}

function updateNearestPoint(lngLat, point, nearestPoint) {
  const distance = calcCrow(lngLat.lng, lngLat.lat, point.coords[0], point.coords[1]);
  if (nearestPoint.distance > distance) {
    if (point.interpolated) {
      // prefer segment points above interpolated points
      const distanceA = calcCrow(lngLat.lng, lngLat.lat, point.segment[0][0], point.segment[0][1]);
      const distanceB = calcCrow(lngLat.lng, lngLat.lat, point.segment[1][0], point.segment[1][1]);
      let cornerPoint;
      let cornerDistance;
      if (distanceA < distanceB) {
        cornerPoint = point.segment[0];
        cornerDistance = distanceA;
      } else {
        cornerPoint = point.segment[1];
        cornerDistance = distanceB;
      }
      if (cornerDistance < distance * 1.3) {
        // replace interpolated line point by corner point
        return {
          distance: cornerDistance,
          coords: cornerPoint,
          interpolated: false
        };
      }
      return {
        distance,
        coords: point.coords,
        interpolated: true,
        featureId: point.featureId,
        path: point.path
      };
    }
    return {
      distance,
      coords: point.coords,
      interpolated: false
    };
  }
  return nearestPoint;
}

function getNearestPointOnFeature(featureId, lngLat, geometry, nearestPoint) {
  switch (geometry.type) {
  case 'Point':
    {
      const point = {coords: geometry.coordinates, interpolated: false};
      nearestPoint = updateNearestPoint(lngLat, point, nearestPoint);
    }
    break;
  case 'LineString':
    for (let i = 0; i < geometry.coordinates.length - 1; i++) {
      const segment = [geometry.coordinates[i], geometry.coordinates[i + 1]];
      const point = getSegmentPoint(lngLat, segment, featureId, `${i + 1}`);// why +1?
      nearestPoint = updateNearestPoint(lngLat, point, nearestPoint);
    }
    break;
  case 'Polygon':
    for (let ringIndex = 0; ringIndex < geometry.coordinates.length; ringIndex++) {
      const ring = geometry.coordinates[ringIndex];
      for (let i = 0; i < ring.length; i++) {
        const segment = [ring[i], ring[i === ring.length - 1 ? 0 : i + 1]];
        const point = getSegmentPoint(lngLat, segment, featureId, `${ringIndex}.${i + 1}`);// why +1?
        nearestPoint = updateNearestPoint(lngLat, point, nearestPoint);
      }
    }
    break;
  case 'MultiPoint':
    for (const coords of geometry.coordinates) {
      nearestPoint = updateNearestPoint(lngLat, {coords, interpolated: false}, nearestPoint);
    }
    break;
  case 'MultiLineString':
    for (let lineStringIndex = 0; lineStringIndex < geometry.coordinates.length; lineStringIndex++) {
      const lineString = geometry.coordinates[lineStringIndex];
      for (let i = 0; i < lineString.length - 1; i++) {
        const segment = [lineString[i], lineString[i + 1]];
        const point = getSegmentPoint(lngLat, segment, featureId, `${lineStringIndex}.${i + 1}`);
        nearestPoint = updateNearestPoint(lngLat, point, nearestPoint);
      }
    }
    break;
  case 'MultiPolygon':
    for (let polygonIndex = 0; polygonIndex < geometry.coordinates.length; polygonIndex++) {
      const polygon = geometry.coordinates[polygonIndex];
      for (let ringIndex = 0; ringIndex < polygon.length; ringIndex++) {
        const ring = polygon[ringIndex];
        for (let i = 0; i < ring.length; i++) {
          const segment = [ring[i], ring[i === ring.length - 1 ? 0 : i + 1]];
          const point = getSegmentPoint(lngLat, segment, featureId, `${polygonIndex}.${ringIndex}.${i + 1}`);
          nearestPoint = updateNearestPoint(lngLat, point, nearestPoint);
        }
      }
    }
    break;
  }
  return nearestPoint;
}


function isAltDown(event) {
  return event.originalEvent ? event.originalEvent.altKey : false;
}

/**
 * try to snap to nearby previously existing feature
 * @param {MouseEvent} event event.lngLat is updated when snapping succeeds
 * @param {MapboxGlContext} ctx
 * @returns {{distance: number, coords: Array<number,number>, interpolated: boolean, path: string}} NearestPoint
 * @returns {number} NearestPoint.distance distance in km | Infinity
 * @returns {Array<number,number>} NearestPont.coords coordinates of snapped point
 * @returns {boolean} NearestPoint.interpolated true when snapped to point on segment between 2 points, path: string encoded location of point within feature
 * @returns {string} NearestPoint.path string encoding of location of snapped point within feature
 */
export default function (event, ctx) {
  let nearestPoint = {
    distance: Infinity,
    coords: [0, 0],
    interpolated: false
  };
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
      for (const feature of features) {
        const storedFeature = ctx.store.get(feature.properties.id);
        if (storedFeature.coordinates) {
          nearestPoint = getNearestPointOnFeature(feature.properties.id, event.lngLat, storedFeature, nearestPoint);
        } else {
          // use slightly unprecise coordinate result from queryRenderedFeatures
          const featureId = feature.properties.id ? feature.properties.id : feature.id;
          nearestPoint = getNearestPointOnFeature(featureId, event.lngLat, feature.geometry, nearestPoint);
        }
      }
      if (nearestPoint.distance < Infinity) {
        //resultLngLat = {lng: nearestPoint[0], lat: nearestPoint[1]};
        resultLngLat.lng = nearestPoint.coords[0];
        resultLngLat.lat = nearestPoint.coords[1];
      }
    }
  }
  return nearestPoint;
}

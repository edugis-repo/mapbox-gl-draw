import * as CommonSelectors from '../lib/common_selectors';
import doubleClickZoom from '../lib/double_click_zoom';
import * as Constants from '../constants';
import createVertex from '../lib/create_vertex';

const DrawLineString = {};

DrawLineString.onSetup = function(opts) {
  opts = opts || {};
  const featureId = opts.featureId;

  let line, currentVertexPosition;
  let direction = 'forward';
  if (featureId) {
    line = this.getFeature(featureId);
    if (!line) {
      throw new Error('Could not find a feature with the provided featureId');
    }
    let from = opts.from;
    if (from && from.type === 'Feature' && from.geometry && from.geometry.type === 'Point') {
      from = from.geometry;
    }
    if (from && from.type === 'Point' && from.coordinates && from.coordinates.length === 2) {
      from = from.coordinates;
    }
    if (!from || !Array.isArray(from)) {
      throw new Error('Please use the `from` property to indicate which point to continue the line from');
    }
    const lastCoord = line.coordinates.length - 1;
    if (line.coordinates[lastCoord][0] === from[0] && line.coordinates[lastCoord][1] === from[1]) {
      currentVertexPosition = lastCoord + 1;
      // add one new coordinate to continue from
      line.addCoordinate(currentVertexPosition, ...line.coordinates[lastCoord]);
    } else if (line.coordinates[0][0] === from[0] && line.coordinates[0][1] === from[1]) {
      direction = 'backwards';
      currentVertexPosition = 0;
      // add one new coordinate to continue from
      line.addCoordinate(currentVertexPosition, ...line.coordinates[0]);
    } else {
      throw new Error('`from` should match the point at either the start or the end of the provided LineString');
    }
  } else {
    line = this.newFeature({
      type: Constants.geojsonTypes.FEATURE,
      properties: {},
      geometry: {
        type: Constants.geojsonTypes.LINE_STRING,
        coordinates: []
      }
    });
    currentVertexPosition = 0;
    this.addFeature(line);
  }

  this.clearSelectedFeatures();
  doubleClickZoom.disable(this);
  this.updateUIClasses({ mouse: Constants.cursors.ADD });
  this.activateUIButton(Constants.types.LINE);
  this.setActionableState({
    trash: true
  });

  return {
    line,
    currentVertexPosition,
    direction
  };
};

DrawLineString.clickAnywhere = function(state, e) {
  /* if (state.currentVertexPosition > 0 && isEventAtCoordinates(e, state.line.coordinates[state.currentVertexPosition - 1]) ||
      state.direction === 'backwards' && isEventAtCoordinates(e, state.line.coordinates[state.currentVertexPosition + 1])) {
    return this.changeMode(Constants.modes.SIMPLE_SELECT, { featureIds: [state.line.id] });
  }*/
  this.updateUIClasses({ mouse: Constants.cursors.ADD });
  //state.line.updateCoordinate(state.currentVertexPosition, e.lngLat.lng, e.lngLat.lat);
  if (state.direction === 'forward') {
    state.currentVertexPosition++;
    state.line.updateCoordinate(state.currentVertexPosition, e.lngLat.lng, e.lngLat.lat);
  } else {
    state.line.addCoordinate(0, e.lngLat.lng, e.lngLat.lat);
  }
};

DrawLineString.clickOnVertex = function(state) {
  return this.changeMode(Constants.modes.SIMPLE_SELECT, { featureIds: [state.line.id] });
};

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

DrawLineString.snapToFeatures = function (event) {
  let resultLngLat = event.lngLat;// {lng: lngLat.lng, lat: lngLat.lat};
  //const box = (event) ? mapEventToBoundingBox(event, buffer) : bbox;
  const buffer = 30;
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
  const layers = this.map.getStyle().layers.filter(layer => testlayers.includes(layer.id)).map(layer => layer.id);
  const features = this.map.queryRenderedFeatures(box, {layers});
  if (features.length) {
    // get nearest feature point
    let nearestDistance;
    const nearestPoint = [0, 0];
    for (const feature of features) {
      nearestDistance = getNearestPoint(event.lngLat, feature.geometry.coordinates, nearestDistance, nearestPoint);
    }
    if (nearestDistance) {
      resultLngLat = {lng: nearestPoint[0], lat: nearestPoint[1]};
    }
  }
  return resultLngLat;
};

DrawLineString.onMouseMove = function(state, e) {
  const lngLat = this.snapToFeatures(e);
  state.line.updateCoordinate(state.currentVertexPosition, lngLat.lng, lngLat.lat);
  /* if (CommonSelectors.isVertex(e)) {
    this.updateUIClasses({ mouse: Constants.cursors.POINTER });
  }*/
};

DrawLineString.onTap = DrawLineString.onClick = function(state, e) {
  if (state.currentVertexPosition > 0 &&
      state.line.coordinates[state.currentVertexPosition][0] ===
        state.line.coordinates[state.currentVertexPosition - 1][0] &&
      state.line.coordinates[state.currentVertexPosition][1] ===
        state.line.coordinates[state.currentVertexPosition - 1][1]) {
    return this.changeMode(Constants.modes.SIMPLE_SELECT, { featureIds: [state.line.id] });
  }
  this.clickAnywhere(state, e);
};

DrawLineString.onKeyUp = function(state, e) {
  if (CommonSelectors.isEnterKey(e)) {
    this.changeMode(Constants.modes.SIMPLE_SELECT, { featureIds: [state.line.id] });
  } else if (CommonSelectors.isEscapeKey(e)) {
    this.deleteFeature([state.line.id], { silent: true });
    this.changeMode(Constants.modes.SIMPLE_SELECT);
  }
};

DrawLineString.onStop = function(state) {
  doubleClickZoom.enable(this);
  this.activateUIButton();

  // check to see if we've deleted this feature
  if (this.getFeature(state.line.id) === undefined) return;

  //remove last added coordinate
  state.line.removeCoordinate(`${state.currentVertexPosition}`);
  if (state.line.isValid()) {
    this.map.fire(Constants.events.CREATE, {
      features: [state.line.toGeoJSON()]
    });
  } else {
    this.deleteFeature([state.line.id], { silent: true });
    this.changeMode(Constants.modes.SIMPLE_SELECT, {}, { silent: true });
  }
};

DrawLineString.onTrash = function(state) {
  this.deleteFeature([state.line.id], { silent: true });
  this.changeMode(Constants.modes.SIMPLE_SELECT);
};

DrawLineString.toDisplayFeatures = function(state, geojson, display) {
  const isActiveLine = geojson.properties.id === state.line.id;
  geojson.properties.active = (isActiveLine) ? Constants.activeStates.ACTIVE : Constants.activeStates.INACTIVE;
  if (!isActiveLine) return display(geojson);
  geojson.properties.meta = Constants.meta.FEATURE;
  for (let i = 0; i < geojson.geometry.coordinates.length; i++) {
    const coordinate = geojson.geometry.coordinates[i];
    display(createVertex(state.line.id, coordinate, `${i}`, false));
  }
  display(geojson);
};

export default DrawLineString;

import * as CommonSelectors from '../lib/common_selectors';
import doubleClickZoom from '../lib/double_click_zoom';
import * as Constants from '../constants';
import createVertex from '../lib/create_vertex';
import snappedSegmentUpdate from '../lib/snapped_segment_update';
import euclideanDistance from '../lib/euclidean_distance';

const DrawPolygon = {};

DrawPolygon.onSetup = function() {
  const polygon = this.newFeature({
    type: Constants.geojsonTypes.FEATURE,
    properties: {},
    geometry: {
      type: Constants.geojsonTypes.POLYGON,
      coordinates: [[]]
    }
  });

  this.addFeature(polygon);

  this.clearSelectedFeatures();
  doubleClickZoom.disable(this);
  this.updateUIClasses({ mouse: Constants.cursors.ADD });
  this.activateUIButton(Constants.types.POLYGON);
  this.setActionableState({
    trash: true
  });

  return {
    polygon,
    currentVertexPosition: 0
  };
};

DrawPolygon.clickAnywhere = function(state, e) {
  /*if (state.currentVertexPosition > 0 && isEventAtCoordinates(e, state.polygon.coordinates[0][state.currentVertexPosition - 1])) {
    return this.changeMode(Constants.modes.SIMPLE_SELECT, { featureIds: [state.polygon.id] });
  }*/
  snappedSegmentUpdate(e, state.polygon.ctx);
  this.updateUIClasses({ mouse: Constants.cursors.ADD });
  state.polygon.updateCoordinate(`0.${state.currentVertexPosition}`, e.lngLat.lng, e.lngLat.lat);
  state.currentVertexPosition++;
  state.polygon.updateCoordinate(`0.${state.currentVertexPosition}`, e.lngLat.lng, e.lngLat.lat);
};

DrawPolygon.clickOnVertex = function(state) {
  return this.changeMode(Constants.modes.SIMPLE_SELECT, { featureIds: [state.polygon.id] });
};

DrawPolygon.onMouseMove = function(state, e) {
  state.polygon.updateCoordinate(`0.${state.currentVertexPosition}`, e.lngLat.lng, e.lngLat.lat);
  /*
  if (CommonSelectors.isVertex(e)) {
    this.updateUIClasses({ mouse: Constants.cursors.POINTER });
  }*/
};

DrawPolygon.onTap = function (state, e) {
  this.onMouseMove(state, e);
  if (state.currentVertexPosition > 0 && this.prevTapPoint && euclideanDistance(e.point, this.prevTapPoint) < state.polygon.ctx.options.doubleTapBuffer) {
    this.prevTapPoint = null;
    return this.changeMode(Constants.modes.SIMPLE_SELECT, { featureIds: [state.polygon.id] });
  }
  this.prevTapPoint = e.point;
  this.onClick(state, e);
};

DrawPolygon.onClick = function(state, e) {
  //if (CommonSelectors.isVertex(e)) return this.clickOnVertex(state, e);
  if (state.currentVertexPosition > 0 &&
    state.polygon.coordinates.length > 0 &&
    state.polygon.coordinates[0][state.currentVertexPosition][0] ===
      state.polygon.coordinates[0][state.currentVertexPosition - 1][0] &&
    state.polygon.coordinates[0][state.currentVertexPosition][1] ===
      state.polygon.coordinates[0][state.currentVertexPosition - 1][1]) {
    return this.changeMode(Constants.modes.SIMPLE_SELECT, { featureIds: [state.polygon.id] });
  }
  return this.clickAnywhere(state, e);
};

DrawPolygon.onKeyUp = function(state, e) {
  if (CommonSelectors.isEscapeKey(e)) {
    this.deleteFeature([state.polygon.id], { silent: true });
    this.changeMode(Constants.modes.SIMPLE_SELECT);
  } else if (CommonSelectors.isEnterKey(e)) {
    this.changeMode(Constants.modes.SIMPLE_SELECT, { featureIds: [state.polygon.id] });
  }
};

DrawPolygon.onStop = function(state) {
  this.updateUIClasses({ mouse: Constants.cursors.NONE });
  doubleClickZoom.enable(this);
  this.activateUIButton();

  // check to see if we've deleted this feature
  if (this.getFeature(state.polygon.id) === undefined) return;

  //remove last added coordinate
  state.polygon.removeCoordinate(`0.${state.currentVertexPosition}`);
  if (state.polygon.isValid()) {
    this.map.fire(Constants.events.CREATE, {
      features: [state.polygon.toGeoJSON()]
    });
  } else {
    this.deleteFeature([state.polygon.id], { silent: true });
    this.changeMode(Constants.modes.SIMPLE_SELECT, {}, { silent: true });
  }
};

DrawPolygon.toDisplayFeatures = function(state, geojson, display) {
  const isActivePolygon = geojson.properties.id === state.polygon.id;
  geojson.properties.active = (isActivePolygon) ? Constants.activeStates.ACTIVE : Constants.activeStates.INACTIVE;
  if (!isActivePolygon) return display(geojson);

  // Don't render a polygon until it has two positions
  // (and a 3rd which is just the first repeated)
  if (geojson.geometry.coordinates.length === 0) return;

  if (geojson.geometry.coordinates[0].length && geojson.geometry.coordinates[0][0] === undefined) return;

  for (let i = 0; i < geojson.geometry.coordinates[0].length; i++) {
    const coordinate = geojson.geometry.coordinates[0][i];
    display(createVertex(state.polygon.id, coordinate, `0.${i}`, false));
  }

  const coordinateCount = geojson.geometry.coordinates[0].length;
  // 2 coordinates after selecting a draw type
  // 3 after creating the first point
  if (coordinateCount < 3) {
    return;
  }
  geojson.properties.meta = Constants.meta.FEATURE;
  display(createVertex(state.polygon.id, geojson.geometry.coordinates[0][0], '0.0', false));
  if (coordinateCount > 3) {
    // Add a start position marker to the map, clicking on this will finish the feature
    // This should only be shown when we're in a valid spot
    const endPos = geojson.geometry.coordinates[0].length - 3;
    display(createVertex(state.polygon.id, geojson.geometry.coordinates[0][endPos], `0.${endPos}`, false));
  }
  if (coordinateCount <= 4) {
    // If we've only drawn two positions (plus the closer),
    // make a LineString instead of a Polygon
    const lineCoordinates = [
      [geojson.geometry.coordinates[0][0][0], geojson.geometry.coordinates[0][0][1]], [geojson.geometry.coordinates[0][1][0], geojson.geometry.coordinates[0][1][1]]
    ];
    // create an initial vertex so that we can track the first point on mobile devices
    display({
      type: Constants.geojsonTypes.FEATURE,
      properties: geojson.properties,
      geometry: {
        coordinates: lineCoordinates,
        type: Constants.geojsonTypes.LINE_STRING
      }
    });
    if (coordinateCount === 3) {
      return;
    }
  }
  // render the Polygon
  return display(geojson);
};

DrawPolygon.removePoint = function(state) {
  if (state.currentVertexPosition > 1) {
    state.polygon.removeCoordinate(`0.${state.currentVertexPosition - 1}`);
    state.currentVertexPosition--;
  }
};

DrawPolygon.onTrash = function(state) {
  this.removePoint(state);
  if (state.currentVertexPosition <= 1) {
    this.deleteFeature([state.polygon.id], { silent: true });
    this.changeMode(Constants.modes.SIMPLE_SELECT);
  }
};

export default DrawPolygon;

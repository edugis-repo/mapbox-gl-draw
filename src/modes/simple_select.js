import * as CommonSelectors from '../lib/common_selectors';
import mouseEventPoint from '../lib/mouse_event_point';
import createSupplementaryPoints from '../lib/create_supplementary_points';
import StringSet from '../lib/string_set';
import doubleClickZoom from '../lib/double_click_zoom';
import moveFeatures from '../lib/move_features';
import * as Constants from '../constants';
import constrainFeatureMovement from '../lib//constrain_feature_movement';

const SimpleSelect = {};

SimpleSelect.onSetup = function(opts) {
  // turn the opts into state.
  const state = {
    dragMoveLocation: null,
    boxSelectStartLocation: null,
    boxSelectElement: undefined,
    boxSelecting: false,
    canBoxSelect: false,
    dragMoving: false,
    canDragMove: false,
    initiallySelectedFeatureIds: opts.featureIds || []
  };

  this.setSelected(state.initiallySelectedFeatureIds.filter(id => this.getFeature(id) !== undefined));
  this.fireActionable();

  this.setActionableState({
    combineFeatures: true,
    uncombineFeatures: true,
    trash: true
  });

  return state;
};

SimpleSelect.fireUpdate = function() {
  this.map.fire(Constants.events.UPDATE, {
    action: Constants.updateActions.MOVE,
    features: this.getSelected().map(f => f.toGeoJSON())
  });
};

SimpleSelect.fireActionable = function() {
  const selectedFeatures = this.getSelected();

  const multiFeatures = selectedFeatures.filter(
    feature => this.isInstanceOf('MultiFeature', feature)
  );

  let combineFeatures = false;

  if (selectedFeatures.length > 1) {
    combineFeatures = true;
    const featureType = selectedFeatures[0].type.replace('Multi', '');
    selectedFeatures.forEach((feature) => {
      if (feature.type.replace('Multi', '') !== featureType) {
        combineFeatures = false;
      }
    });
  }

  const uncombineFeatures = multiFeatures.length > 0;
  const trash = selectedFeatures.length > 0;

  this.setActionableState({
    combineFeatures, uncombineFeatures, trash
  });
};

SimpleSelect.getUniqueIds = function(allFeatures) {
  if (!allFeatures.length) return [];
  const ids = allFeatures.map(s => s.properties.id)
    .filter(id => id !== undefined)
    .reduce((memo, id) => {
      memo.add(id);
      return memo;
    }, new StringSet());

  return ids.values();
};

SimpleSelect.stopExtendedInteractions = function(state) {
  if (state.boxSelectElement) {
    if (state.boxSelectElement.parentNode) state.boxSelectElement.parentNode.removeChild(state.boxSelectElement);
    state.boxSelectElement = null;
  }

  this.map.dragPan.enable();

  state.boxSelecting = false;
  state.canBoxSelect = false;
  state.dragMoving = false;
  state.canDragMove = false;
};

SimpleSelect.onStop = function() {
  doubleClickZoom.enable(this);
};

SimpleSelect.onMouseMove = function(state) {
  // On mousemove that is not a drag, stop extended interactions.
  // This is useful if you drag off the canvas, release the button,
  // then move the mouse back over the canvas --- we don't allow the
  // interaction to continue then, but we do let it continue if you held
  // the mouse button that whole time
  this.stopExtendedInteractions(state);

  // Skip render
  return true;
};

SimpleSelect.onMouseOut = function(state) {
  // As soon as you mouse leaves the canvas, update the feature
  if (state.dragMoving) return this.fireUpdate();

  // Skip render
  return true;
};

SimpleSelect.onTap = SimpleSelect.onClick = function(state, e) {
  // Click (with or without shift) on no feature
  if (CommonSelectors.noTarget(e)) return this.clickAnywhere(state, e); // also tap
  if (CommonSelectors.isOfMetaType(Constants.meta.VERTEX)(e)) return this.clickOnVertex(state, e); //tap
  if (CommonSelectors.isFeature(e)) return this.clickOnFeature(state, e);
};

SimpleSelect.clickAnywhere = function (state) {
  // Clear the re-render selection
  const wasSelected = this.getSelectedIds();
  if (wasSelected.length) {
    this.clearSelectedFeatures();
    wasSelected.forEach(id => this.doRender(id));
  }
  doubleClickZoom.enable(this);
  this.stopExtendedInteractions(state);
};

SimpleSelect.clickOnVertex = function(state, e) {
  // Enter direct select mode
  this.changeMode(Constants.modes.DIRECT_SELECT, {
    featureId: e.featureTarget.properties.parent,
    coordPath: e.featureTarget.properties.coord_path,
    startPos: e.lngLat
  });
  this.updateUIClasses({ mouse: Constants.cursors.MOVE });
};

SimpleSelect.startOnActiveFeature = function(state, e) {
  // Stop any already-underway extended interactions
  this.stopExtendedInteractions(state);

  // Disable map.dragPan immediately so it can't start
  this.map.dragPan.disable();

  // Re-render it and enable drag move
  this.doRender(e.featureTarget.properties.id);

  // Set up the state for drag moving
  state.canDragMove = true;
  state.dragMoveLocation = e.lngLat;
};

SimpleSelect.clickOnFeature = function(state, e) {
  // Stop everything
  doubleClickZoom.disable(this);
  this.stopExtendedInteractions(state);

  const isShiftClick = CommonSelectors.isShiftDown(e);
  const selectedFeatureIds = this.getSelectedIds();
  const featureId = e.featureTarget.properties.id;
  const isFeatureSelected = this.isSelected(featureId);

  // Click (without shift) on any selected feature but a point
  if (!isShiftClick && isFeatureSelected && this.getFeature(featureId).type !== Constants.geojsonTypes.POINT) {
    // Enter direct select mode
    return this.changeMode(Constants.modes.DIRECT_SELECT, {
      featureId
    });
  }

  // Shift-click on a selected feature
  if (isFeatureSelected && isShiftClick) {
    // Deselect it
    this.deselect(featureId);
    this.updateUIClasses({ mouse: Constants.cursors.POINTER });
    if (selectedFeatureIds.length === 1) {
      doubleClickZoom.enable(this);
    }
  // Shift-click on an unselected feature
  } else if (!isFeatureSelected && isShiftClick) {
    // Add it to the selection
    this.select(featureId);
    this.updateUIClasses({ mouse: Constants.cursors.MOVE });
  // Click (without shift) on an unselected feature
  } else if (!isFeatureSelected && !isShiftClick) {
    // Make it the only selected feature
    selectedFeatureIds.forEach(id => this.doRender(id));
    this.setSelected(featureId);
    this.updateUIClasses({ mouse: Constants.cursors.MOVE });
  }

  // No matter what, re-render the clicked feature
  this.doRender(featureId);
};

SimpleSelect.onMouseDown = function(state, e) {
  if (CommonSelectors.isActiveFeature(e)) return this.startOnActiveFeature(state, e);
  if (this.drawConfig.boxSelect && CommonSelectors.isShiftMousedown(e)) return this.startBoxSelect(state, e);
};

SimpleSelect.startBoxSelect = function(state, e) {
  this.stopExtendedInteractions(state);
  this.map.dragPan.disable();
  // Enable box select
  state.boxSelectStartLocation = mouseEventPoint(e.originalEvent, this.map.getContainer());
  state.canBoxSelect = true;
};

SimpleSelect.onTouchStart = function(state, e) {
  if (CommonSelectors.isActiveFeature(e)) return this.startOnActiveFeature(state, e);
};

SimpleSelect.onDrag = function(state, e) {
  if (state.canDragMove) return this.dragMove(state, e);
  if (this.drawConfig.boxSelect && state.canBoxSelect) return this.whileBoxSelect(state, e);
};

SimpleSelect.whileBoxSelect = function(state, e) {
  state.boxSelecting = true;
  this.updateUIClasses({ mouse: Constants.cursors.ADD });

  // Create the box node if it doesn't exist
  if (!state.boxSelectElement) {
    state.boxSelectElement = document.createElement('div');
    state.boxSelectElement.classList.add(Constants.classes.BOX_SELECT);
    this.map.getContainer().appendChild(state.boxSelectElement);
  }

  // Adjust the box node's width and xy position
  const current = mouseEventPoint(e.originalEvent, this.map.getContainer());
  const minX = Math.min(state.boxSelectStartLocation.x, current.x);
  const maxX = Math.max(state.boxSelectStartLocation.x, current.x);
  const minY = Math.min(state.boxSelectStartLocation.y, current.y);
  const maxY = Math.max(state.boxSelectStartLocation.y, current.y);
  const translateValue = `translate(${minX}px, ${minY}px)`;
  state.boxSelectElement.style.transform = translateValue;
  state.boxSelectElement.style.WebkitTransform = translateValue;
  state.boxSelectElement.style.width = `${maxX - minX}px`;
  state.boxSelectElement.style.height = `${maxY - minY}px`;
};

SimpleSelect.dragMove = function(state, e) {
  // Dragging when drag move is enabled
  state.dragMoving = true;
  e.originalEvent.stopPropagation();

  const delta = {
    lng: e.lngLat.lng - state.dragMoveLocation.lng,
    lat: e.lngLat.lat - state.dragMoveLocation.lat
  };
  const features = this.getSelected();
  if (features.every(({type}) => type === 'Point')) {
    this.dragVertices(state, e, delta, features);
  } else {
    moveFeatures(features, delta);
  }
  state.dragMoveLocation = e.lngLat;
};

SimpleSelect.dragVertices = function(state, e, delta, pointFeatures) {
  const origDelta = {lng: delta.lng, lat: delta.lat};
  const constrainedDelta = constrainFeatureMovement(pointFeatures.map(feature => feature.toGeoJSON()), delta);
  if (constrainedDelta.lng === origDelta.lng && constrainedDelta.lat === origDelta.lat) {
    // not constrained
    if (pointFeatures.length === 1) {
      pointFeatures[0].incomingCoords([e.lngLat.lng, e.lngLat.lat]);
    } else {
      // determine wich point should be snapped to e.lngLat
      let nearestDistance;
      let nearestPoint;
      for (let i = 0; i < pointFeatures.length; i++)  {
        const coord = pointFeatures[i].getCoordinates();
        const deltaLng = coord[0] + constrainedDelta.lng - e.lngLat.lng;
        const deltaLat = coord[1] + constrainedDelta.lat - e.lngLat.lat;
        const distance = deltaLng * deltaLng + deltaLat * deltaLat;
        if (nearestDistance === undefined || nearestDistance > distance) {
          nearestDistance = distance;
          nearestPoint = i;
        }
      }
      for (let i = 0; i < pointFeatures.length; i++) {
        if (i === nearestPoint) {
          pointFeatures[i].incomingCoords([e.lngLat.lng, e.lngLat.lat]);
        } else {
          const coord = pointFeatures[i].getCoordinates();
          pointFeatures[i].incomingCoords([coord[0] + constrainedDelta.lng, coord[1] + constrainedDelta.lat]);
        }
      }
    }
  } else {
    // constrained, use less precise delta
    for (const feature of pointFeatures) {
      const coord = feature.getCoordinates();
      feature.incomingCoords([coord[0] + constrainedDelta.lng, coord[1] + constrainedDelta.lat]);
    }
  }
};

SimpleSelect.onTouchEnd = SimpleSelect.onMouseUp = function(state, e) {
  // End any extended interactions
  if (state.dragMoving) {
    this.fireUpdate();
  } else if (state.boxSelecting) {
    const bbox = [
      state.boxSelectStartLocation,
      mouseEventPoint(e.originalEvent, this.map.getContainer())
    ];
    const featuresInBox = this.featuresAt(null, bbox, 'click');
    const idsToSelect = this.getUniqueIds(featuresInBox)
      .filter(id => !this.isSelected(id));

    if (idsToSelect.length) {
      this.select(idsToSelect);
      idsToSelect.forEach(id => this.doRender(id));
      this.updateUIClasses({ mouse: Constants.cursors.MOVE });
    }
  }
  this.stopExtendedInteractions(state);
};

SimpleSelect.toDisplayFeatures = function(state, geojson, display) {
  geojson.properties.active = (this.isSelected(geojson.properties.id)) ?
    Constants.activeStates.ACTIVE : Constants.activeStates.INACTIVE;
  display(geojson);
  this.fireActionable();
  if (geojson.properties.active !== Constants.activeStates.ACTIVE ||
    geojson.geometry.type === Constants.geojsonTypes.POINT) return;
  createSupplementaryPoints(geojson).forEach(display);
};

SimpleSelect.onTrash = function() {
  this.deleteFeature(this.getSelectedIds());
  this.fireActionable();
};

SimpleSelect.onCombineFeatures = function() {
  const selectedFeatures = this.getSelected();

  if (selectedFeatures.length === 0 || selectedFeatures.length < 2) return;

  const coordinates = [], featuresCombined = [];
  const featureType = selectedFeatures[0].type.replace('Multi', '');

  for (let i = 0; i < selectedFeatures.length; i++) {
    const feature = selectedFeatures[i];

    if (feature.type.replace('Multi', '') !== featureType) {
      return;
    }
    if (feature.type.includes('Multi')) {
      feature.getCoordinates().forEach((subcoords) => {
        coordinates.push(subcoords);
      });
    } else {
      coordinates.push(feature.getCoordinates());
    }

    featuresCombined.push(feature.toGeoJSON());
  }

  if (featuresCombined.length > 1) {
    const multiFeature = this.newFeature({
      type: Constants.geojsonTypes.FEATURE,
      properties: featuresCombined[0].properties,
      geometry: {
        type: `Multi${featureType}`,
        coordinates
      }
    });

    this.addFeature(multiFeature);
    this.deleteFeature(this.getSelectedIds(), { silent: true });
    this.setSelected([multiFeature.id]);

    this.map.fire(Constants.events.COMBINE_FEATURES, {
      createdFeatures: [multiFeature.toGeoJSON()],
      deletedFeatures: featuresCombined
    });
  }
  this.fireActionable();
};

SimpleSelect.onUncombineFeatures = function() {
  const selectedFeatures = this.getSelected();
  if (selectedFeatures.length === 0) return;

  const createdFeatures = [];
  const featuresUncombined = [];

  for (let i = 0; i < selectedFeatures.length; i++) {
    const feature = selectedFeatures[i];

    if (this.isInstanceOf('MultiFeature', feature)) {
      feature.getFeatures().forEach((subFeature) => {
        this.addFeature(subFeature);
        subFeature.properties = feature.properties;
        createdFeatures.push(subFeature.toGeoJSON());
        this.select([subFeature.id]);
      });
      this.deleteFeature(feature.id, { silent: true });
      featuresUncombined.push(feature.toGeoJSON());
    }
  }

  if (createdFeatures.length > 1) {
    this.map.fire(Constants.events.UNCOMBINE_FEATURES, {
      createdFeatures,
      deletedFeatures: featuresUncombined
    });
  }
  this.fireActionable();
};

export default SimpleSelect;

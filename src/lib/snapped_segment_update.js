import snapToFeature from './snap_to_feature.js';

/**
 * if applicable, insert a new point to the interpolated feature segment snap location
 * @param {Event} e
 * @param {MapboxGlDrawContext} ctx
 * @returns {void}
 */
export default function (e, ctx) {
  const nearestPoint = snapToFeature(e, ctx);
  if (nearestPoint.distance < Infinity) {
    // snapped!
    if (nearestPoint.interpolated) {
      const snappedFeature = ctx.store.get(nearestPoint.featureId);
      snappedFeature.addCoordinate(nearestPoint.path, nearestPoint.coords[0], nearestPoint.coords[1]);
    }
  }
}

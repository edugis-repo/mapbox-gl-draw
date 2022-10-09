import xtend from 'xtend';
import * as Constants from './constants';

import styles from './lib/theme';
import modes from './modes/index';

const defaultOptions = {
  defaultMode: Constants.modes.SIMPLE_SELECT,
  keybindings: true,
  touchEnabled: true,
  clickBuffer: 2,
  touchBuffer: 25,
  doubleTapBuffer: 12,
  boxSelect: true,
  displayControlsDefault: true,
  styles,
  modes,
  controls: {},
  userProperties: false,
  snapEnabled: true,
  snapClickBuffer: 20,
  snapTouchBuffer: 30,
  snapLayers: [
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
  ]
};

const showControls = {
  point: true,
  line_string: true,
  polygon: true,
  trash: true,
  combine_features: true,
  uncombine_features: true
};

const hideControls = {
  point: false,
  line_string: false,
  polygon: false,
  trash: false,
  combine_features: false,
  uncombine_features: false
};

function addSources(styles, sourceBucket) {
  return styles.map((style) => {
    if (style.source) return style;
    return xtend(style, {
      id: `${style.id}.${sourceBucket}`,
      source: (sourceBucket === 'hot') ? Constants.sources.HOT : Constants.sources.COLD
    });
  });
}

export default function(options = {}) {
  let withDefaults = xtend(options);

  if (!options.controls) {
    withDefaults.controls = {};
  }

  if (options.displayControlsDefault === false) {
    withDefaults.controls = xtend(hideControls, options.controls);
  } else {
    withDefaults.controls = xtend(showControls, options.controls);
  }

  withDefaults = xtend(defaultOptions, withDefaults);

  // Layers with a shared source should be adjacent for performance reasons
  withDefaults.styles = addSources(withDefaults.styles, 'cold').concat(addSources(withDefaults.styles, 'hot'));

  return withDefaults;
}

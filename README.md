# @edugis/mapbox-gl-draw

fork from @mapbox/mapbox-gl-draw

[![Build Status](https://travis-ci.org/mapbox/mapbox-gl-draw.svg?branch=main)](https://travis-ci.org/mapbox/mapbox-gl-draw)

Adds support for drawing and editing features on [mapbox-gl.js](https://www.mapbox.com/mapbox-gl-js/) maps. [See a live example here](https://www.mapbox.com/mapbox-gl-js/example/mapbox-gl-draw/)

**Requires [mapbox-gl-js](https://github.com/mapbox/mapbox-gl-js).** or **Requires [maplibre-gl-js](https://github.com/maplibre/maplibre-gl-js).**

### Installing

```
npm install @edugis/mapbox-gl-draw
```

Draw ships with CSS, make sure you include it in your build.

### Usage in your application

#### JavaScript

**When using modules**

```js
import mapboxgl from 'mapbox-gl';
import MapboxDraw from "@edugis/mapbox-gl-draw";
```

#### CSS

**When using modules**
 ```js
import '@edugis/mapbox-gl-draw/dist/mapbox-gl-draw.css'
 ```

### Typescript

Typescript definition files are available as part of the [DefinitelyTyped](https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/mapbox__mapbox-gl-draw) package.

```
npm install @types/mapbox__mapbox-gl-draw
```

### Example usage

```js
mapboxgl.accessToken = 'YOUR_ACCESS_TOKEN';

var map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/streets-v11',
  center: [40, -74.50],
  zoom: 9
});

var Draw = new MapboxDraw();

// Map#addControl takes an optional second argument to set the position of the control.
// If no position is specified the control defaults to `top-right`. See the docs
// for more details: https://docs.mapbox.com/mapbox-gl-js/api/#map#addcontrol

map.addControl(Draw, 'top-left');

map.on('load', function() {
  // ALL YOUR APPLICATION CODE
});
```

https://www.mapbox.com/mapbox-gl-js/example/mapbox-gl-draw/

### See [API.md](https://github.com/mapbox/mapbox-gl-draw/blob/main/docs/API.md) for complete reference.

### Enhancements and New Interactions

For additional functionality [check out our list of custom modes](https://github.com/mapbox/mapbox-gl-draw/blob/main/docs/MODES.md#available-custom-modes).

Mapbox Draw accepts functionality changes after the functionality has been proven out via a [custom mode](https://github.com/mapbox/mapbox-gl-draw/blob/main/docs/MODES.md#creating-modes-for-mapbox-draw). This lets users experiment and validate their mode before entering a review process, hopefully promoting innovation. When you write a custom mode, please open a PR adding it to our [list of custom modes](https://github.com/mapbox/mapbox-gl-draw/blob/main/docs/MODES.md#available-custom-modes).

### Developing and testing

Install dependencies, build the source files and crank up a server via:

```
git clone git@github.com:mapbox/mapbox-gl-draw.git
yarn install
yarn start & open "http://localhost:9967/debug/?access_token=<token>"
```

### Testing

```
npm run test
```

### Publishing

To GitHub and NPM:

```
npm version (major|minor|patch)
git push --tags
git push
npm publish
```

Update the version number in [the GL JS example](https://github.com/mapbox/mapbox-gl-js/blob/publisher-production/docs/pages/example/mapbox-gl-draw.html).

### Naming actions

We're trying to follow standards when naming things. Here is a collection of links where we look for inspiration.

- https://turfjs.org
- https://shapely.readthedocs.io/en/latest/manual.html


### debugging without publishing to npm
Once: in the mapbox-gl-draw project directory type:
```
npm link
```

Once: in the project that is using mapbox-gl-draw type:
```
npm link @edugis/mapbox-gl-draw
```

To build mapbox-gl-draw updates type:
```
npm run build
```

To use the newly built mapbox-gl-draw in your project, use: 
```
<script src="node_modules/@edugis/mapbox-gl-draw/dist/mapbox-gl-draw-unminified.js"></script>
```

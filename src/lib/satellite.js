// Only the SGP4 parts of satellite.js. Its main entry also pulls in a multithreaded
// WebAssembly build that we don't need (and that the bundler can't package).
export { json2satrec, twoline2satrec } from '../../node_modules/satellite.js/dist/io.js';
export { propagate, gstime } from '../../node_modules/satellite.js/dist/propagation.js';
export { eciToGeodetic, degreesLat, degreesLong } from '../../node_modules/satellite.js/dist/transforms.js';

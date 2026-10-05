// Loads the NASA textures and models from /public, cached so each file is fetched once.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

const base = (import.meta.env && import.meta.env.BASE_URL) || './';
export const assetUrl = (p) => `${base}${p}`.replace(/\/\.\//, '/');

const texCache = new Map();
const loader = new THREE.TextureLoader();

// Returns a texture immediately; the image streams in and the texture updates when ready.
export function tex(path, { srgb = true, repeat = null, anisotropy = 8 } = {}) {
  const key = `${path}|${srgb}|${repeat}`;
  if (texCache.has(key)) return texCache.get(key);
  const t = loader.load(assetUrl(path));
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = anisotropy;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat, repeat);
  }
  texCache.set(key, t);
  return t;
}

let gltf = null;
const modelCache = new Map();
export function loadModel(path) {
  if (!gltf) {
    gltf = new GLTFLoader();
    gltf.setMeshoptDecoder(MeshoptDecoder);
  }
  if (!modelCache.has(path)) {
    modelCache.set(path, new Promise((resolve, reject) => gltf.load(assetUrl(path), (g) => resolve(g.scene), undefined, reject)));
  }
  return modelCache.get(path).then((s) => s.clone(true));
}

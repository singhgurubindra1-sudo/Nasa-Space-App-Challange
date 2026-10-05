// Performance governor: watches the real frame rate and lowers the render resolution
// (then post-effects) when the device can't keep up, and raises it again when there is headroom.
export function createGovernor({ renderer, post, quality, onResize, target = 50 }) {
  const base = Math.min(window.devicePixelRatio || 1, quality.pixelRatio);
  const minScale = 0.55;
  let scale = 1;
  let acc = 0;
  let frames = 0;
  let cool = 2; // seconds before the first decision (let loading settle)
  let effectsCut = false;

  const apply = () => {
    renderer.setPixelRatio(base * scale);
    onResize();
  };

  return {
    // call once per rendered frame with the real time since the last rendered frame
    tick(dt) {
      acc += dt;
      frames += 1;
      cool -= dt;
      if (acc < 1.5) return;
      const fps = frames / acc;
      acc = 0;
      frames = 0;
      if (cool > 0) return;
      if (fps < target * 0.75 && scale > minScale) {
        scale = Math.max(minScale, scale - (fps < target * 0.5 ? 0.2 : 0.1));
        apply();
        cool = 1.5;
      } else if (fps < target * 0.6 && scale <= minScale && !effectsCut && post && post.reduce) {
        post.reduce(); // drop bloom/AO as a last resort
        effectsCut = true;
        cool = 2;
      } else if (fps > target * 1.1 && scale < 1) {
        scale = Math.min(1, scale + 0.05);
        apply();
        cool = 3;
      }
    },
    get scale() {
      return scale;
    },
  };
}

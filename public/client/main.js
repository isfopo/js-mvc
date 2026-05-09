// src/client/main.ts
console.log("js-mvc client loaded");
function throttle(fn, delay) {
  let lastCall = 0;
  return (...args) => {
    const now = Date.now();
    if (now - lastCall >= delay) {
      lastCall = now;
      fn(...args);
    }
  };
}
function onReady(cb) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", cb);
  } else {
    cb();
  }
}
onReady(() => {
  console.log("js-mvc DOM ready");
});
export {
  onReady,
  throttle
};
//# sourceMappingURL=main.js.map

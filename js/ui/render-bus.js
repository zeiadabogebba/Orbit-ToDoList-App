const renderers = {};
let getActiveTab = () => "today";

export function registerRenderer(tab, renderFn) {
  renderers[tab] = renderFn;
}

export function setActiveTabSource(fn) {
  getActiveTab = fn;
}

export function renderActive() {
  const render = renderers[getActiveTab()];
  if (render) render();
}

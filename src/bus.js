let render = () => {};

export function setRenderer(fn) {
  render = fn;
}

export function rerender(options) {
  render(options || {});
}

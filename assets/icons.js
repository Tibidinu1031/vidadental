(() => {
  'use strict';
  const namespace = 'http://www.w3.org/2000/svg';
  const names = new Set(['arrow-up-right', 'arrow-down', 'arrow-up', 'arrow-left', 'arrow-right', 'asterisk', 'star', 'plus', 'close', 'check', 'lock']);

  // The same inline symbol sheet is present in both HTML entry points.
  // SVG shapes keep their geometry and color on every platform, including iOS.
  function create(name) {
    if (!names.has(name)) throw new Error('Unknown icon: ' + name);
    const svg = document.createElementNS(namespace, 'svg');
    svg.setAttribute('class', 'icon');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    const use = document.createElementNS(namespace, 'use');
    use.setAttribute('href', '#icon-' + name);
    svg.append(use);
    return svg;
  }

  function stars(count = 5) {
    const fragment = document.createDocumentFragment();
    for (let i = 0; i < count; i++) fragment.append(create('star'));
    return fragment;
  }

  window.VIDA_ICONS = Object.freeze({create, stars});
})();

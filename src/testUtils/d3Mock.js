const SVG_NS = 'http://www.w3.org/2000/svg';
const SVG_TAGS = new Set(['svg', 'g', 'rect', 'path', 'circle', 'line', 'text', 'tspan']);

function createElement(tagName) {
  return SVG_TAGS.has(tagName)
    ? document.createElementNS(SVG_NS, tagName)
    : document.createElement(tagName);
}

function toArray(value) {
  return Array.from(value || []);
}

class Selection {
  constructor(nodes, parents = []) {
    this.nodes = nodes.filter(Boolean);
    this.parents = parents.filter(Boolean);
    this._enterData = [];
  }

  append(tagName) {
    const appended = [];

    if (this._enterData.length > 0) {
      this._enterData.forEach(({ parent, data }) => {
        data.forEach(datum => {
          const child = createElement(tagName);
          child.__data__ = datum;
          parent.appendChild(child);
          appended.push(child);
        });
      });
      return new Selection(appended, this.parents);
    }

    this.nodes.forEach(node => {
      const child = createElement(tagName);
      child.__data__ = node.__data__;
      node.appendChild(child);
      appended.push(child);
    });
    return new Selection(appended, this.nodes);
  }

  insert(tagName, beforeSelector) {
    const inserted = [];
    this.nodes.forEach(node => {
      const child = createElement(tagName);
      child.__data__ = node.__data__;
      const beforeNode = beforeSelector ? node.querySelector(beforeSelector) : null;
      node.insertBefore(child, beforeNode);
      inserted.push(child);
    });
    return new Selection(inserted, this.nodes);
  }

  select(selector) {
    const selected = this.nodes.map(node => node.querySelector(selector)).filter(Boolean);
    return new Selection(selected, this.nodes);
  }

  selectAll(selector) {
    const selected = this.nodes.flatMap(node => toArray(node.querySelectorAll(selector)));
    return new Selection(selected, this.nodes);
  }

  remove() {
    this.nodes.forEach(node => node.remove());
    return this;
  }

  attr(name, value) {
    if (value === undefined) {
      return this.nodes[0]?.getAttribute(name);
    }
    this.nodes.forEach((node, index) => {
      const nextValue = typeof value === 'function' ? value(node.__data__, index, this.nodes) : value;
      node.setAttribute(name, String(nextValue));
    });
    return this;
  }

  style(name, value) {
    if (value === undefined) {
      return this.nodes[0]?.style?.[name];
    }
    this.nodes.forEach((node, index) => {
      const nextValue = typeof value === 'function' ? value(node.__data__, index, this.nodes) : value;
      node.style[name] = String(nextValue);
    });
    return this;
  }

  text(value) {
    if (value === undefined) {
      return this.nodes[0]?.textContent || '';
    }
    this.nodes.forEach((node, index) => {
      const nextValue = typeof value === 'function' ? value(node.__data__, index, this.nodes) : value;
      node.textContent = nextValue == null ? '' : String(nextValue);
    });
    return this;
  }

  data(value) {
    const parents = this.parents.length ? this.parents : this.nodes;
    this._enterData = parents.map((parent, index) => {
      const data = typeof value === 'function' ? value(parent.__data__, index, parents) : value;
      return { parent, data: Array.from(data || []) };
    });
    return this;
  }

  datum(value) {
    this.nodes.forEach(node => {
      node.__data__ = value;
    });
    return this;
  }

  enter() {
    const enterSelection = new Selection([], this.parents);
    enterSelection._enterData = this._enterData;
    return enterSelection;
  }

  call(fn, ...args) {
    fn(this, ...args);
    return this;
  }

  on(type, listener) {
    this.nodes.forEach(node => {
      node.addEventListener(type, event => listener.call(node, event, node.__data__));
    });
    return this;
  }

  each(fn) {
    this.nodes.forEach((node, index) => fn.call(node, node.__data__, index, this.nodes));
    return this;
  }

  classed(className, enabled) {
    this.nodes.forEach((node, index) => {
      const nextValue = typeof enabled === 'function' ? enabled(node.__data__, index, this.nodes) : enabled;
      node.classList.toggle(className, Boolean(nextValue));
    });
    return this;
  }

  raise() {
    this.nodes.forEach(node => node.parentNode?.appendChild(node));
    return this;
  }
}

function select(target) {
  if (typeof target === 'string') {
    return new Selection([document.querySelector(target)].filter(Boolean));
  }
  return new Selection([target].filter(Boolean));
}

function makeContinuousScale(transform = value => value) {
  let domain = [0, 1];
  let range = [0, 1];
  const scale = value => {
    const transformedDomain = domain.map(transform);
    const transformedValue = transform(value);
    const ratio = (transformedValue - transformedDomain[0]) / (transformedDomain[1] - transformedDomain[0] || 1);
    return range[0] + ratio * (range[1] - range[0]);
  };
  scale.domain = next => (next === undefined ? domain : (domain = next, scale));
  scale.range = next => (next === undefined ? range : (range = next, scale));
  scale.nice = () => scale;
  scale.ticks = (count = 5) => Array.from({ length: count }, (_, index) => domain[0] + ((domain[1] - domain[0]) * index) / Math.max(1, count - 1));
  return scale;
}

function scaleBand() {
  let domain = [];
  let range = [0, 1];
  const scale = value => {
    const index = domain.indexOf(value);
    if (index < 0) return undefined;
    return range[0] + index * scale.bandwidth();
  };
  scale.domain = next => (next === undefined ? domain : (domain = next, scale));
  scale.range = next => (next === undefined ? range : (range = next, scale));
  scale.padding = () => scale;
  scale.bandwidth = () => {
    const span = Math.abs(range[1] - range[0]);
    // Deliberately simple band spacing for DOM-focused tests.
    return span / Math.max(1, domain.length);
  };
  return scale;
}

function scaleOrdinal() {
  let domain = [];
  let range = [];
  const scale = value => {
    const index = domain.indexOf(value);
    return range[index < 0 ? 0 : index % Math.max(1, range.length)];
  };
  scale.domain = next => (next === undefined ? domain : (domain = next, scale));
  scale.range = next => (next === undefined ? range : (range = next, scale));
  return scale;
}

function values(data, accessor = d => d) {
  return Array.from(data || [], accessor).filter(value => value != null && !Number.isNaN(value));
}

function max(data, accessor) {
  const nums = values(data, accessor);
  return nums.length ? Math.max(...nums) : undefined;
}

function min(data, accessor) {
  const nums = values(data, accessor);
  return nums.length ? Math.min(...nums) : undefined;
}

function extent(data, accessor) {
  return [min(data, accessor), max(data, accessor)];
}

function group(data, accessor) {
  const result = new Map();
  Array.from(data || []).forEach(item => {
    const key = accessor(item);
    if (!result.has(key)) result.set(key, []);
    result.get(key).push(item);
  });
  return result;
}

function groups(data, accessor) {
  return Array.from(group(data, accessor).entries());
}

function axisFactory(scale) {
  return selection => {
    const ticks = scale.domain ? scale.domain() : [];
    ticks.forEach(tick => {
      const tickGroup = selection.append('g').attr('class', 'tick');
      tickGroup.append('text').text(tick);
    });
  };
}

function axisBottom(scale) {
  const axis = axisFactory(scale);
  axis.tickSize = () => axis;
  axis.ticks = () => axis;
  axis.tickValues = () => axis;
  return axis;
}

function axisLeft(scale) {
  const axis = axisFactory(scale);
  axis.ticks = () => axis;
  axis.tickValues = () => axis;
  return axis;
}

function pathGenerator() {
  const generator = () => 'M0,0';
  generator.x = () => generator;
  generator.y = () => generator;
  generator.y0 = () => generator;
  generator.y1 = () => generator;
  return generator;
}

module.exports = {
  select,
  scaleBand,
  scaleOrdinal,
  scaleLinear: () => makeContinuousScale(),
  scaleLog: () => makeContinuousScale(value => Math.log10(value || 1)),
  max,
  min,
  extent,
  group,
  groups,
  axisBottom,
  axisLeft,
  area: pathGenerator,
  line: pathGenerator,
};

import * as d3 from 'd3';
import React, { useEffect, useRef, useState } from 'react';

const DoseResponseCurves = ({ points, curves }) => {
  console.log("plotting dose response");
  console.log("points", points);
  console.log("curves", curves);
  const svgRef = useRef();
  const [page, setPage] = useState(0);

  useEffect(() => {
    if (!points || !curves) return;

    const flatPoints = points.flat();
    const flatCurves = curves.flat();

    const container = d3.select(svgRef.current);
    container.selectAll('*').remove();

    const groupedPoints = d3.group(flatPoints, d => d.pep_grouping_key);
    const groupedCurves = d3.group(flatCurves, d => d.pep_grouping_key);

    const keys = Array.from(groupedPoints.keys());
    const plotsPerPage = 8;
    const start = page * plotsPerPage;
    const end = start + plotsPerPage;
    const visibleKeys = keys.slice(start, end);

    const margin = { top: 30, right: 20, bottom: 40, left: 60 };
    const fullWidth = 300;
    const fullHeight = 250;
    const width = fullWidth - margin.left - margin.right;
    const height = fullHeight - margin.top - margin.bottom;

    visibleKeys.forEach(key => {
      const pointData = groupedPoints.get(key);
      const curveData = groupedCurves.get(key);
      if (!curveData || !pointData) return;

      const wrapper = container.append("div")
        .attr("class", "plot-wrapper");

      const svg = wrapper.append("svg")
        .attr("viewBox", `0 0 ${fullWidth} ${fullHeight}`)
        .attr("preserveAspectRatio", "xMidYMid meet")
        .style("width", "90%")
        .style("height", "auto");

      const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

      const x = d3.scaleLog()
        .domain(d3.extent(curveData, d => d.dose))
        .range([0, width]);

      const y = d3.scaleLinear()
        .domain([
          d3.min([...pointData.map(d => d.normalised_intensity_log2), ...curveData.map(d => d.lower)]) - 1,
          d3.max([...pointData.map(d => d.normalised_intensity_log2), ...curveData.map(d => d.upper)]) + 1
        ])
        .range([height, 0]);

      g.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x).ticks(5, ".1s"));

      g.append("g").call(d3.axisLeft(y));

      g.append("path")
        .datum(curveData)
        .attr("fill", "#f6d5eb")
        .attr("stroke", "none")
        .attr("d", d3.area()
          .x(d => x(d.dose))
          .y0(d => y(d.lower))
          .y1(d => y(d.upper))
        );

      g.append("path")
        .datum(curveData)
        .attr("fill", "none")
        .attr("stroke", "black")
        .attr("stroke-width", 2)
        .attr("d", d3.line()
          .x(d => x(d.dose))
          .y(d => y(d.prediction))
        );

      g.selectAll("circle")
        .data(pointData)
        .enter()
        .append("circle")
        .attr("cx", d => x(d.dose))
        .attr("cy", d => y(d.normalised_intensity_log2))
        .attr("r", 2.5)
        .attr("fill", "#da49a9");

      g.append("text")
      .attr("x", width / 2)
      .attr("y", -10)
      .attr("text-anchor", "middle")
      .attr("font-size", "17px") // Set to match your site-wide text size
      .attr("font-family", "Raleway, Arial, sans-serif")
      .text(key);
    });

  }, [points, curves, page]);

  const totalPages = Math.ceil(((points && d3.group(points.flat(), d => d.pep_grouping_key).size) || 0) / 8);

  return (
    <div>
      <div
        ref={svgRef}
        className="dose-response-d3-container"
      />
      {totalPages > 1 && (
          <div className="plot-grid-wrapper">
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>
            &lt;
          </button>
          <span>Page {page + 1} of {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page === totalPages - 1}>
            &gt;
          </button>
        </div>
      )}
    </div>
  );
};

export default DoseResponseCurves;

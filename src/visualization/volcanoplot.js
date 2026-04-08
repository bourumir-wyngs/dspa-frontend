import * as d3 from 'd3';
import React, { useEffect, useRef, useState } from 'react';


const COLOR_HIGHLIGHTED_PROTEIN = '#ffa500';
const COLOR_UP = '#d62728';
const COLOR_DOWN = '#1f77b4';
const COLOR_OTHER = '#d9d9d9';

// Significance cutoffs for volcano plots
const CUTOFF_ADJ_P = 0.05;
const CUTOFF_LOG2FC = 1;
const COLOR_CUTOFF_LINE = '#7f7f7f';

// Hover / selection color for peptides
const COLOR_SELECTED_PEPTIDE = 'rgba(54,204,0,0.69)';

const COLOR_TOOLTIP_BG = 'white';
const COLOR_TOOLTIP_BORDER = 'black';




const VolcanoPlot = ({ differentialAbundanceDataList, highlightedProtein=null}) => {
  const svgRef = useRef();
  const [page, setPage] = useState(0);
  const [showAll, setShowAll] = useState(false);


  function cssSafeKey(key) {
    return key.replace(/[^\w-]/g, '_'); 
  }

  function getBaseFill(d) {
    if (d.pg_protein_accessions === highlightedProtein) return COLOR_HIGHLIGHTED_PROTEIN;

    const isSignificant = (d.adj_pval != null) && (d.adj_pval < CUTOFF_ADJ_P) && (Math.abs(d.diff) > CUTOFF_LOG2FC);
    if (!isSignificant) return COLOR_OTHER;

    if (d.diff > 0) return COLOR_UP; // significant up
    if (d.diff < 0) return COLOR_DOWN; // significant down
    return COLOR_OTHER;
  }
  
  function highlightOthers(pepKey, shouldHighlight) {
    const className = `.pep-key-${cssSafeKey(pepKey)}`;
    const container = d3.select(svgRef.current);
  
    container.selectAll(className)
      .classed('is-hovered', shouldHighlight)
      .attr('fill', function(d) {
        return shouldHighlight ? COLOR_SELECTED_PEPTIDE : getBaseFill(d);
      })
      .attr('r', shouldHighlight ? 4.5 : 3)
      .attr('stroke', function(d) {
         if (shouldHighlight) return COLOR_SELECTED_PEPTIDE;
         return d.pg_protein_accessions === highlightedProtein ? 'black' : 'none';
      })
      .attr('stroke-width', function(d) {
         if (shouldHighlight) return 1.5;
         return d.pg_protein_accessions === highlightedProtein ? 1.5 : 0;
      })
      .each(function() {
        if (shouldHighlight) {
          d3.select(this).raise();
        }
      });
  }

  function downloadCSV() {
    if (!Array.isArray(differentialAbundanceDataList)) return;

    const rows = [["Experiment ID", "Comparison", "Peptide Key", "Protein Accession", "Fold Change (log2)", "q-value"]];
    differentialAbundanceDataList.forEach(exp => {
      exp.data.forEach(d => {
        rows.push([
          exp.experimentID,
          exp.dose || exp.experimentID,
          d.pep_grouping_key,
          d.pg_protein_accessions,
          d.diff,
          d.adj_pval
        ]);
      });
    });

    const csvContent = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "differential_abundance_data.csv");
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  

  useEffect(() => {
    if (!Array.isArray(differentialAbundanceDataList) || differentialAbundanceDataList.length === 0) return;

    const container = d3.select(svgRef.current);
    container.selectAll('*').remove(); 
    const sortedDataList = [...differentialAbundanceDataList].sort((a, b) => {
      const aStats = getAxisRange(a.data);
      const bStats = getAxisRange(b.data);
      return (bStats.xRange + bStats.yRange) - (aStats.xRange + aStats.yRange);
    });

    const allData = sortedDataList.flatMap(exp => exp.data);
    const cutoffY = -Math.log10(CUTOFF_ADJ_P);
    const yMax = Math.max(d3.max(allData, d => -Math.log10(d.adj_pval)) ?? 0, cutoffY);
    
    const plotsPerPage = 2;
    const start = showAll ? 0 : page * plotsPerPage;
    const end = showAll ? sortedDataList.length : start + plotsPerPage;


    const margin = { top: 30, right: 40, bottom: 50, left: 50 };


    const fullWidth =  270;
    const fullHeight = 270;

    const width = fullWidth - margin.left - margin.right;
    const height = fullHeight - margin.top - margin.bottom;


    const visibleData = sortedDataList.slice(start, end);

    visibleData.forEach(exp => {
      const data = exp.data;
      const title = exp?.dose ?? exp.experimentID;

      const wrapper = container.append("div")
        .attr("class", "plot-wrapper");

      const svg = wrapper.append("svg")
        .attr("viewBox", `0 0 ${fullWidth} ${fullHeight}`)
        .attr("preserveAspectRatio", "xMidYMid meet")
        .style("width", "100%")
        .style("height", "100%");
      
      const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

      const rawXExtent = d3.extent(allData, d => d.diff);
      const xPadding = 0.5 * (rawXExtent[1] - rawXExtent[0]) * 0.05; // 5% padding
      const xExtent = [rawXExtent[0] - xPadding, rawXExtent[1] + xPadding];


      const x = d3.scaleLinear().domain(xExtent).range([0, width]);
      const y = d3.scaleLinear().domain([-0.5, yMax]).range([height, 0]);

      // Cutoff guide lines
      g.append('line')
        .attr('x1', x(-CUTOFF_LOG2FC))
        .attr('x2', x(-CUTOFF_LOG2FC))
        .attr('y1', 0)
        .attr('y2', height)
        .attr('stroke', COLOR_CUTOFF_LINE)
        .attr('stroke-dasharray', '4,3')
        .attr('stroke-width', 1);

      g.append('line')
        .attr('x1', x(CUTOFF_LOG2FC))
        .attr('x2', x(CUTOFF_LOG2FC))
        .attr('y1', 0)
        .attr('y2', height)
        .attr('stroke', COLOR_CUTOFF_LINE)
        .attr('stroke-dasharray', '4,3')
        .attr('stroke-width', 1);

      g.append('line')
        .attr('x1', 0)
        .attr('x2', width)
        .attr('y1', y(cutoffY))
        .attr('y2', y(cutoffY))
        .attr('stroke', COLOR_CUTOFF_LINE)
        .attr('stroke-dasharray', '4,3')
        .attr('stroke-width', 1);


      const tooltip = g.append("g")
          .style("display", "none");

      tooltip.append("text")
          .attr("class", "pep-key-label")
          .attr("x", 10)
          .attr("y", 20)

      tooltip.append("text")
          .attr("class", "protein-name-label")
          .attr("x", 10)
          .attr("y", 35)

      const tooltipBackground = tooltip.insert("rect", "text")
		  .attr("fill", COLOR_TOOLTIP_BG)
		  .attr("stroke", COLOR_TOOLTIP_BORDER)
          .attr("stroke-width", "0.5px")
          .attr("x", -5)
          .attr("y", -5)
          .attr("width", 0)
          .attr("height", 0);

      g.append("g")
          .attr("transform", `translate(0,${height})`)
          .call(d3.axisBottom(x).ticks(5));

      g.append("text")
        .attr("text-anchor", "middle")
        .attr("x", width / 2)
        .attr("y", height + 40)
        .attr("font-size", "12px")
        .text("log2 Fold Change");
  
      g.append("g").call(d3.axisLeft(y));

      g.append("text")
        .attr("text-anchor", "middle")
        .attr("transform", `rotate(-90)`)
        .attr("x", -height / 2)
        .attr("y", -40)
        .attr("font-size", "12px")
        .text("-log10 Adjusted P-Value");

      g.selectAll("circle")
        .data(data)
        .enter()
        .append("circle")
        .attr("cx", d => x(d.diff))
        .attr("cy", d => y(-Math.log10(d.adj_pval)))
        .attr("r", 3)
        .attr("class", d => `pep-key-${cssSafeKey(d.pep_grouping_key)}`)
        .style("fill", d => getBaseFill(d))
        .attr("stroke", d => d.pg_protein_accessions === highlightedProtein ? 'black' : 'none')
        .attr("stroke-width", d => d.pg_protein_accessions === highlightedProtein ? 1.5 : 0)
        .each(function(d) {
          if (d.pg_protein_accessions === highlightedProtein) {
            d3.select(this).raise(); 
          }
        })
        .on("mouseover", function (event, d) {
          container.selectAll('.is-hovered')
            .classed('is-hovered', false)
            .attr('fill', c => getBaseFill(c))
            .attr('r', 3)
            .attr('stroke', c => c.pg_protein_accessions === highlightedProtein ? 'black' : 'none')
            .attr('stroke-width', c => c.pg_protein_accessions === highlightedProtein ? 1.5 : 0);
        
          tooltipBackground.attr("width", 0).attr("height", 0);
          d3.select(this)
            .classed('is-hovered', true)
			.attr("fill", COLOR_SELECTED_PEPTIDE)
            .attr("r", 4.5)
			.attr("stroke", COLOR_SELECTED_PEPTIDE)
            .attr("stroke-width", 1.5);
        
          highlightOthers(d.pep_grouping_key, true);
        
          const tooltip = d3.select("#html-tooltip");
          tooltip
            .style("visibility", "visible")
            .style("opacity", 1)
            .html(`
              <strong>Pep Key:</strong> ${d.pep_grouping_key}<br/>
              <strong>Protein:</strong> ${d.pg_protein_accessions}
            `)
            ;
        })
        
        .on("mouseout", function (event, d) {
          d3.select(this)
            .classed('is-hovered', false)
            .attr("fill", getBaseFill(d))
            .attr("r", 3)
            .attr("stroke", d.pg_protein_accessions === highlightedProtein ? 'black' : 'none')
            .attr("stroke-width", d.pg_protein_accessions === highlightedProtein ? 1.5 : 0);

          highlightOthers(d.pep_grouping_key, false);
          d3.select("#html-tooltip")
            .style("opacity", 0)
            .style("visibility", "hidden");

        });

      g.append("text")
        .attr("x", width / 2)
        .attr("y", -10)
        .attr("text-anchor", "middle")
        .attr("font-size", "17px")
        .attr("font-family", "Raleway, Arial, sans-serif")
        .text(title);
    });
  }, [differentialAbundanceDataList, highlightedProtein, page, showAll]);

  const totalPages = Math.ceil((differentialAbundanceDataList?.length || 0) / 2);

  return (
    <div>
      {/* Centered Legend and Buttons */}
     
      <div className="volcano-plot-legend">
            {highlightedProtein && (
          <div className="volcano-plot-legend-item">
            <div
              style={{
				backgroundColor: COLOR_HIGHLIGHTED_PROTEIN,
                border: '1.5px solid black',
                borderRadius: '50%',
                width: 18,
                height: 18,
              }}
            />
            <span>Peptides in {highlightedProtein}</span>
          </div>
        )}
        <div className="volcano-plot-legend-item">
          <div style={{ backgroundColor: COLOR_UP, borderRadius: '50%', width: 18, height: 18 }} />
          <span>Up (adj.p &lt; {CUTOFF_ADJ_P}, log2FC &gt; {CUTOFF_LOG2FC})</span>
        </div>
        <div className="volcano-plot-legend-item">
          <div style={{ backgroundColor: COLOR_DOWN, borderRadius: '50%', width: 18, height: 18 }} />
          <span>Down (adj.p &lt; {CUTOFF_ADJ_P}, log2FC &lt; -{CUTOFF_LOG2FC})</span>
        </div>
        <div className="volcano-plot-legend-item">
          <div style={{ backgroundColor: COLOR_OTHER, borderRadius: '50%', width: 18, height: 18 }} />
          <span>Not significant</span>
        </div>
        <div className="volcano-plot-legend-item">
          <div style={{ backgroundColor: COLOR_SELECTED_PEPTIDE, borderRadius: '50%', width: 18, height: 18 }} />
          <span>Selected Peptide</span>
        </div>
  

        </div>
        <div style={{ position: 'relative' }}>
        <div id="html-tooltip" className="html-tooltip-volcano" />
        <div
          className={`volcano-plot-section ${showAll ? 'volcano-plot-section-expanded' : ''}`}
          ref={svgRef}
        />


      {!showAll && totalPages > 1 && (
        <div className="plot-grid-wrapper-volcano">
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>
            &lt;
          </button>
          <span>Page {page + 1} of {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page === totalPages - 1}>
            &gt;
          </button>
        </div>
      )}
      <div className="volcano-plot-controls" style={{ marginTop: '10px', marginBottom: '10px' }}>
      {(differentialAbundanceDataList?.length || 0) > 2 && (
        <button onClick={() => setShowAll(prev => !prev)}>
          {showAll ? 'Show Less' : 'Show All'}
        </button>
      )}
      <button onClick={downloadCSV} className="download-button">
        Download CSV
      </button>
    </div>



    </div>
    </div>
    
  );
  
};


function getAxisRange(data) {
  const xExtent = d3.extent(data, d => d.diff);
  const yValues = data.map(d => -Math.log10(d.adj_pval));
  const yExtent = d3.extent(yValues);
  return {
    xRange: Math.abs(xExtent[1] - xExtent[0]),
    yRange: Math.abs(yExtent[1] - yExtent[0])
  };
}

export default VolcanoPlot;
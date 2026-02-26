import * as d3 from 'd3';
import React, { useEffect, useRef } from 'react';

function wrapText(selection, maxWidth, maxCharsPerLine = 25, maxLines = 25) {
    selection.each(function () {
        const text = d3.select(this);
        const fullText = text.text();
        const words = fullText.match(new RegExp(`.{1,${maxCharsPerLine}}`, 'g')) || [];
        const y = text.attr("y") || 0;
        const x = text.attr("x") || 0;
        const dy = parseFloat(text.attr("dy")) || 0;
        const lineHeight = 1.2;
        let lineNumber = 0;

        text.text(null);

        words.slice(0, maxLines).forEach((line, i) => {
            const tspan = text.append("tspan")
                .attr("x", x)
                .attr("y", y)
                .attr("dy", `${lineNumber * lineHeight + dy}em`)
                .text(line);
            lineNumber++;
        });

        if (words.length > maxLines) {
            text.append("tspan")
                .attr("x", x)
                .attr("y", y)
                .attr("dy", `${lineNumber * lineHeight + dy}em`)
                .text("...");
        }

        text.attr("transform", `rotate(-45)`)
            .style("text-anchor", "end");
    });
}

const GOEnrichmentVisualization = ({ goEnrichmentData, onProteinSelect=null }) => {
    console.log("goenruichmentdata", goEnrichmentData);
    const chartRef = useRef();

    useEffect(() => {
        if (!goEnrichmentData || goEnrichmentData.length === 0) return;

        const container = d3.select(chartRef.current);
        container.selectAll("*").remove();

        const dynaprotColors = [
            "#be9fd2", "#d89853", "#b3c5da", "#d35eb6", "#71b6c8", "#d9ce74", "#99c2c5"
        ];

        const experimentIDs = Array.from(new Set(goEnrichmentData.map(d => d.dpx_comparison)));
        const maxAdjPValLog = d3.max(goEnrichmentData, d => -Math.log10(d.adj_pval) || 0);

        const colorScale = d3.scaleOrdinal()
            .domain(experimentIDs)
            .range(dynaprotColors);

        const groupedData = d3.groups(goEnrichmentData, d => d.go_term);
            const numberOfGoTerms = groupedData.length;
            

        const maxLabelWidth = d3.max(experimentIDs, id => (id ? id.length * 12 : 0));
        const margin = { top: 50, right: maxLabelWidth + 20, bottom: 250, left: 100 };
            
        const minWidth = 600;
        const widthPerTerm = 80; 
        const containerWidth = Math.max(minWidth, numberOfGoTerms * widthPerTerm + margin.left + margin.right);
        
            
        const dynamicHeight = 400;
        const width = containerWidth - margin.left - margin.right;
        const height = dynamicHeight - margin.top - margin.bottom;
            

        const svg = container.append("svg")
            .attr("width", containerWidth)
            .attr("height", height + margin.top + margin.bottom)
            .append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

        const xScale = d3.scaleBand()
            .domain(groupedData.map(d => d[0]))
            .range([0, width])
            .padding(numberOfGoTerms > 5 ? 0.2 : 0.5);

        const xSubgroup = d3.scaleBand()
            .domain(experimentIDs)
            .range([0, xScale.bandwidth()])
            .padding(0.05);

        const yScale = d3.scaleLinear()
            .domain([0, maxAdjPValLog])
            .nice()
            .range([height, 0]);

        const tooltip = container.append("div")
            .attr("class", "go-tooltip") 
            .style("opacity", 0)
            .style("pointer-events", "none");
        
        svg.append("g")
            .attr("transform", `translate(0, ${height})`)
            .call(d3.axisBottom(xScale))
            .selectAll(".tick text")
            .style("text-anchor", "middle")
            .call(wrapText, xScale.bandwidth());

        const yTickValues = yScale.ticks().filter((_, i) => i % 2 === 0); // draw every second tick
        svg.append("g").call(d3.axisLeft(yScale).tickValues(yTickValues));

        const barGroups = svg.selectAll("g.bar")
            .data(groupedData)
            .enter().append("g")
            .attr("transform", d => `translate(${xScale(d[0])}, 0)`);

        barGroups.selectAll("rect")
            .data(d => d[1].map(data => ({
                ...data,
                experimentID: data.dpx_comparison
            })))
            .enter().append("rect")
            .attr("x", d => xSubgroup(d.experimentID))
            .attr("y", d => yScale(-Math.log10(d.adj_pval)))
            .attr("width", xSubgroup.bandwidth())
            .attr("height", d => height - yScale(-Math.log10(d.adj_pval)))
            .attr("fill", d => colorScale(d.experimentID))
            .on("mouseover", (event, d) => {
                const bounds = container.node().getBoundingClientRect();
                const mouseX = event.clientX - bounds.left;
                const mouseY = event.clientY - bounds.top;
            
                tooltip
                    .html(() => {
                        const proteins = d.accessions.split(',');
                        return `<strong>Proteins:</strong><br>${proteins.map(p => `<div class="tooltip-protein" data-accession="${p}">${p}</div>`).join('')}`;
                    })
                    .style("left", `${mouseX + 10}px`)
                    .style("top", `${mouseY - 20}px`)
                    .transition().duration(200)
                    .style("opacity", 1);
                tooltip.selectAll(".tooltip-protein")
                    .on("click", function() {
                        const protein = d3.select(this).attr("data-accession");
                        if (onProteinSelect) {
                            onProteinSelect(protein);
                        }
                    });
            })
            .on("mouseout", () => {
                tooltip.transition().duration(200)
                    .style("opacity", 0);
            })
            .on("click", (event, d) => {
                const accessions = d.accessions.split(',');
                if (accessions.length > 0 && onProteinSelect) {
                    onProteinSelect(accessions[0]); 
                }
            });

        const legend = svg.append("g")
            .attr("class", "legend")
            .attr("transform", `translate(${width - 20}, 20)`);

        experimentIDs.forEach((id, index) => {
            legend.append("rect")
                .attr("x", 0)
                .attr("y", index * 20)
                .attr("width", 15)
                .attr("height", 15)
                .attr("fill", colorScale(id));

            legend.append("text")
                .attr("x", 20)
                .attr("y", index * 20 + 10)
                .attr("dy", "0.35em")
                .text(id);
        });

        svg.append("text")
            .attr("x", width / 2)
            .attr("y", -10)
            .attr("text-anchor", "middle")
            .text("Grouped Bar Plot of GO Enrichment by Experiment");

        svg.append("text")
            .attr("class", "ylabel")
            .attr("x", -height / 2)
            .attr("y", -50)
            .attr("text-anchor", "middle")
            .attr("transform", "rotate(-90)")
            .text("-log10(Adj-pValue)");
    }, [goEnrichmentData, onProteinSelect]);

    return (
        <div ref={chartRef} className="go-enrichment-visualization" />
    );
};

export default GOEnrichmentVisualization;

document.addEventListener('DOMContentLoaded', function () {

    // --- 1. Initialize Leaflet Map ---
    const map = L.map('map').setView([39.8283, -98.5795], 4); // Centered on US

    // Add OpenStreetMap base tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    // --- 2. Voter Turnout Data (2020 VEP Turnout %) ---
    // Source: U.S. Elections Project (http://www.electproject.org/2020g)
    // Data represents: (Total Ballots Counted / Voting Eligible Population)
    const turnoutData = {
        "Alabama": 62.9, "Alaska": 68.8, "Arizona": 65.6, "Arkansas": 56.1,
        "California": 63.8, "Colorado": 76.4, "Connecticut": 71.4, "Delaware": 70.6,
        "District of Columbia": 64.8, "Florida": 71.7, "Georgia": 67.8, "Hawaii": 57.5,
        "Idaho": 67.2, "Illinois": 70.3, "Indiana": 61.3, "Iowa": 73.2,
        "Kansas": 66.9, "Kentucky": 64.6, "Louisiana": 63.5, "Maine": 79.2,
        "Maryland": 71.2, "Massachusetts": 73.4, "Michigan": 73.7, "Minnesota": 80.0,
        "Mississippi": 60.4, "Missouri": 66.2, "Montana": 73.0, "Nebraska": 71.7,
        "Nevada": 68.0, "New Hampshire": 75.7, "New Jersey": 73.1, "New Mexico": 60.8,
        "New York": 65.3, "North Carolina": 71.9, "North Dakota": 64.2, "Ohio": 68.6,
        "Oklahoma": 55.0, "Oregon": 75.4, "Pennsylvania": 70.9, "Rhode Island": 69.4,
        "South Carolina": 64.3, "South Dakota": 67.5, "Tennessee": 59.4, "Texas": 60.4,
        "Utah": 73.4, "Vermont": 74.0, "Virginia": 72.0, "Washington": 75.5,
        "West Virginia": 59.9, "Wisconsin": 75.8, "Wyoming": 66.1
    };

    // --- 3. D3 Color Scale ---
    // Using a quantized scale: breaks data into ranges mapped to colors
    const colorScale = d3.scaleQuantize()
        .domain([50, 85]) // Approximate min/max turnout percentages for color range
        .range([ // Example ColorBrewer sequential scheme (Blues) - adjust as needed
            "#eff3ff",
            "#c6dbef",
            "#9ecae1",
            "#6baed6",
            "#4292c6",
            "#2171b5",
            "#084594"
        ]);

    // --- 4. Load and Process GeoJSON ---
    let geoJsonLayer; // To hold the GeoJSON layer

    fetch('us-states.json') // Make sure us-states.json is in the same directory
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}. Could not load us-states.json.`);
            }
            return response.json();
        })
        .then(geoJsonData => {
            console.log("GeoJSON loaded successfully.");

            // Add turnout data to GeoJSON properties
            geoJsonData.features.forEach(feature => {
                const stateName = feature.properties.name; // Adjust if property name differs
                feature.properties.turnout = turnoutData[stateName] || 0; // Default to 0 if no data
            });

            // --- 5. Create Leaflet GeoJSON Layer ---
            geoJsonLayer = L.geoJson(geoJsonData, {
                style: styleFeature,
                onEachFeature: onEachFeature
            }).addTo(map);

            console.log("GeoJSON layer added to map.");

            // --- 6. Add Legend ---
            addLegend(map, colorScale);

        })
        .catch(error => {
            console.error("Error loading or processing GeoJSON:", error);
            // Display error message to the user
            const mapDiv = document.getElementById('map');
            mapDiv.innerHTML = `<p style="color: red; text-align: center; margin-top: 50px;">Error: Could not load map data. Please ensure 'us-states.json' is present and accessible. Details: ${error.message}</p>`;
            mapDiv.style.height = '150px'; // Adjust height for error message
        });


    // --- Helper Functions ---

    // Function to determine style based on turnout
    function styleFeature(feature) {
        const turnout = feature.properties.turnout;
        return {
            fillColor: turnout > 0 ? colorScale(turnout) : '#cccccc', // Use color scale or grey for no data
            weight: 1,          // Border weight
            opacity: 1,         // Border opacity
            color: 'white',    // Border color
            fillOpacity: 0.8    // Fill opacity
        };
    }

    // Function to handle interactions for each feature (state)
    function onEachFeature(feature, layer) {
        // Bind tooltip
        const stateName = feature.properties.name;
        const turnout = feature.properties.turnout;
        const tooltipContent = `<b>${stateName}</b><br>${turnout > 0 ? turnout.toFixed(1) + '%' : 'No data'} turnout`;
        layer.bindTooltip(tooltipContent);

        // Optional: Add hover effects (highlight)
        layer.on({
            mouseover: highlightFeature,
            mouseout: resetHighlight
            // click: zoomToFeature // Optional: zoom on click
        });
    }

    // Highlight feature on mouseover
    function highlightFeature(e) {
        const layer = e.target;
        layer.setStyle({
            weight: 3,
            color: '#666',
            fillOpacity: 0.9
        });

        if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
            layer.bringToFront();
        }
    }

    // Reset highlight on mouseout
    function resetHighlight(e) {
         if (geoJsonLayer) { // Check if layer exists before resetting
           geoJsonLayer.resetStyle(e.target);
         }
    }

    // Optional: Zoom to feature on click
    // function zoomToFeature(e) {
    //     map.fitBounds(e.target.getBounds());
    // }


    // Function to add the legend control
    function addLegend(map, scale) {
        const legend = L.control({ position: 'bottomright' });

        legend.onAdd = function () {
            const div = L.DomUtil.create('div', 'info legend');
            const grades = scale.range().map(color => scale.invertExtent(color)); // Get ranges for colors
            const labels = [];

            div.innerHTML = '<h4>Voter Turnout (%)</h4>';

            // Loop through ranges and generate a label with a colored square for each interval
            // Note: D3 v7 invertExtent gives one value for point scales,
            // and we need pairs for ranges for quantize. We'll infer ranges.
            const thresholds = [scale.domain()[0], ...scale.quantiles(), scale.domain()[1]];

            for (let i = 0; i < thresholds.length - 1; i++) {
                const from = thresholds[i];
                const to = thresholds[i + 1];
                const color = scale(from + (to - from) / 2); // Get color for midpoint of range

                labels.push(
                    '<i style="background:' + color + '"></i> ' +
                    from.toFixed(0) + (to ? '&ndash;' + to.toFixed(0) : '+') + '%'
                );
            }

            div.innerHTML += labels.join('<br>');
            return div;
        };

        legend.addTo(map);
        console.log("Legend added to map.");
    }

}); // End DOMContentLoaded
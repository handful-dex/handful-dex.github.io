// static/js/tcp_plots.js

// ─────────────────────────────────────────────────────────────────────────────
// GEOMETRY  (mirrors Python get_palm_bounding_box_corners_in_tcp_frame
//            and get_finger_schematic with the updated parameters)
// ─────────────────────────────────────────────────────────────────────────────
const PALM_BOX = {
  x: [-0.0375, 0.0425],
  y: [-0.0655, 0.0595],
  z: [-0.12,  -0.074],
};

const FINGER_BOXES = [
  { name: 'Index',  x: [-0.1895, -0.0395], y: [0.0285,   0.0575],  z: [-0.104, -0.076] },
  { name: 'Middle', x: [-0.1895, -0.0395], y: [-0.01695,  0.01205], z: [-0.104, -0.076] },
  { name: 'Ring',   x: [-0.1895, -0.0395], y: [-0.0624,  -0.0334],  z: [-0.104, -0.076] },
  { name: 'Thumb',  x: [0.0135,   0.0425], y: [0.0615,    0.1715],  z: [-0.104, -0.076] },
];




// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Build a 12-edge wireframe box as a single scatter3d trace. */
function boxTrace3D(box, color, name) {
  const [x0, x1] = box.x, [y0, y1] = box.y, [z0, z1] = box.z;
  // Walk all 12 edges; NaN separates them so Plotly draws separate segments.
  const X=[], Y=[], Z=[];
  const edges = [
    [[x0,y0,z0],[x1,y0,z0]], [[x1,y0,z0],[x1,y1,z0]], [[x1,y1,z0],[x0,y1,z0]], [[x0,y1,z0],[x0,y0,z0]],
    [[x0,y0,z1],[x1,y0,z1]], [[x1,y0,z1],[x1,y1,z1]], [[x1,y1,z1],[x0,y1,z1]], [[x0,y1,z1],[x0,y0,z1]],
    [[x0,y0,z0],[x0,y0,z1]], [[x1,y0,z0],[x1,y0,z1]], [[x1,y1,z0],[x1,y1,z1]], [[x0,y1,z0],[x0,y1,z1]],
  ];
  for (const [a, b] of edges) {
    X.push(a[0], b[0], null); Y.push(a[1], b[1], null); Z.push(a[2], b[2], null);
  }
  return {
    type: 'scatter3d', mode: 'lines', name,
    x: X, y: Y, z: Z,
    line: { color, width: 3},
    hoverinfo: 'name',
    showlegend: true,
  };
}


// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Initialise the TCP visualiser.
 *
 * @param {string} sidebarId   - id of the <ul> sidebar list element
 * @param {string} plot3dId    - id of the div that Plotly will draw into
 * @param {string} jsonPath    - URL of tcp_positions.json
 */
export async function initTCPVisualizer(sidebarId, plot3dId, datasets) {
  const sidebar = document.getElementById(sidebarId);

  /** * NEW: This function handles the file-level switching (the "Grasp Tasks" level)
   */
  async function loadDataset(dataset, linkEl) {
    // Highlight sidebar
    sidebar.querySelectorAll("a").forEach(a => a.classList.remove("is-active"));
    linkEl.classList.add("is-active");

    // Fetch the new JSON file
    const response = await fetch(dataset.path);
    const data = await response.json();

    // In this specific UI pattern, when we click a "Task", 
    // we default to loading the first group (e.g. "All Grasps") inside that file.
    if (data.groups && data.groups.length > 0) {
      renderGroup(data.groups[0]);
    }
  }

  /**
   * YOUR UPDATED LOGIC: Handles the actual plotting and image swap
   */
  function renderGroup(group) {
    const pts = group.pts;
    const scatter = {
      type: 'scatter3d', mode: 'markers', name: 'Grasp points',
      x: pts.map(p => p[0]), y: pts.map(p => p[1]), z: pts.map(p => p[2]),
      marker: {
        size: 3,
        color: pts.map((_, i) => i),
        colorscale: 'Viridis',
        opacity: 0.75,
        showscale: false,
      },
      hovertemplate: 'X:%{x:.3f}<br>Y:%{y:.3f}<br>Z:%{z:.3f}',
    };

    const handTraces = [
      boxTrace3D(PALM_BOX, '#E35E52', 'Palm'),
      ...FINGER_BOXES.map((f, i) => ({
        ...boxTrace3D(f, '#4A90E2', 'Fingers'),
        legendgroup: 'fingers',
        showlegend: i === 0,
      })),
    ];

    // Your logic for equal axis ranges
    const allBoxes = [PALM_BOX, ...FINGER_BOXES];
    const allCoords = [
      [...pts.map(p => p[0]), ...allBoxes.flatMap(b => b.x)],
      [...pts.map(p => p[1]), ...allBoxes.flatMap(b => b.y)],
      [...pts.map(p => p[2]), ...allBoxes.flatMap(b => b.z)],
    ];
    const mins = allCoords.map(c => Math.min(...c));
    const maxs = allCoords.map(c => Math.max(...c));
    const centers = mins.map((mn, i) => (mn + maxs[i]) / 2);
    const halfSpan = Math.max(...maxs.map((mx, i) => mx - mins[i])) / 2 * 1.15;
    const axRange = i => [centers[i] - halfSpan, centers[i] + halfSpan];

    const layout = {
      scene: {
        xaxis: { title: 'X fwd (m)', range: axRange(0) },
        yaxis: { title: 'Y lat (m)', range: axRange(1) },
        zaxis: { title: 'Z up (m)', range: axRange(2) },
        aspectmode: 'cube',
        dragmode: 'orbit',
      },
      margin: { l: 0, r: 0, b: 0, t: 0 },
      paper_bgcolor: 'rgba(0,0,0,0)',
      legend: { x: 0.01, y: 0.99, bgcolor: 'rgba(255,255,255,0.8)', font: { size: 11 } },
    };

    Plotly.react(plot3dId, [scatter, ...handTraces], layout);

  }

  // Populate the sidebar with the JSON filenames/labels provided
  datasets.forEach((dataset, i) => {
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.textContent = dataset.label;
    a.onclick = () => loadDataset(dataset, a);
    li.appendChild(a);
    sidebar.appendChild(li);
    if (i === 0) loadDataset(dataset, a);
  });
}
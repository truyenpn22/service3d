# Network Graph Visualization

This is an HTML and JavaScript code snippet for displaying a network graph using D3.js and Three.js.

## How to Use

1. **Clone Repository:** Clone the repository to your computer.
2. **Project Structure:**
   - `index.html`: Main HTML file to display the graph.
   - `network-graph.js`: JavaScript file to draw the graph.
   - `data.json`: File containing data for the graph.
3. **Run:** Open the `index.html` file in a web browser.

## Requirements

- Web browser that supports D3.js and Three.js.
- Data for the graph is stored in `data.json`.

## Data
This JSON dataset contains information about multiple web services and their related tables. Each web service object includes an ID, a name, and a list of related tables

### Structure
The dataset is structured as follows:

* `webServices`: An array containing multiple objects, each representing a web service.
    * `id`: Unique identifier for the web service.
    * `name`: Name of the web service.
    * `relatedTables`: An array of objects, each representing a table related to the respective service.
        * `id`: Unique identifier for the table.
        * `name`: Name of the table.
        * `count`: Number of records or items in the table.

This dataset provides an overview of various web services along with their associated tables and the number of records within each table. It can be utilized for analysis, understanding relationships between services and tables, or for generating insights into data distribution among different services.

## Steps

1. Open the `network.html` file in a web browser.
2. The network graph will be drawn using data from `data.json`.

## Code Explanation

```
<script type="module">
    import { NetWordChart } from './network-graph.js'
    d3.json("data.json").then(function (data) {
        const networkchart = new NetWordChart({
            ID (required): "network-graph",
            data (optional): data,
            rotationY (optional): 0.002,
            rotateSpeed (optional): 700,
            lineSize (optional): 0.001,
        })
    })
</script>
```

* `classId`: "network-graph": Specifies the HTML element's ID where the network graph will be rendered.
* `data`: Passes the loaded data to be used for generating the network graph.
* `rotationY`: Potentially an option for the chart to rotate around the Y-axis with a specified rate.If not set default value is 0.001.
* `rotateSpeed`: Customize rotation speed when clicking nodeService.If not set default value is 800.
* `lineSize` : Customize the size of the lines.If not set default value is 0.001,

## Libraries and Technologies

- D3.js: Used to get color codes.
- Three.js: Used to draw charts and use 3D rendering.

## References
- [D3.js Documentation](https://d3js.org/)
- [Three.js Documentation](https://threejs.org/)

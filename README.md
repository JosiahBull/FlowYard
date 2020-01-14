<img src="https://i.imgur.com/OYtRWz3.png">

<h1>FlowYard</h1>
Version 1.0 Released!
<h2>Overview</h2>
FlowYard is a civil tool which takes one or more shape files (.shp) and point files (.csv) and outputs a single .inp file for processing in EPANET.

FlowYard will automatically detect collisions between lines and join nodes, automatically simplify veritices where possible, add in extra nodes for fire hydrants and other faciliites as needed, and automatically input height data to nodes when provided.

FlowYard supports near-infinite numbers of pipe networks layered on top of one another.

The goal of FlowYard is to dramtically reduce the time it takes to generate an inp file for processing in EPANET from Civil3D Pipe Network data.

<h2>Download and Installation</h2>
Simply click on <b><a href="https://github.com/badtoro2/FlowYard/releases/download/V1.0.0/FlowYard.Setup.1.0.0.exe"> FlowYard.Setup.1.0.0.exe </a></b> to download, then run as you would any other installation file following onscreen prompts.
<h2>Usage</h2>
<h3>What Files to Extract</h3>
FlowYard takes two filetypes as inputs, shape files (shp) and point files (csv). 

For most usecases, you should only need to export a shapefile to create a pipe network. A shapefile contains all of your linework, and FlowYard can process it into nodes and verticies automatically, joining collisions and overlaps.

A point file should be exported if:
<ul>
 <li>You want to add elevation data to your inp file through FlowYard.</li>
 <li>You want to add additional nodes to your inp file through FlowYard, e.g. for fire hydrants or tank connections.</li>
</ul>
Most of the time though this shouldn't be required to create your FlowYard pipe network.

<h3>Extracting Files from Civil3D</h3>
<h4>Shape Files (.shp)</h4>
To export your line work from Civil3D, type the "mapexport" command and a save dialog window will appear. Be sure to select "ERSI Shapefile (\*.shp)" under type of file.

<img src="https://i.imgur.com/Ev3I4XV.png">

The shape file configuration window will follow:

<img src="https://i.imgur.com/dZqAinu.png">

Ensure to change **Object Type:** from *Point* to *Line*. Use the **Select objects to export** panel to choose which polylines and layers you would liek to export to the shapefile.

When you have finished, simply click ok and the shapefile will have been saved.

<h4>CSV Files</h4>
To export points from AutoCAD to a csv file, right click on the relevant points in your ToolSpace and select *Export...*:
<img src="https://i.imgur.com/bYBjHod.png">

Change **Format:** to "*XYZ_Itensity (Comma Delimited)*" and save as a .csv file to your desired location.
<img src="https://i.imgur.com/r5p4Rr8.png">

All done! You're now ready to create your pipe network in FlowYard.

<h3>Adding a Pipe Network</h3>
Click the "+" button to add a pipe network:
<img src="https://i.imgur.com/cO6brg3.png">

Follow the prompts which appear below the pipe network to configure the pipe network correctly. More pipe networks can be added and removed as you please.


<h3>Global Options </h3>
<h4>Global Intersections</h4>
When toggled on, FlowYard will check for collisions between different pipe networks and internally. If global intersections is toggled off, then FlowYard will only check for collisions internally within each pipe network.
<h4>Simplify Vertices</h4>
Where possible FlowYard will attempt to simply lines down into vertices, reducing processing time in EPANET.
Verticies are represented by the blue sqaures in the Output Preview, while standard nodes are represented by red dots.
<img src="https://i.imgur.com/c4RwaRR.png">

<h2>Credit</h2>
FlowYard was developed by Josiah Bull for use by Blue Barn consulting. This product is licensed through MIT, and is freely available for use and modification by anyone without credit (though it is very much appreciated!)

Got suggestions, recommendations, or bug reports? Contact me or submit an issue here on GitHub!

<template>
  <div id="wrapper">
    <div id="networkConfigWindow" class="wrapperStyling">
      <h1>Network Configuration</h1>
      <div id="networkConfigWrapper" class="elementContainerStyling">
        <div v-for="(network, i) in pipeNetworks">
          <div v-bind:class="{ 'errorDropdownActiveNetwork': !network.valid, 'exitHover': network.exitHover, 'networkError': !network.valid, 'networkWarn' : (network.warn && network.valid) }" class="networkItem">  
            <h2>Pipe Network: {{network.id}}</h2>
            <div class="networkExit" @mouseup="pipeNetworks.splice(i, 1); validate();" @mouseover="network.exitHover = true;" @mouseleave="network.exitHover = false;"></div>
            <div class="networkDivider"></div>
            <h3>Shape File: <button v-on:click="browseFile(network.shapeFile).then(filePath => network.shapeFile = filePath)">Click to Select</button>{{network.shapeFile.replace(/^.*[\\\/]/, '')}}</h3>
            <h3>Point File: <button v-on:click="browseFile(network.pointFile).then(filePath => network.pointFile = filePath)">Click to Select</button>{{network.pointFile.replace(/^.*[\\\/]/, '')}}</h3>
            <div class="networkDivider"></div>
            <h4>Check Internal Intersections: <input type="checkbox" v-model="network.checkInternalIntersections"> </h4>
            <h4>Pipe Diameter: <input v-model="network.diameter" placeholder="click to enter (mm)"> </h4>
            <div class="errorDropdown" v-bind:class="{'errorDropdownActive': !network.valid}">
              <h5>{{network.errors[0]}}</h5>
            </div>
          </div>
        </div>
        <div id="newItemPreview" @mousedown="add()">
          <h2>Add New</h2>
          <div class="networkDivider"></div>
          <div class="newItemBlock"></div>
          <div class="newItemBlock"></div>
          <div class="networkDivider"></div>
          <div class="newItemBlock"></div>
          <div class="newItemBlock"></div>
        </div>
      </div>
      <div id="globalOptions" class="test">
        <!-- <h1>Global Network Options</h1> -->
        <h4>Global Intersections: <input type="checkbox" v-model="globalNetworkConfig.checkGlobalCollisions"> </h4>
        <h4>Simplify Verticies: <input type="checkbox" v-model="globalNetworkConfig.simplifyVerticies"> </h4>
        <!-- <h4>Remove Duplicates? <input type="checkbox" v-model="globalNetworkConfig.removeDuplicates"> </h4> -->
      </div>
    </div>

    <div id="previewWrapper" class="wrapperStyling">
      <h1>Output Preview</h1>
      <canvas id="outputCanvas" class="elementContainerStyling"></canvas>
    </div>


    <button name="processNetworkButton" type="button" id="processButton" v-on:click="process()">Process!</button>
    <div id="footer"></div>
  </div>
</template>

<script>
  import SystemInformation from './LandingPage/SystemInformation';
  import { net, ipcRenderer, remote } from 'electron';
  import 'typeface-karla/index.css';
  import 'typeface-domine/index.css';
  import 'typeface-open-sans/index.css';
  let dialog = remote.dialog;
  let canvas, processedPipeNetwork, ctx, dpi;
  window.onload = function() {
    canvas = document.getElementById('outputCanvas');
    ctx = canvas.getContext('2d');
    dpi = window.devicePixelRatio;
    fixDpi();
  };
  window.onresize = function() {
    fixDpi();
    updateCanvasDisplay();
  }
  function fixDpi() {
    let style_height = +getComputedStyle(canvas).getPropertyValue("height").slice(0, -2);
    let style_width = +getComputedStyle(canvas).getPropertyValue("width").slice(0, -2);
    canvas.setAttribute('height', style_height * dpi);
    canvas.setAttribute('width', style_width * dpi);
  }
  function changeState(input) {
    let output;
    if (Array.isArray(input)) {
        output = {};
        input.forEach(subObj => {
            let subObjId = subObj.id;
            delete subObj.id;
            output[subObjId] = subObj;
        })
    } else {
        output = [];
        Object.keys(input).forEach(subObj => {
            output.push({
                ...input[subObj],
                id: Number(subObj)
            })
        })
    }
    return output;
  };
  function updateCanvasDisplay() {
    if (processedPipeNetwork.raw === undefined) return;
    let { lines, points, verticies } = processedPipeNetwork.raw;
    let minX = points[0].x;
    let minY = points[0].y;
    let maxX = 0;
    let maxY = 0;
    changeState(points).concat(changeState(verticies)).forEach(point => {
      if (point.x < minX) minX = point.x;
      if (point.x > maxX) maxX = point.x;
      if (point.y < minY) minY = point.y;
      if (point.y > maxY) maxY = point.y;
    });
    let scaleFactor = Math.min(((canvas.width * 0.9)/(maxX-minX)), ((canvas.height * 0.9)/(maxY-minY)));
    points = changeState(changeState(points).map(point => {
      point.x = (point.x - minX) * scaleFactor + canvas.width * 0.05;
      point.y = (point.y - minY) * scaleFactor + canvas.height * 0.05;
      return point;
    }));
    verticies = changeState(changeState(verticies).map(vertex => {
      vertex.x = (vertex.x - minX) * scaleFactor + canvas.width * 0.05;
      vertex.y = (vertex.y - minY) * scaleFactor + canvas.height * 0.05;
      return vertex;
    }));  
    let verticiesByLineId = changeState(verticies).reduce((verticiesByLineId, vertex) => {
      if (vertex.lineId in verticiesByLineId) {
        verticiesByLineId[vertex.lineId].push(vertex);
      } else {
        verticiesByLineId[vertex.lineId] = [vertex];
      }
      return verticiesByLineId;
    }, {});
    let paths = changeState(lines).map(line => {
      let path = [];
      path.push(points[line.startNode]);
      if (line.id in verticiesByLineId) {
        verticiesByLineId[line.id].forEach(vertex => {
          vertex.vertex = true;
          path.push(vertex);
        });
      }
      path.push(points[line.endNode]);
      return path;
    });
    fixDpi();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    paths.forEach(path => {
      ctx.beginPath();
      ctx.lineWidth = 3;
      ctx.moveTo(path[0].x, path[0].y);
      path.forEach((node, i) => {
        if (i === 0) return;
        ctx.lineTo(node.x, node.y);
      })
      ctx.stroke();
    })
  };
  ipcRenderer.on('pipeNetworksProcessed', (event, args) => {
    processedPipeNetwork = args;
    updateCanvasDisplay();
  });
  export default {
    name: 'landing-page',
    components: { SystemInformation },
    methods: {
      open(link) {
        this.$electron.shell.openExternal(link)
      },
      process() {
        this.validate();
        if (this.$data.valid) {
          ipcRenderer.send('processPipeNetworks', {pipeNetworks: this.$data.pipeNetworks, globalNetworkConfig: this.$data.globalNetworkConfig});
        } 
        //Consider adding an else here to display an error to the user.
      },
      browseFile(currentValue) {
        return dialog.showOpenDialog().then(result => {
          let {cancled, filePaths} = result;
          if (!cancled) {
            return filePaths[0];
          } else {
            return currentValue;
          }
        })
      },
      add() {
        this.$data.pipeNetworks.unshift({
            id: (this.$data.pipeNetworks.length === 0) ? 0 : Number(this.$data.pipeNetworks[0].id +1),
            shapeFile: '',
            pointFile: '',
            checkInternalIntersections: true,
            diameter: undefined,
            valid: true,
            warn: false,
            exitHover: false,
            errors: [],
            warnings: []
          })
      },
      validate() {
        this.$data.valid = true;
        this.$data.pipeNetworks = this.$data.pipeNetworks.map((pipeNetwork, i) => {
          let { shapeFile, pointFile, diameter } = pipeNetwork;
          pipeNetwork.id = this.$data.pipeNetworks.length - 1 - i;
          pipeNetwork.valid = true;
          pipeNetwork.errors = [];
          pipeNetwork.warn = false;
          pipeNetwork.warnings = [];
          if (shapeFile === '') {
            pipeNetwork.valid = false;
            this.$data.valid = false;
            pipeNetwork.errors.push('Error: No shapefile selected!');
          }
          if ((shapeFile.replace(/^.*[\\\/]/, '').split('.')[1] !== 'shp' && shapeFile !== '') || (pointFile.replace(/^.*[\\\/]/, '').split('.')[1] !== 'csv') && pointFile !== '') {
            pipeNetwork.valid = false;
            this.$data.valid = false;
            pipeNetwork.errors.push('Error: Invalid filetype selected!');
          }
          if (false) { //Check Paths Are Valid (IMPLEMENT IF THIS IS FOUND TO BE AN ISSUE)
            pipeNetwork.valid = false;
            this.$data.valid = false;
            pipeNetwork.errors.push('Error: Invalid FilePath Selected!');
          }
          if (isNaN(diameter)) {
            pipeNetwork.valid = false;
            this.$data.valid = false;
            pipeNetwork.errors.push('Error: Pipe diameter must be numeric!');
          } 
          if (diameter > 5) {
            pipeNetwork.warn = true;
            pipeNetwork.warnings.push('Warning! Pipe dia. is over 5m.');
          }
          if (pointFile === '') {
            pipeNetwork.warn = true;
            pipeNetwork.warnings.push('Warning! No pointFile selected.');
          }
          return pipeNetwork;
        });
      },
    },
    data: function() {
      return {
        pipeNetworks: [
          {
            id: 0,
            shapeFile: 'C:\\Users\\Jo Bull\\OneDrive\\Apps\\0008_WorkWaterModellingTool\\03_Code\\RawInput\\shapey.shp',
            pointFile: 'C:\\Users\\Jo Bull\\OneDrive\\Apps\\0008_WorkWaterModellingTool\\03_Code\\RawInput\\points.csv',
            checkInternalIntersections: true,
            diameter: 5,
            valid: true,
            warn: false,
            exitHover: false,
            errors: [],
            warnings: []
          }
        ],
        globalNetworkConfig : {
          checkGlobalCollisions: false,
          simplifyVerticies: true,
          removeDuplicates: true
        },
        valid : false
      }
    }
  }
</script>

<style>
  body {
    background-color: rgb(30, 30, 30);
    margin: 0;
  }
  input, button, textarea, :focus {   
    outline: none;
  }
  h1 {
    margin: 7px;
    margin-left: 15px;
    font-weight: bold;
    font-size: 37px;
    color: rgb(228, 228, 228);
    font-family: 'Open Sans', sans-serif;
  }
  /* Wrapper CSS */
  #wrapper {
    height: 100%;
    width: 100%;
    margin: 0;
    padding: 0;
  }
  /* Processing Button CSS */
  #processButton {
    height: 10%;
    width: 15%;
    position:absolute;
    bottom: 10%;
    right: 7%;
    border-radius: 7px;
    font-size: 25px;
  }
  /* Network Config Window Things */
  #networkConfigWindow {
    width: 35%;
    height: 90%;
    position: absolute;
    top: 5%;
    left: 3%;
    display: flex;
    flex-direction: column;
  }
  #networkConfigWrapper {
    position: relative;
    margin: 0% auto;
    width: 94%;
    height: 80%;
    overflow: auto;
  }
  .networkItem, #newItemPreview {
    position: relative;
    width: 92%;
    z-index: 1; 
    margin: 2% auto;
    border-style: solid;
    border-width: 4px;
    border-color: transparent;
    transition: margin-bottom 1s;
  }
  .networkExit {
    width: 30px;
    height: 10px;
    background-color: red;
    position: absolute;
    top: 10px;
    right: 10px;
    cursor: pointer;
  }
  .networkDivider {
    height: 3px;
    width: 100%;
    position: relative;
  }
  .networkItem > h2, #newItemPreview > h2 {
    padding: 5px;
    font-weight: 700;
    margin: 0;
    overflow: hidden;
    font-family: 'Open Sans', sans-serif;
    font-size: 25px;
  }
  .networkItem > h3 {
    padding: 5px;
    margin: 0;
    font-weight: 600;
    font-family: 'Open Sans', sans-serif;
    font-size: 15px;
  }
  .networkItem > h4 {
    padding: 5px;
    margin: 0;
    font-family: 'Open Sans', sans-serif;
    font-size: 13px;
    font-weight: 600;
  }
  .networkItem > h3 > button {
    padding: 40px, 0, 0, 40px;
  }
  .networkItem > h4 > input {
    width: 10%;
    margin-left: 10px;
  }
  .errorDropdown {
    position: absolute;
    z-index: 0;
    background-color: darkred;
    left: 0%;
    width: 100%;
    top: 80%;
    transition: top 1s;
    margin-bottom: 0;
    border-radius: 7px;
  }
  .errorDropdown > h5 {
    margin: 10px;
  }
  .errorDropdownActive {
    top: 105%;
    background-color: green;
  }
  .errorDropdownActiveNetwork {
    margin-bottom: 50px;
  }
  /* New Item CSS */
  #newItemPreview {
    height: 182px;
    cursor: pointer;
  }
  /* Global Options Window */
  #globalOptions {
    background-color: #5891ed;
    position: relative;
    margin: 2% auto;
    width: 94%;
    overflow:auto;
    flex: none;
  }
  #globalOptions > h4 {
    display:inline-block;
    font-size: 25px;
    margin: 0;
    padding: 0;
  }
  /* Output Preview Things */
  #previewWrapper {
    width: 55%;
    height: 90%;
    position: absolute;
    right: 2%;
    top: 5%;
  }
  #outputCanvas {
    position: relative;
    width: 95%;
    height: 90%;
    margin: 0 auto;
    display: block;
  }

  /* Foooter */
  #footer {
    width: 100%;
    height: 25px;
    position: fixed;
    bottom:0;
    background-color: rgb(68, 14, 73);
    box-shadow: 0px 0px 5px 0px rgba(0,0,0,0.66);
  }

  /* Colors and things for styling */
  .elementContainerStyling {
    border-radius: 5px;
    box-shadow: inset 0px 0px 10px 2px rgba(0,0,0,0.7);
    background-color: rgb(240, 240, 240);
  }
  .wrapperStyling {
    border-radius: 5px;
    background-color: rgb(60, 60, 60);
    box-shadow: 0px 0px 10px 1px rgba(0,0,0,0.75);
  }
  .networkItem, #newItemPreview{
    background-color: aqua;
    border-radius: 5px;
  }
  .networkDivider {
    background-color: darkgray;
  }
  .newItemBlock {
    height: 20px;
    margin: 7px;
    width: 75%;
    background-color: grey;
    border-radius: 5px;
  }
  .exitHover, .networkError {
    border-color: red;
  }
  .networkWarn {
    border-color: rgb(199, 129, 0);
  }
  #processButton:hover {
    box-shadow: 6px 10px 22px -4px rgba(0,0,0,0.49);
    background-color: green;
    border-color: red;
  }
  #processButton:active {
    background-color: blue;
    border-color: yellow;
  }

  /* Media Queries (TODO)*/
  
  /* @media (max-width: 1000px) {

    #networkConfigWrapper {
      transform-origin: right top;
      transform:rotate(-90deg) translateY(-100px);
      padding-top: 400px;
    }
    .networkItem {
      transform: rotate(90deg);
      transform-origin: right top;
      padding: 0;
    }
    #previewWrapper {
      visibility: hidden;
    }
    #footer {
      background-color: green;
    }
  } */

</style>

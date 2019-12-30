<template>
  <div id="wrapper">
    <div id="networkConfigWindow">
      <h1 class ="test">Network Configuration</h1>
      <div class="test" id="networkConfigWrapper">
        <div v-for="(network, i) in pipeNetworks" v-bind:class="{ 'exitHover': network.exitHover, 'networkError': !network.valid }" class="networkItem">
          <h2>Pipe Network: {{network.id}}</h2>
          <div class="networkExit" @mouseup="pipeNetworks.splice(i, 1)" @mouseover="network.exitHover = true;" @mouseleave="network.exitHover = false;"></div>
          <div class="networkDivider"></div>
          <h3>Shape File: <button v-on:click="browseFile(network.shapeFile).then(filePath => network.shapeFile = filePath)">Click to Select</button>{{network.shapeFile.replace(/^.*[\\\/]/, '')}}</h3>
          <h3>Point File: <button v-on:click="browseFile(network.pointFile).then(filePath => network.pointFile = filePath)">Click to Select</button>{{network.pointFile.replace(/^.*[\\\/]/, '')}}</h3>
          <div class="networkDivider"></div>
          <h4>Check Internal Intersections: <input type="checkbox" v-model="network.checkInternalIntersections"> </h4>
          <h4>Pipe Diameter: <input v-model="network.diameter" placeholder="click to enter (mm)"> </h4>
        </div>
        <div id="newElementPreview" @mousedown="add()">
          <!-- Add preview stuff here. -->
        </div>
      </div>
      <div id="globalOptions" class="test">
        <!-- <h1>Global Network Options</h1> -->
        <h4>Global Intersections: <input type="checkbox" v-model="globalNetworkConfig.checkGlobalCollisions"> </h4>
        <h4>Simplify Verticies: <input type="checkbox" v-model="globalNetworkConfig.simplifyVerticies"> </h4>
        <!-- <h4>Remove Duplicates? <input type="checkbox" v-model="globalNetworkConfig.removeDuplicates"> </h4> -->
      </div>
    </div>

    <div id="previewWrapper">
      <h1>Output Preview</h1>
      <canvas id="outputCanvas"></canvas>
    </div>


    <button name="processNetworkButton" type="button" id="processButton" v-on:click="process()">Process!</button>
    <div id="footer"></div>
  </div>
</template>

<script>
  import SystemInformation from './LandingPage/SystemInformation';
  import { net, ipcRenderer, remote } from 'electron';
  let dialog = remote.dialog;
  let canvas, processedPipeNetwork, ctx, dpi;
  window.onload = function() {
    canvas = document.getElementById('outputCanvas');
    ctx = canvas.getContext('2d');
    dpi = window.devicePixelRatio;
    fixDpi();
  };
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
    let { lines, points, verticies } = processedPipeNetwork.raw;
    console.log({
      verticies: verticies,
      points: points,
      lines: lines
    })
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
    // console.log(paths)
    fixDpi();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.translate(0, canvas.height);
    ctx.scale(1, -1);
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
        //Add some verifciation code here to make sure everything is valid and happy before sending to the processor, also needs to highlight the offending boi red.
        ipcRenderer.send('processPipeNetworks', {pipeNetworks: this.$data.pipeNetworks, globalNetworkConfig: this.$data.globalNetworkConfig});
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
        this.$data.pipeNetworks.unshift(          {
            id: 0,
            shapeFile: 'C:\\Users\\Jo Bull\\OneDrive\\Apps\\0008_WorkWaterModellingTool\\03_Code\\RawInput\\shapey.shp',
            pointFile: 'C:\\Users\\Jo Bull\\OneDrive\\Apps\\0008_WorkWaterModellingTool\\03_Code\\RawInput\\points.csv',
            checkInternalIntersections: true,
            diameter: 100,
            valid: true,
            exitHover: false,
            errors: []
          })
      }
    },
    data: function() {
      return {
        pipeNetworks: [
          {
            id: 0,
            shapeFile: 'C:\\Users\\Jo Bull\\OneDrive\\Apps\\0008_WorkWaterModellingTool\\03_Code\\RawInput\\shapey.shp',
            pointFile: 'C:\\Users\\Jo Bull\\OneDrive\\Apps\\0008_WorkWaterModellingTool\\03_Code\\RawInput\\points.csv',
            checkInternalIntersections: true,
            diameter: 100,
            valid: true,
            exitHover: false,
            errors: []
          }
        ],
        globalNetworkConfig : {
          checkGlobalCollisions: false,
          simplifyVerticies: true,
          removeDuplicates: true
        }
      }
    }
  }
</script>

<style>
  body {
    background-color: #33322d;
    margin: 0;
  }
  input, button, textarea, :focus {
    outline: none;
  }
  h1 {
    margin: 20px;
    color: brown;
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
  #processButton:hover {
    box-shadow: 6px 10px 22px -4px rgba(0,0,0,0.49);
    background-color: green;
    border-color: red;
  }
  #processButton:active {
    background-color: blue;
    border-color: yellow;
  }
  /* Network Config Window Things */
  #networkConfigWindow {
    width: 35%;
    height: 90%;
    background-color: #6acc8c;
    position: absolute;
    top: 5%;
    left: 3%;
    display: flex;
    flex-direction: column;
  }
  #networkConfigWrapper {
    position: relative;
    margin: 2% auto;
    width: 94%;
    height: 80%;
    background-color: darkblue;
    overflow: auto;
  }
  .networkItem, #newElementPreview {
    width: 92%;
    position: relative;
    margin: 2% auto;
    background-color: aqua;
    border-style: solid;
    border-width: 4px;
    border-color: transparent;
  }
  #newElementPreview {
    height: 100px;
    cursor: pointer;
    background-color: red;
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
  .exitHover ,.networkError {
    border-color: red;
  }
  .networkItem .networkDivider {
    height: 3px;
    width: 100%;
    position: relative;
    background-color: darkgray;
  }
  .networkItem h2 {
    padding: 10px;
    margin: 0;
    overflow: hidden;
  }
  .networkItem h3 {
    padding: 5px;
    margin: 0;
  }
  .networkItem h4 {
    padding: 5px;
    margin: 0;
  }

  /* Global Options Window */
  #globalOptions {
    background-color: #5891ed;
    position: relative;
    margin: 0 auto;
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
    background-color: #6acc8c;
    position: absolute;
    right: 3%;
    top: 5%;
  }
  #outputCanvas {
    position: absolute;
    left: 3%;
    top: 11%;
    width: 94%;
    height: 86%;
    background-color: lightblue;
  }
  /* Foooter */
  #footer {
    width: 100%;
    height: 25px;
    position: fixed;
    bottom:0;
    background-color: purple;
  }
</style>

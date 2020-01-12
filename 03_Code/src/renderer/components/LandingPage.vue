<template>
  <div id="wrapper">
    <div id="networkConfigWindow" class="wrapperStyling">
      <h1>Network Configuration</h1>
      <div id="networkConfigWrapper" class="elementContainerStyling">
        <div v-for="(network, i) in pipeNetworks">
          <div v-bind:class="{ 'errorDropdownActiveNetwork': !network.valid || network.warn, 'exitHover': network.exitHover, 'networkError': !network.valid, 'networkWarn' : (network.warn && network.valid) }" class="networkItem">  
            <h2>Pipe Network: {{network.id}}</h2>
            <div class="networkExit" @mouseup="pipeNetworks.splice(i, 1);" @mouseover="network.exitHover = true;" @mouseleave="network.exitHover = false;" v-bind:class="{'exitHoverActive': network.exitHover, 'exitHoverErrorActive' : !network.valid}"> </div>
            <div class="networkDivider"></div>
            <h3>Shape File: <button v-on:click="browseFile(network.shapeFile).then(filePath => network.shapeFile = filePath)">Click to Select</button>{{network.shapeFile.replace(/^.*[\\\/]/, '')}}</h3>
            <h3>Point File: <button v-on:click="browseFile(network.pointFile).then(filePath => network.pointFile = filePath)">Click to Select</button>{{network.pointFile.replace(/^.*[\\\/]/, '')}}</h3>
            <div class="networkDivider"></div>
            <h3>Check Internal Intersections: <input type="checkbox" v-model="network.checkInternalIntersections"> </h3>
            <h3>Pipe Diameter: <input v-model="network.diameter" placeholder="click to enter (mm)"> </h3>
          </div>
          <div class="errorDropdown" v-bind:class="{'errorDropdownActive': !network.valid, 'warningDropdownActive' : network.warn && network.valid}">
            <h5>{{network.errors[0] || network.warnings[0]}}</h5>
          </div>
        </div>
      </div>
      <div id="newItemPreview" @mousedown="add()">
          <!-- <h2>Add New</h2>
          <div class="networkDivider"></div>
          <div class="newItemBlock"></div>
          <div class="newItemBlock"></div>
          <div class="networkDivider"></div>
          <div class="newItemBlock"></div>
          <div class="newItemBlock"></div> -->
      </div>
    </div>

    <div id="previewWrapper" class="wrapperStyling">
      <h1>Output Preview</h1>
      <canvas id="outputCanvas" class="elementContainerStyling"></canvas>
    </div>
    <div id="globalOptions" class="test">
        <!-- <h1>Global Network Options</h1> -->
        <!-- <h1>Global Intersections: <input type="checkbox" v-model="globalNetworkConfig.checkGlobalCollisions"> </h1> -->
        <!-- <h1>Simplify Verticies: <input type="checkbox" v-model="globalNetworkConfig.simplifyVerticies"> </h1> -->
        <!-- <h4>Remove Duplicates? <input type="checkbox" v-model="globalNetworkConfig.removeDuplicates"> </h4> -->
          <div class="globalOptionBox"> 
            <h2>Global Intersections</h2>
            <div class="pretty p-switch p-fill">
                <input type="checkbox" v-model="globalNetworkConfig.checkGlobalCollisions"/>
                <div class="state p-primary">
                    <label></label>
                </div>
            </div>
          </div>
          <div class="globalOptionBox"> 
            <h2>Simplify Verticies</h2>
            <div class="pretty p-switch p-fill">
                <input type="checkbox" v-model="globalNetworkConfig.simplifyVerticies"/>
                <div class="state p-primary">
                    <label></label>
                </div>
            </div>
          </div>
    </div>
    <button name="processNetworkButton" type="button" id="processButton" v-on:click="process();saveFile();">SAVE</button>

    <div id="footer"></div>
  </div>
</template>

<script>
  import SystemInformation from './LandingPage/SystemInformation';
  import { net, ipcRenderer, remote } from 'electron';
  import 'typeface-open-sans/index.css';
  import 'pretty-checkbox/dist/pretty-checkbox.css';
  import img from './add-24px.svg';
  import img2 from './clear_hover-24px.svg';
  import img3 from './clear-24px.svg';
  import img4 from './clear_error-24px.svg';
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
  };
  const os = require ('os');
  const username = os.userInfo ().username;
  function getFormattedTime() {
    let today = new Date();
    let y = today.getFullYear();
    // JavaScript months are 0-based.
    let m = today.getMonth() + 1;
    let d = today.getDate();
    let h = today.getHours();
    let mi = today.getMinutes();
    let s = today.getSeconds();
    return y + "-" + m + "-" + d + "-" + h + "-" + mi;
  };
  function fixDpi() {
    let style_height = +getComputedStyle(canvas).getPropertyValue("height").slice(0, -2);
    let style_width = +getComputedStyle(canvas).getPropertyValue("width").slice(0, -2);
    canvas.setAttribute('height', style_height * dpi);
    canvas.setAttribute('width', style_width * dpi);
  };
  function changeState(input) {
      let output;
      if (Array.isArray(input)) {
          output = {};
          if (input === undefined || input === null) return output;
          input.forEach(subObj => {
              let subObjId = subObj.id;
              delete subObj.id;
              output[subObjId] = subObj;
          })
      } else {
          output = [];
          if (input === undefined || input === null) return output;
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
    if (processedPipeNetwork === undefined || processedPipeNetwork === null) return;
    let { lines, points, verticies } = processedPipeNetwork.raw || {};
    let minX = changeState(points)[0].x;
    let minY = changeState(points)[0].y;
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
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineWidth = 3;
    ctx.beginPath();
    paths.forEach(path => {
      ctx.moveTo(path[0].x, path[0].y);
      path.forEach((node, i) => {
        if (i === 0) return;
        ctx.lineTo(node.x, node.y);
      })
    });
    ctx.stroke();
    let rectSize = 6.5;
    ctx.fillStyle = 'Blue';
    changeState(verticies).forEach(vertex => {
      ctx.beginPath();
      ctx.fillRect(vertex.x - rectSize/2, vertex.y - rectSize/2, rectSize, rectSize);
    });
    ctx.fillStyle = 'Red';
    changeState(points).forEach(point => {
      ctx.beginPath();
      ctx.arc(point.x, point.y, 3, 0, 2*Math.PI)
      ctx.fill();
    });

    
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
        if (this.$data.pipeNetworks.length === 0) return;
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
      saveFile() {
        if (processedPipeNetwork === undefined) return;
        if (!this.$data.valid) return;
        return dialog.showSaveDialog({
          title: 'Save FlowYard Output',
          defaultPath: 'FlowYard_' + username + '_' + getFormattedTime(),
          filters: [
            { name: 'mapFile', extensions: ['inp'] },
            { name: 'textFile', extensions: ['txt']},
            { name: 'All Files', extensions: ['*'] }
          ]
        }).then(result => {
          let { canceled, filePath } = result;
          if (!canceled) {
            ipcRenderer.send('saveFile', {
              path: filePath,
              data: processedPipeNetwork.saveFile
            })
          }
        })
      }
    },
    data: function() {
      return {
        pipeNetworks: [
          {
            id: 0,
            shapeFile: 'C:\\Users\\josia\\OneDrive\\Apps\\0008_WorkWaterModellingTool\\03_Code\\RawInput\\shapey.shp',
            pointFile: 'C:\\Users\\josia\\OneDrive\\Apps\\0008_WorkWaterModellingTool\\03_Code\\RawInput\\points.csv',
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
        valid: false,
        globalVals: {
          diameter: 0,
          shapeFile: '',
          pointFile: '',
          checkInternalIntersections: ''
        }
      }
    },
    watch: {
      globalNetworkConfig: {
        handler(newVal, oldVal) {
          this.process();
        }, 
        deep: true
      },
      pipeNetworks: {
        handler(newVal, oldVal) {
          let newGlobalDia = 0;
          let newShapeFile = '';
          let newPointFile = '';
          let newInternalIntersect = '';
          this.pipeNetworks.forEach(network => {
            newGlobalDia += network.diameter;
            newShapeFile += network.shapeFile;
            newPointFile += network.pointFile;
            newInternalIntersect += network.checkInternalIntersections;
          });
          if ((newGlobalDia !== this.globalVals.diameter && !isNaN(newGlobalDia)) || newShapeFile !== this.globalVals.shapeFile || newPointFile !== this.globalVals.pointFile || newInternalIntersect !== this.globalVals.checkInternalIntersections) {
            this.globalVals.diameter = newGlobalDia;
            this.globalVals.shapeFile = newShapeFile;
            this.globalVals.pointFile = newPointFile;
            this.globalVals.checkInternalIntersections = newInternalIntersect;
            this.process();
          }
        },
        deep: true
      }
    }
  }
</script>

<style>
  body {
    background-color: rgb(40, 40, 40);
    margin: 0;
  }
  input, button, textarea, :focus {   
    outline: none;
  }
  h1 {
    margin: 8px;
    margin-left: 0px;
    font-weight: bold;
    font-size: 3.5vh;
    color: rgb(255, 255, 255);
    font-family: 'Open Sans', sans-serif;
    white-space: nowrap;
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
    height: 8%;
    width: 15%;
    position:absolute;
    bottom: 6%;
    right: 2%;
    border-radius: 7px;
    font-size: 30px;
    font-family: 'Open Sans', sans-serif;
    font-weight: 700;
    background-color:rgb(84, 14, 90);
    border-color: transparent;
    color: white;
    box-shadow: 0px 0px 5px 0px rgba(0,0,0,0.75);
    cursor: pointer;
  }

  /* Network Config Window Things */
  #networkConfigWindow {
    width: 35%;
    height: 91%;
    position: absolute;
    top: 3%;
    left: 3%;
    display: flex;
    flex-direction: column;
  }
  #networkConfigWrapper {
    position: relative;
    /* margin: 0% auto; */
    width: 100%;
    height: 95%;
    overflow:auto;
  }
  .networkItem {
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
    height: 30px;
    position: absolute;
    top: 2px;
    right: 2px;
    cursor: pointer;
    background-image: url('./clear-24px.svg');
    background-size: cover;
  }
  .exitHoverErrorActive {
    background-image: url('./clear_error-24px.svg');
  }
  .exitHoverActive {
    background-image: url('./clear_hover-24px.svg');
  }
  .networkDivider {
    height: 2px;
    width: 95%;
    /* margin: 0 auto; */
    left: 5px;
    position: relative;
  }
  .networkItem > h2 {
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
  .errorDropdown, .warningDropdown {
    position: relative;
    z-index: 0;
    height: 0px;
    font-size: 0px;
    margin: 0 auto;
    width: 92%;
    /* top: 80%; */
    top: -60px;
    transition: top 1s, height 1s, font-size 1s;
    border-radius: 7px;
  }
  .warningDropdownActive {
    background-color:rgb(204, 134, 5);
  }
  .errorDropdownActive {
    background-color: darkred;
  }
  .errorDropdown > h5 {
    position: relative;
    top: 5px;
    left: 10px;
    margin: 0;
    font-family: 'Open Sans', sans-serif;
  }
  .errorDropdownActive, .warningDropdownActive {
    top: 2px;
    height: 40px;
    font-size: 25px;
  }
  .errorDropdownActiveNetwork {
    margin-bottom: 0px;
  }
  /* New Item CSS */
  #newItemPreview {
    height: 65px;
    width: 65px;
    background-image: url('./add-24px.svg');
    background-size: cover;
    border-radius: 50%;
    background-color: purple;
    position: absolute;
    bottom: 30px;
    right: 30px;
    cursor: pointer;
    z-index: 5;
    box-shadow: 0px 0px 5px 0px rgba(0,0,0,0.75);
  }
  #newItemPreview:hover {
    box-shadow: 0px 0px 5px 2px rgba(0,0,0,0.75);
  }
  #newItemPreview:active {
    background-color:rgb(84, 14, 90);
  }
  /* Global Options Window */
  #globalOptions {
    /* background-color: #5891ed; */
    position: absolute;
    bottom: 5%;
    right: 17%;
    width: 40%;
    overflow:visible;
    display: flex;
    flex-direction: column;
  }
  .globalOptionBox div, .globalOptionBox H2 {
    display: inline-block;
  }
  .globalOptionBox H2 {
    margin: 8px;
    margin-left: 0px;
    font-weight: bold;
    font-size: 3vh;
    color: rgb(255, 255, 255);
    font-family: 'Open Sans', sans-serif;
    white-space: nowrap;
  }
  .globalOptionBox div {
    font-size: 2.5vh;
  }

  /* #globalOptions > h4 {
    font-size: 25px;
    margin: 15px;
    padding: 0;
    font-family: 'Open Sans', sans-serif;
    font-weight: 700;
    color: white;
  } */
  /* Output Preview Things */
  #previewWrapper {
    width: 55%;
    height: 80%;
    position: absolute;
    right: 2%;
    top: 3%;
  }
  #outputCanvas {
    position: relative;
    width: 100%;
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
    background-color: rgb(84, 14, 90);
    /* box-shadow: 0px 0px 5px 0px rgba(0,0,0,0.66); */
  }

  /* Colors and things for styling */
  .elementContainerStyling {
    border-radius: 5px;
    box-shadow: inset 0px 0px 10px 2px rgba(0,0,0,0.7);
    background-color: rgb(230, 230, 230);
  }
  .wrapperStyling {
    border-radius: 5px;
    /* background-color: rgb(255, 255, 255); */
    /* box-shadow: 0px 0px 10px 2px rgba(0,0,0,0.75); */
  }
  .networkItem {
    background-color: rgb(139, 139, 139);
    border-radius: 5px;
  }
  .networkDivider {
    background-color: rgb(61, 61, 61);
  }
  .newItemBlock {
    height: 20px;
    margin: 12px;
    width: 75%;
    background-color: grey;
    border-radius: 5px;
  }
  .networkError {
    border-color: darkred;
  }
  .exitHover {
    border-color: red;
  }
  .networkWarn {
    border-color: rgb(199, 129, 0);
  }
  #processButton:hover {
    box-shadow: 0px 0px 5px 2px rgba(0,0,0,0.75);
    background-color:rgb(84, 14, 90);
    /* border-color: rgb(68, 14, 73); */
  }
  #processButton:active {
    background-color: rgb(84, 14, 90);
    /* border-color: rgb(36, 6, 39); */
  }
  /* Media Queries (TODO)*/

    @media screen and (min-height: 840px) {
      h1 {
        font-size: 30px;
      }
      .networkItem > h2 {
        font-size: 25px;
      }
      .networkItem > h3 {
        font-size: 15px;
      }
      .networkItem > h4 {
        font-size: 13px;
      }
      .globalOptionBox div {
        font-size: 23px;
      }
      .globalOptionBox h2 {
        font-size: 30px;
      }
    }
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

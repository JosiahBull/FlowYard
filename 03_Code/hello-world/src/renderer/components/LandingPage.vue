<template>
  <div id="wrapper">
    <div id="networkConfigWindow">
      <h1>Network Configuration</h1>
      <div id="networkConfigWrapper">
        <div v-for="network in pipeNetworks" class="networkItem">
          <h3>Pipe Network: {{network.id}}</h3>
          <div class="networkDivider"></div>
          <h3>Shape File: {{network.shapeFile}}</h3>
          <h3>Point File: {{network.pointFile}}</h3>
          <div class="networkDivider"></div>
          <input type="checkbox" id="checkbox" v-model="network.checkInternalIntersections">
          <h4>Check Internal Intersections: {{network.checkInternalIntersections}}</h4>
          <h4>Check Global Intersections: {{network.checkGlobalIntersections}}</h4>
          <h4>Pipe Diameter: {{network.diameter}}</h4>
        </div>
      </div>
    </div>
  
    <div id="outputPreviewWRapper" v-on:click="test()">
      <h1>Output Preview</h1>
      <canvas id="outputCanvas"></canvas>
    </div>

    <div id="outputInfoWrapper">
      <div id="consoleOut">
        <h2>Processed Network Information</h2>
        
      </div>
      <div id="keyOut">
        <h2>Key</h2>

      </div>
    </div>
    <button name="processNetworkButton" type="button" id="processButton">Process!</button>
    <div id="footer"></div>
  </div>
</template>

<script>
  import SystemInformation from './LandingPage/SystemInformation'
  const {dialog} = require('electron');
  
  export default {
    name: 'landing-page',
    components: { SystemInformation },
    methods: {
      open (link) {
        this.$electron.shell.openExternal(link)
      },
      test () {
        console.log(dialog.showOpenDialog({properties: ['openFile', 'openDirectory', 'multiSelections']}));
      }
    },
    data: function() {
      return {
        pipeNetworks: [
          {
            id: 0,
            shapeFile: 'Click To Select',
            pointFile: 'Click To Select',
            checkInternalIntersections: true,
            checkGlobalIntersections: false,
            diameter: 100
          },
          {
            id: 1,
            shapeFile: 'Click To Select',
            pointFile: 'Click To Select',
            checkInternalIntersections: true,
            checkGlobalIntersections: false,
            diameter: 150
          }
        ]
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

  }
  /* Processing Button CSS */
  #processButton {
    height: 80px;
    width: 220px;
    position:absolute;
    bottom: 55px;
    right: 70px;
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
    width: 830px;
    height: 90%;
    background-color: #6acc8c;
    position: absolute;
    top: 5%;
    left: 50px;
  }
  #networkConfigWrapper {
    position: absolute;
    left: 3%;
    top: 8%;
    width: 94%;
    height: 90%;
    background-color: darkblue;
  }
  .networkItem {
    background-color: aqua;
  }
  /* Output Preview Things */
  #outputPreviewWRapper {
    width: 900px;
    height: 65%;
    background-color: #6acc8c;
    position: absolute;
    right: 70px;
    top: 5%;
  }
  #outputCanvas {
    position: absolute;
    left: 3%;
    top: 11%;
    width: 94%;
    height: 86%;
    background-color: darkblue;
  }
  /* Output Info Things */
  #outputInfoWrapper {
    width: 600px;
    height: 20%;
    background-color: #5891ed;
    position:absolute;
    bottom: 5%;
    right: 370px;
  }
  #consoleOut {

  }
  #keyOut {

  }
  /* Foooter */
  #footer {
    width: 100%;
    height: 25px;
    position: absolute;
    bottom:0;
    background-color: purple;
  }
</style>

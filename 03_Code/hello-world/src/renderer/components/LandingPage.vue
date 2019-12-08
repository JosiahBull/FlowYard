<template>
  <div id="wrapper">
    <div id="networkConfigWindow">
      <h1>Network Configuration</h1>
      <div id="networkConfigWrapper">

      </div>
    </div>
  
    <div id="outputPreviewWRapper">
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

  export default {
    name: 'landing-page',
    components: { SystemInformation },
    methods: {
      open (link) {
        this.$electron.shell.openExternal(link)
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
  /* Wrapper CSS */
  #wrapper {

  }
  /* Processing Button CSS */
  #processButton {
    height: 60px;
    width: 180px;
    position:absolute;
    bottom: 4%;
    right: 3%;
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

  }
  #networkConfigWrapper {

  }
  /* Output Preview Things */
  #outputPreviewWRapper {
    width: 200px;
    height: 200px;
    background-color: #6acc8c;
  }
  #outputCanvas {

  }
  /* Output Info Things */
  #outputInfoWrapper {
    width: 200px;
    height: 200px;
    background-color: #5891ed;
    position: absolute;
    left: 400px;
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

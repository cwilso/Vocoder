var audioContext = null;
var modulatorBuffer = null;
var carrierBuffer = null;
var modulatorNode = null;
var carrierNode = null;
var vocoding = false;


// Debug visualizer stuff here
var analyser1;
var analyser2;
var analyserView1;
var analyserView2;

o3djs.require('o3djs.shader');


function playModulator() {
	modulatorNode = audioContext.createBufferSource();
	modulatorNode.buffer = modulatorBuffer;
	
	vocoding = false;
	modulatorNode.connect( audioContext.destination );
	modulatorNode.noteOn(0);

	modulatorNode.connect( analyser1 );
	analyserView1.setOverlayText( "Modulator" );

  	window.webkitRequestAnimationFrame( updateAnalysers );
	window.setTimeout( cancelVocoderUpdates, modulatorNode.buffer.duration * 1000 + 20 );
}

function vocodeUsingWaveTable() {
	oscillatorNode = audioContext.createOscillator();
	oscillatorNode.type = oscillatorNode.CUSTOM;
	oscillatorNode.frequency.value = 110;
	oscillatorNode.setWaveTable(wavetable);
	addSingleValueSlider( "Wavetable detune", oscillatorNode.detune.value, -1200.0, 1200.0, oscillatorNode, updateSingleDetune );

	oscillatorGain = audioContext.createGainNode();
	oscillatorGain.gain.value = 70.0;
	oscillatorNode.connect(oscillatorGain);
	addSingleValueSlider( "WaveTable gain", oscillatorGain.gain.value, 0.0, 100.0, oscillatorGain, updateSingleGain );

	noiseNode = audioContext.createBufferSource();
	noiseNode.buffer = noiseBuffer;
	noiseNode.loop = true;
	noiseGain = audioContext.createGainNode();
	noiseGain.gain.value = 0.3;
	addSingleValueSlider( "WaveTable noise gain", noiseGain.gain.value, 0.0, 1.0, noiseGain, updateSingleGain );
	noiseNode.connect(noiseGain);

	oscillatorGain.connect(carrierInput);
	noiseGain.connect(carrierInput);
	oscillatorNode.noteOn(0);
	noiseNode.noteOn(0);
	vocoding = true;

	modulatorNode = audioContext.createBufferSource();
	modulatorNode.buffer = modulatorBuffer;
	modulatorNode.connect( modulatorInput );
	modulatorNode.noteOn(0);

 	window.webkitRequestAnimationFrame( updateAnalysers );
}

function stop() {
	if (oscillatorNode && oscillatorNode.noteOff)
		oscillatorNode.noteOff(0);
	if (noiseNode)
		noiseNode.noteOff(0);
	if (modulatorNode)
		modulatorNode.noteOff(0);
	if (carrierNode)
		carrierNode.noteOff(0);
	vocoding = false;
	window.webkitCancelAnimationFrame( rafID );
}

function setupVocoderGraph() {
//	clearSliders();

	outputAnalyser = audioContext.createAnalyser();
	outputAnalyser.fftSize = 2048;
	outputAnalyser.smoothingTimeConstant = 0.0;
	initBandpassFilters();
}

function vocodeUsingCarrierBuffer() {
	if (!modulatorBuffer || !carrierBuffer) {
		console.log("Error - buffers not loaded");
		return;
	}

	vocoding = true;

	carrierNode = audioContext.createBufferSource();
	carrierNode.buffer = carrierBuffer;
	carrierNode.loop = true;
	carrierNode.connect( carrierInput );
	
	modulatorNode = audioContext.createBufferSource();
	modulatorNode.buffer = modulatorBuffer;
	modulatorNode.connect( modulatorInput );

	carrierNode.noteOn(0);
	modulatorNode.noteOn(0);

  	window.webkitRequestAnimationFrame( updateAnalysers );
	window.setTimeout( cancelVocoderUpdates, modulatorNode.buffer.duration * 1000 + 20 );
}

function loadModulator( buffer ) {
	modulatorBuffer = buffer;
	var e = document.getElementById("modulator");
	e.classList.remove("notready");  
	e.classList.add("ready");
}

function loadCarrier( buffer ) {
	carrierBuffer = buffer;
	var e = document.getElementById("carrier");
	e.classList.remove("notready");  
	e.classList.add("ready");
	if (vocoding) {
		newCarrierNode = audioContext.createBufferSource();
		newCarrierNode.buffer = carrierBuffer;
		newCarrierNode.loop = true;
		newCarrierNode.connect( carrierInput );
		carrierNode.disconnect();
		newCarrierNode.noteOn(0);
		carrierNode.noteOff(0);
		carrierNode = newCarrierNode;	
	}
}

function downloadAudioFromURL( url, cb ){
	var request = new XMLHttpRequest();
  	request.open('GET', url, true);
  	request.responseType = 'arraybuffer';

  	// Decode asynchronously
  	request.onload = function() {
    	audioContext.decodeAudioData( request.response, function(buffer) {
      		cb(buffer);
    	}, function(){alert("error loading!");});
  	}
  	request.send();
}

function startLoadingModulator( url ) {
	modulatorBuffer = null;
	var e = document.getElementById("modurl");
	e.innerHTML = '"' + url + '"';
	e = document.getElementById("modulator");
	e.classList.remove("ready");  
	e.classList.add("notready");
	downloadAudioFromURL( url, loadModulator );
}

function startLoadingCarrier( url ) {
	carrierBuffer = null;
	var e = document.getElementById("carurl");
	e.innerHTML = '"' + url + '"';
	e = document.getElementById("carrier");
	e.classList.remove("ready");  
	e.classList.add("notready");
	downloadAudioFromURL( url, loadCarrier );
}

// Set up the page as a drop site for audio files. When an audio file is
// dropped on the page, it will be auto-loaded as an AudioBufferSourceNode.
function initDragDropOfAudioFiles() {
	var mod = document.getElementById("modulator");
	
	mod.ondragenter = function () { this.classList.add("hover"); return false; };
	mod.ondragleave = function () { this.classList.remove("hover"); return false; };
	mod.ondrop = function (e) {
  		this.classList.remove("hover");
  		e.preventDefault();
		modulatorBuffer = null;
		var m = document.getElementById("modurl");
		m.innerHTML = '"' + e.dataTransfer.files[0].name + '"';
		mod.classList.remove("ready");  
		mod.classList.add("notready");

	  	var reader = new FileReader();
	  	reader.onload = function (event) {
	  		audioContext.decodeAudioData( event.target.result, function(buffer) {
	    		loadModulator( buffer );
	  		}, function(){alert("error loading!");} ); 

	  	};
	  	reader.onerror = function (event) {
	  		alert("Error: " + reader.error );
		};
	  	reader.readAsArrayBuffer(e.dataTransfer.files[0]);
	  	return false;
	};	
	var car = document.getElementById("carrier");
	
	car.ondragenter = function () { this.classList.add("hover"); return false; };
	car.ondragleave = function () { this.classList.remove("hover"); return false; };
	car.ondrop = function (e) {
  		this.classList.remove("hover");
  		e.preventDefault();
		carrierBuffer = null;
		var c = document.getElementById("carurl");
		c.innerHTML = '"' + e.dataTransfer.files[0].name + '"';
		car.classList.remove("ready");  
		car.classList.add("notready");

	  	var reader = new FileReader();
	  	reader.onload = function (event) {
	  		audioContext.decodeAudioData( event.target.result, function(buffer) {
	    		loadCarrier( buffer );
	  		}, function(){alert("error loading!");} ); 

	  	};
	  	reader.onerror = function (event) {
	  		alert("Error: " + reader.error );
		};
	  	reader.readAsArrayBuffer(e.dataTransfer.files[0]);
	  	return false;
	};	
}

// Initialization function for the page.
function init() {
  	try {
    	audioContext = new webkitAudioContext();
  	}
  	catch(e) {
    	alert('Web Audio API is not supported in this browser');
  	}

	initDragDropOfAudioFiles();	// set up panels as drop sites for audio files

	outputCanvas = document.getElementById("ocanvas").getContext('2d');
	vocoderCanvas = document.getElementById("vcanvas").getContext('2d');

	startLoadingModulator( "gettysburg.ogg" );
	startLoadingCarrier( "Saw.ogg" );

	// Debug visualizer
    analyser1 = audioContext.createAnalyser();
    analyser1.fftSize = 2048;
    analyser2 = audioContext.createAnalyser();
    analyser2.fftSize = 2048;

    analyserView1 = new AnalyserView("view1", "overlay1");
    analyserView1.initByteBuffer( analyser1 );
    analyserView2 = new AnalyserView("view2", "overlay2");
    analyserView2.initByteBuffer( analyser2 );

    // Set up the vocoder chains
    setupVocoderGraph();

}

function keyevent( event ) {
	if (event)
		return;
}

window.onload=init;
window.onkeydown=keyevent();

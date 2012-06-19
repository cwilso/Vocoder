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

//constants for carrier buttons
var FILE = 0, SAWTOOTH=1, WAVETABLE=2, FILENAME=-1;

o3djs.require('o3djs.shader');

function previewCarrier() {
	if (this.event) 
		this.event.preventDefault();

	var carrierPreviewImg = document.getElementById("carrierpreview");
	if (carrierPreviewImg.classList.contains("playing") ) {
		finishPreviewingCarrier();
		return;
	}

	if (carrierNode) {	// we must already be playing
		// TODO: stop vocoding?
	}
	
	carrierPreviewImg.classList.add("playing");
	carrierPreviewImg.src = "img/ico-stop.png";
	carrierNode = audioContext.createBufferSource();
	carrierNode.buffer = modulatorBuffer;
	
	vocoding = false;
	carrierNode.connect( audioContext.destination );
	carrierNode.connect( analyser1 );

	carrierNode.noteOn(0);

  	window.webkitRequestAnimationFrame( updateAnalysers );

  	if (isBufferSample)
		window.setTimeout( finishPreviewingCarrier, carrierNode.buffer.duration * 1000 + 20 );
}

function previewModulator() {
	if (this.event) 
		this.event.preventDefault();

	var modPreviewImg = document.getElementById("modulatorpreview");
	if (modPreviewImg.classList.contains("playing") ) {
		finishPreviewingModulator();
		return;
	}

	if (modulatorNode) {	// we must already be playing
		// TODO: stop vocoding?
	}
	
	modPreviewImg.classList.add("playing");
	modPreviewImg.src = "img/ico-stop.png";
	modulatorNode = audioContext.createBufferSource();
	modulatorNode.buffer = modulatorBuffer;
	
	vocoding = false;
	modulatorNode.connect( audioContext.destination );
	modulatorNode.connect( analyser1 );

	modulatorNode.noteOn(0);

  	window.webkitRequestAnimationFrame( updateAnalysers );
	window.setTimeout( finishPreviewingModulator, modulatorNode.buffer.duration * 1000 + 20 );
}

function finishPreviewingModulator() {
	var modPreviewImg = document.getElementById("modulatorpreview");
	cancelVocoderUpdates();
	modulatorNode.noteOff(0);
	modulatorNode = null;
	modPreviewImg.classList.remove("playing");
	modPreviewImg.src = "img/ico-play.png";
}

function vocodeUsingWaveTable() {
	if (this.event) 
		this.event.preventDefault();

	if (vocoding) {
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
		return;
	}

	oscillatorNode = audioContext.createOscillator();
	oscillatorNode.type = oscillatorNode.CUSTOM;
	oscillatorNode.frequency.value = 110;
	oscillatorNode.setWaveTable(wavetable);
	var wavetableSignalGain = audioContext.createGainNode();
	wavetableSignalGain.gain.value = 70.0;
	oscillatorNode.connect(wavetableSignalGain);

	carrierSignalGain = audioContext.createGainNode();
	carrierSignalGain.gain.value = 1.0;
	wavetableSignalGain.connect(carrierSignalGain);

	noiseNode = audioContext.createBufferSource();
	noiseNode.buffer = noiseBuffer;
	noiseNode.loop = true;
	noiseGain = audioContext.createGainNode();
	noiseGain.gain.value = 0.3;
	noiseNode.connect(noiseGain);

	carrierSignalGain.connect(carrierInput);
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

function selectCarrier( type ) {
	if (this.event) 
		this.event.preventDefault();

	switch (type) {
		case 0:  // selected the file
		case 1:  // Sawtooth wave
		case 2:  // Wavetable
		case -1:  // open new file dialog
	}
}

function setModulatorFileName( url ) {
	var lastSlash = url.lastIndexOf( "/" );
	if (lastSlash != -1)
		url = url.slice(lastSlash+1);

	var mod = document.getElementById("modulatorfilename");
	if (mod)
		mod.innerText = url;
}

function setCarrierFileName( url ) {
	var lastSlash = url.lastIndexOf( "/" );
	if (lastSlash != -1)
		url = url.slice(lastSlash+1);

	var carrier = document.getElementById("carrierfilename");
	if (carrier)
		carrier.innerText = url;
}

function startLoadingModulator( url ) {
	modulatorBuffer = null;
	setModulatorFileName( url );
	downloadAudioFromURL( url, loadModulator );
}

function startLoadingCarrier( url ) {
	carrierBuffer = null;
	setCarrierFileName( url )
	downloadAudioFromURL( url, loadCarrier );
}

// Set up the page as a drop site for audio files. When an audio file is
// dropped on the page, it will be auto-loaded as an AudioBufferSourceNode.
function initDragDropOfAudioFiles() {
	var mod = document.getElementById("modulator");
	
	mod.ondragenter = function () { 
		this.classList.add("droptarget"); 
		return false; };
	mod.ondragleave = function () { this.classList.remove("droptarget"); return false; };
	mod.ondrop = function (e) {
  		this.classList.remove("droptarget");
  		e.preventDefault();
		modulatorBuffer = null;
		setModulatorFileName( e.dataTransfer.files[0].name );

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

function updateSlider(event, ui, units) {
	var e = event.target;
	var group = null;
	while (!e.classList.contains("module")) {
		if (e.classList.contains("control-group"))
			group = e;
		e = e.parentNode;
	}

	//TODO: yes, this is lazy coding, and fragile.
	var output = group.children[0].children[1];

	// update the value text
	output.innerText = "" + ui.value + units;
}

function onUpdateSignalLevel(event, ui) {
	updateSlider(event, ui, this.units );
	if (carrierSignalGain)
		carrierSignalGain.gain.value = ui.value;
}

function onUpdateNoiseLevel(event, ui) {
	updateSlider(event, ui, this.units );
	if (noiseGain)
		noiseGain.gain.value = ui.value;
}

function onUpdateDetuneLevel(event, ui) {
	updateSlider(event, ui, this.units );
	if (oscillatorNode)
		oscillatorNode.detune.value = ui.value;
}

function loadModulatorFile() {
	if (this.event) 
		this.event.preventDefault();

	alert("Try dropping a file onto the modulator.");
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

	generateVocoderBands( 55, 7040, 28 );

// I used to have another debugging visualizer.
//	outputCanvas = document.getElementById("ocanvas").getContext('2d');

	vocoderCanvas = document.getElementById("vcanvas").getContext('2d');

	startLoadingModulator( "audio/gettysburg.ogg" );
	startLoadingCarrier( "audio/junky.ogg" );

	// Debug visualizer
    analyser1 = audioContext.createAnalyser();
    analyser1.fftSize = 1024;
    analyser2 = audioContext.createAnalyser();
    analyser2.fftSize = 1024;

    analyserView1 = new AnalyserView("view1");
    analyserView1.initByteBuffer( analyser1 );
    analyserView2 = new AnalyserView("view2");
    analyserView2.initByteBuffer( analyser2 );

    // Set up the vocoder chains
    setupVocoderGraph();

	var slider = document.createElement("div");
	slider.className="slider";
	document.getElementById("signalgroup").appendChild(slider);
	$( slider ).slider( { slide: onUpdateSignalLevel, value: 1.0, min: 0.0, max: 2.0, step: 0.01 } );
	slider.units = "";

	slider = document.createElement("div");
	slider.className="slider";
	document.getElementById("noisegroup").appendChild(slider);
	$( slider ).slider( { slide: onUpdateNoiseLevel, value: 0.22, min: 0.0, max: 2.0, step: 0.01 } );
	slider.units = "";

	slider = document.createElement("div");
	slider.className="slider";
	document.getElementById("detunegroup").appendChild(slider);
	$( slider ).slider( { slide: onUpdateDetuneLevel, value: 0, min: -1200, max: 1200, step: 1 } );
	slider.units = "cents";
}

function keyevent( event ) {
	if (event)
		return;
}

window.onload=init;
window.onkeydown=keyevent();

var animationRunning = false;
var analysers = new Array;
var CANVAS_WIDTH = 600;
var CANVAS_HEIGHT = 120;
var modulatorAnalyser = null;
var carrierAnalyser = null;
var outputAnalyser = null;
var modulatorCanvas = null;
var carrierCanvas = null;
var outputCanvas = null;

var vocoderBands = [	// The vocoder bands. "bottom" and "top" are purely informational.
{ width: 1,   frequency: 33.075,  bottom: 22.05,   top: 44.10   },
{ width: 2,   frequency: 66.15,   bottom: 44.10,   top: 88.20   },
{ width: 4,   frequency: 132.3,   bottom: 88.20,   top: 176.40  },
{ width: 8,   frequency: 246.6,   bottom: 176.40,  top: 352.80  },
{ width: 16,  frequency: 529.2,   bottom: 352.8,   top: 705.6   },
{ width: 32,  frequency: 1058.4,  bottom: 705.6,   top: 1411.2  },
{ width: 64,  frequency: 2116.8,  bottom: 1411.2,  top: 2822.4  },
{ width: 128, frequency: 4233.6,  bottom: 2822.4,  top: 5644.8  },
{ width: 256, frequency: 8467.2,  bottom: 5644.8,  top: 11289.6 },
{ width: 512, frequency: 16934.4, bottom: 11289.6, top: 22579.2 }
];

var numVocoderBands = 10;
var filters = null;
var gains =  null;

function initBandpassFilters() {
	// When this function is called, the carrierNode and modulatorAnalyser should already be created.
	if (!carrierNode) {
		console.log("no carrier node!\n");
		return;
	}
	
	if (filters == null)
		filters = new Array();
	
	if (gains == null)
		gains = new Array();

	if (filters.length != numVocoderBands) {
		//clear the array
		filters.length = 0;
		
		for (var i=0; i<numVocoderBands; i++) {
			var filter = audioContext.createBiquadFilter();
			filter.type = 2;	// Bandpass filter
			filter.frequency.value = vocoderBands[i].frequency;
			filter.Q.value = 1.0;
			console.log( "freq: " + filter.frequency.value );
			filters.push( filter );
			var gain = audioContext.createGainNode();
			
			//initial gain value of each bandpass filter
			gain.gain.value = 0.0;
			gains.push( gain );
			
			filter.connect( gain );
			
			if (outputAnalyser == null) {
			 	outputAnalyser = audioContext.createAnalyser();
				outputAnalyser.fftSize = 512;
				outputAnalyser.smoothingTimeConstant = 0.0;
				outputAnalyser.connect( audioContext.destination );
			}
			gain.connect( outputAnalyser );
		}
	}

	// connect the filters
	for (var i=0; i<numVocoderBands; i++)
		carrierNode.connect( filters[i] );
}


function updateAnalyser( analyserNode, drawContext ) {
	var SPACER_WIDTH = 2;
	var BAR_WIDTH = 2;
	var OFFSET = 100;
	var CUTOFF = 23;
	var numBars = Math.round(CANVAS_WIDTH / SPACER_WIDTH);
	var freqByteData = new Uint8Array(analyserNode.frequencyBinCount);

	analyserNode.getByteFrequencyData(freqByteData); 

	drawContext.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  	drawContext.fillStyle = '#F6D565';
  	drawContext.lineCap = 'round';
	var multiplier = analyserNode.frequencyBinCount / numBars;

	// Draw rectangle for each frequency bin.
	for (var i = 0; i < numBars; ++i) {
		var magnitude = 0;
		var offset = Math.floor( i * multiplier );
		// gotta sum/average the block, or we miss narrow-bandwidth spikes
		for (var j = 0; j< multiplier; j++)
			magnitude += freqByteData[offset + j];
		magnitude = magnitude / multiplier;
		var magnitude2 = freqByteData[i * multiplier];
    	drawContext.fillStyle = "hsl( " + Math.round((i*360)/numBars) + ", 100%, 50%)";
    	drawContext.fillRect(i * SPACER_WIDTH, CANVAS_HEIGHT, BAR_WIDTH, -magnitude);
	}
//	console.log("\n" + analyserNode.frequencyBinCount);
}

function drawVocoderGains() {
	vocoderCanvas.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  	vocoderCanvas.fillStyle = '#F6D565';
  	vocoderCanvas.lineCap = 'round';
	var binWidth = CANVAS_WIDTH / numVocoderBands;

	// Draw rectangle for each vocoder bin.
	for (var i = 0; i < numVocoderBands; ++i) {
    	vocoderCanvas.fillStyle = "hsl( " + Math.round((i*360)/numVocoderBands) + ", 100%, 50%)";
    	vocoderCanvas.fillRect(i * binWidth, CANVAS_HEIGHT, binWidth, -gains[i].gain.value * CANVAS_HEIGHT );
	}
	
}


var logs = 500;
var vtimer = null;

function updateVocoderGainNodes() {
	var freqByteData = new Uint8Array(modulatorAnalyser.frequencyBinCount);
	modulatorAnalyser.getByteFrequencyData(freqByteData); 

	var anl_idx = 1; //skip the bottom frequency bucket, it's inaudible.
	
	for (var vcd_idx = 0; vcd_idx<numVocoderBands; vcd_idx++ ) {	// walk through the vocoder bands
		var width = vocoderBands[vcd_idx].width;
		var end = anl_idx + width;
		var sum = 0.0;
		for (; anl_idx < end; anl_idx++)
			sum += freqByteData[anl_idx];
		sum /= (width*256);
		gains[vcd_idx].gain.exponentialRampToValueAtTime( sum, 0.020 ); 

		// console logging for debugging
//		if (logs-- > 0)
//			console.log( "vcd_idx=" + vcd_idx + " gain=" + gains[vcd_idx].gain.value );
	}	
	drawVocoderGains();
	console.log( "vcd update: " + Date.now() );
	vtimer = window.setTimeout(updateVocoderGainNodes, 25);
}

function cancelVocoderUpdates() {
	window.clearTimeout( vtimer );
}

function updateAnalysers(time) {
	if ( modulatorAnalyser )
		updateAnalyser( modulatorAnalyser, modulatorCanvas );
	if ( carrierAnalyser )
		updateAnalyser( carrierAnalyser, carrierCanvas );
	if ( outputAnalyser )
		updateAnalyser( outputAnalyser, outputCanvas );
		
//	updateVocoderGainNodes();
	
  	window.webkitRequestAnimationFrame( updateAnalysers );
}


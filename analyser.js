var CANVAS_WIDTH = 1200;
var CANVAS_HEIGHT = 120;
var animationRunning = false;
var analysers = new Array;
var modulatorAnalyser = null;
var carrierAnalyser = null;
var outputAnalyser = null;
var filters = null;
var gains =  null;
var modulatorCanvas = null;
var carrierCanvas = null;
var outputCanvas = null;
var DEBUG_BAND = 4;		// if you uncomment the debug band line in updateVocoderGains,
						// this is the band of the vocoder that will play.

var vocoderBands = [	// The vocoder bands. "bottom" and "top" are purely informational.
{ width: 1,   Q: 200.0, frequency: 33.075,  bottom: 22.05,   top: 44.10   },
{ width: 2,   Q: 200.0, frequency: 66.15,   bottom: 44.10,   top: 88.20   },
{ width: 4,   Q: 200.0, frequency: 132.3,   bottom: 88.20,   top: 176.40  },
{ width: 8,   Q: 200.0, frequency: 246.6,   bottom: 176.40,  top: 352.80  },
{ width: 16,  Q: 100.0, frequency: 529.2,   bottom: 352.8,   top: 705.6   },
{ width: 32,  Q:  50.0, frequency: 1058.4,  bottom: 705.6,   top: 1411.2  },
{ width: 64,  Q:  30.0, frequency: 2116.8,  bottom: 1411.2,  top: 2822.4  },
{ width: 128, Q:   8.0, frequency: 4233.6,  bottom: 2822.4,  top: 5644.8  },
{ width: 256, Q:   5.0, frequency: 8467.2,  bottom: 5644.8,  top: 11289.6 },
{ width: 512, Q:   4.0, frequency: 16934.4, bottom: 11289.6, top: 22579.2 }
];

var numVocoderBands = 10;



//  Notes for band-pass filter approach (to be implemented):
// The general approach is to feed the modulator signal through a bank of tuned band-pass filters.
// Each band-pass filter should then be multiplied by a sine wave at the band's center frequency
// (this is accomplished by feeding the sine wave audio signal into a gain node's gain AudioParam -
// AudioNode.connect() now has a prototype that takes an AudioParam as an input.)  To obtain power,
// the output of this multiplication should then be multipled by itself (again, via GainNode.gain),
// then fed through a low-pass filter capped at 8Hz-200Hz (experimentation time!) to remove the
// double-frequency noise.[1]  This should give the effect of an envelope follower - which can then
// be fed into a gain node on a band-pass'ed instance of the carrier signal.
//
// [1] From http://en.wikipedia.org/wiki/Heterodyne - multiplying signals in this way creates two
// new signals, one at the sum f1 + f2 of the frequencies, and the other at the difference f1 - f2.
// Masking off the upper will result in obtaining the power signal.
//
// Could use an OscillatorNode (CRogers will publish editors draft spec today/Monday) as carrier -
// Chris mentioned a "pulse train"?
//
// Need to pull the WebGL visualizer code as a debugging visualizer.
//
// Oscillator's current peak-to-peak normalization is 0.5 to -0.5; it will change to 1 to -1.




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

//	if (filters.length != numVocoderBands) {
		//clear the array
		filters.length = 0;
		
		for (var i=0; i<numVocoderBands; i++) {
			var filter = audioContext.createBiquadFilter();
			filter.type = 2;	// Bandpass filter
			filter.frequency.value = vocoderBands[i].frequency;
			filter.Q.value = vocoderBands[i].Q;
			console.log( "freq: " + filter.frequency.value );
			filters.push( filter );
			var gain = audioContext.createGainNode();
			
			//initial gain value of each bandpass filter
			gain.gain.value = 0.0;
			gains.push( gain );
			
			filter.connect( gain );
			
			if (outputAnalyser == null) {
			 	outputAnalyser = audioContext.createAnalyser();
				outputAnalyser.fftSize = 2048;
				outputAnalyser.smoothingTimeConstant = 0.0;
				outputAnalyser.connect( audioContext.destination );
			}
			gain.connect( outputAnalyser );
		}
//	}

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
	//draw lines for vocoder frequency band centers
   	drawContext.fillStyle = "#000000";
   	var nyquist = audioContext.sampleRate / 2;
	for (var i = 0; i < numVocoderBands; ++i) {
		// line should be at: vocoderBands[i].frequency * CANVAS_WIDTH / nyquist
		var x = vocoderBands[i].frequency * CANVAS_WIDTH / nyquist;
     	drawContext.beginPath();  
   		drawContext.moveTo( x, 0 );  
		drawContext.lineTo( x, CANVAS_HEIGHT );  
		drawContext.stroke();
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
			sum += freqByteData[anl_idx] / 2;
		sum /= (width*256);
//		if (vcd_idx == DEBUG_BAND )	// uncomment for band-by-band debugging
		gains[vcd_idx].gain.exponentialRampToValueAtTime( sum, 0.020 ); 

		// console logging for debugging
//		if (logs-- > 0)
//			console.log( "vcd_idx=" + vcd_idx + " gain=" + gains[vcd_idx].gain.value );
	}	
	drawVocoderGains();
//	console.log( "vcd update: " + Date.now() );
//	vtimer = window.setTimeout(updateVocoderGainNodes, 25);
}

var rafID = null;

function cancelVocoderUpdates() {
//	window.clearTimeout( vtimer );
	window.webkitCancelAnimationFrame( rafID );
	modulatorNode = null;
	carrierNode = null;
	vocoding = false;
	modulatorAnalyser = null;
	carrierAnalyser = null;
	outputAnalyser = null;
	filters = null;
	gains =  null;
}

function updateAnalysers(time) {
	if ( modulatorAnalyser )
		updateAnalyser( modulatorAnalyser, modulatorCanvas );
	if ( carrierAnalyser )
		updateAnalyser( carrierAnalyser, carrierCanvas );
	if ( outputAnalyser )
		updateAnalyser( outputAnalyser, outputCanvas );
		
	if ( vocoding)
		updateVocoderGainNodes();
	
  	rafID = window.webkitRequestAnimationFrame( updateAnalysers );
}


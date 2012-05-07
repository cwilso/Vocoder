var CANVAS_WIDTH = 2000;
var CANVAS_HEIGHT = 120;

var FILTER_QUALITY = 20;  // 4.2;	// The Q value for the carrier and modulator filters

var animationRunning = false;
var modulatorAnalyser = null;
var carrierAnalyser = null;
var outputAnalyser = null;

var modFilterBands = null;		// tuned bandpass filters
var modFilterPostGains = null;	// post-filter gains.
var heterodynes = null;		// gain nodes used to multiply bandpass X sine
var powers = null;			// gain nodes used to multiply prev out by itself
var lpFilters = null;		// tuned LP filters to remove doubled copy of product
var carrierBands = null;	// tuned bandpass filters, same as modFilterBands but in carrier chain
var carrierFilterPostGains = null;	// post-bandpass gain adjustment
var carrierBandGains = null;	// these are the "control gains" driven by the lpFilters

var modulatorCanvas = null;
var carrierCanvas = null;
var outputCanvas = null;
var DEBUG_BAND = 8;		// current debug band - used to display a filtered signal

var vocoderBands = [	// The vocoder bands.
// { Q: 200.0, frequency: 50	},
{ Q: 200.0, frequency: 158 		},
{ Q: 200.0, frequency: 200	},
{ Q: 200.0, frequency: 252 	},
{ Q: 200.0, frequency: 317	},
{ Q: 200.0, frequency: 400  },
{ Q: 200.0, frequency: 504	},
{ Q: 100.0, frequency: 635  },
{ Q: 200.0, frequency: 800	},
{ Q:  50.0, frequency: 1008 },
{ Q: 200.0, frequency: 1270	},
{ Q:  30.0, frequency: 1600 },
{ Q: 200.0, frequency: 2016	},
{ Q:   8.0, frequency: 2504 },
{ Q: 200.0, frequency: 3200	},
{ Q: 200.0, frequency: 4032	},
{ Q: 200.0, frequency: 5080	}
];
var numVocoderBands = 16;

// this function will algorithmically re-calculate vocoder bands, distributing evenly
// from startFreq to endFreq, splitting evenly (logarhythmically) into a given numBands.
// The function places this info into the global vocoderBands and numVocoderBands variables.
var newVocoderBands = null;
var numNewVocoderBands = 0;

function generateVocoderBands( startFreq, endFreq, numBands ) {
	// Remember: 1200 cents in octave, 100 cents per semitone

	var totalRangeInCents = 1200 * Math.log( endFreq / startFreq ) / Math.LN2;
	var centsPerBand = totalRangeInCents / numBands;
	var scale = Math.pow( 2, centsPerBand / 1200 );  // This is the scaling for successive bands

	newVocoderBands = new Array();
	var currentFreq = startFreq;

	for (var i=0; i<numBands; i++) {
		newVocoderBands[i] = new Object();
		newVocoderBands[i].frequency = currentFreq;
		currentFreq = currentFreq * scale;
	}

	numNewVocoderBands = numBands;
}

generateVocoderBands( 55, 7040, 30 );

/*  Moog vocoder bands - these are the boundaries between bands, not the bands' center freqs.
50 		
158		
200
252
317
400
504
635
800
1008
1270
1600
2016
2504
3200
4032
5080
*/




function initBandpassFilters() {
	// When this function is called, the carrierNode and modulatorAnalyser should already be created.
	if (!carrierNode) {
		console.log("no carrier node!\n");
		return;
	}

	if (!modulatorNode) {
		console.log("no modulator node!\n");
		return;
	}

/*
	modFilterBands = null;		// tuned bandpass filters
	multipliers = null;		// gain nodes used to multiply bandpass X sine
	heterodynes = null;		// gain nodes used to multiply prev out by itself
	lpFilters = null;		// tuned LP filters to remove doubled copy of product
	carrierBands = null;	// tuned bandpass filters connected to carrier
	carrierGains = null;	// gains on carrier bandpass filters
*/

	if (modFilterBands == null)
		modFilterBands = new Array();

	if (modFilterPostGains == null)
		modFilterPostGains = new Array();

	if (heterodynes == null)
		heterodynes = new Array();
	
	if (powers == null)
		powers = new Array();

	if (lpFilters == null)
		lpFilters = new Array();
	
	if (carrierBands == null)
		carrierBands = new Array();

	if (carrierFilterPostGains == null)
		carrierFilterPostGains = new Array();

	if (carrierBandGains == null)
		carrierBandGains = new Array();

    var waveShaperCurve = new Float32Array(65536);
    generateMirrorCurve(waveShaperCurve);	// Populate with a curve that soft-clips AND does an abs()
	
	// Set up a high-pass filter to add back in the fricatives, etc.
	var hpFilter = audioContext.createBiquadFilter();
	hpFilter.type = hpFilter.HIGHPASS;	// Bandpass filter
	hpFilter.frequency.value = vocoderBands[numVocoderBands-1].frequency;
	hpFilter.Q.value = FILTER_QUALITY; // 	vocoderBands[i].Q;
	modulatorNode.connect( hpFilter);

	var hpFilterGain = audioContext.createGainNode();
	hpFilterGain.gain.value = 0.0;

	addSingleValueSlider( "hi-pass gain", hpFilterGain.gain.value, 0.0, 1.0, hpFilterGain, updateSingleGain );
	addSingleValueSlider( "hi-pass freq", hpFilter.frequency.value, 4000, 10000.0, hpFilter, updateSingleFrequency );
	addSingleValueSlider( "hi-pass Q", hpFilter.Q.value, 1, 50.0, hpFilter, updateSingleQ );

	hpFilter.connect( hpFilterGain );
	hpFilterGain.connect( audioContext.destination );

	//clear the arrays
	modFilterBands.length = 0;
	modFilterPostGains.length = 0;
	heterodynes.length = 0;
	powers.length = 0;
	lpFilters.length = 0;
	carrierBands.length = 0;
	carrierFilterPostGains.length = 0;
	carrierBandGains.length = 0;


//	modulatorNode.connect( analyser1 );

	for (var i=0; i<numVocoderBands; i++) {
		// CREATE THE MODULATOR CHAIN
		// create the bandpass filter in the modulator chain
		var modulatorFilter = audioContext.createBiquadFilter();
		modulatorFilter.type = modulatorFilter.BANDPASS;	// Bandpass filter
		modulatorFilter.frequency.value = vocoderBands[i].frequency;
		modulatorFilter.Q.value = FILTER_QUALITY; // 	initial quality
		modulatorNode.connect( modulatorFilter );
		modFilterBands.push( modulatorFilter );

		// create a post-filtering gain to bump the levels up.
		var modulatorFilterPostGain = audioContext.createGainNode();
		modulatorFilterPostGain.gain.value = 4;
		modulatorFilter.connect( modulatorFilterPostGain );
		modFilterPostGains.push( modulatorFilterPostGain );

		// Create the sine oscillator for the heterodyne
		var heterodyneOscillator = audioContext.createOscillator();
		heterodyneOscillator.frequency.value = vocoderBands[i].frequency;
//			osc.noteOn(0);

		// Create the node to multiply the sine by the modulator
		var heterodyne = audioContext.createGainNode();
		modulatorFilterPostGain.connect( heterodyne );
		heterodyneOscillator.connect( heterodyne.gain );

		var heterodynePostGain = audioContext.createGainNode();
		heterodynePostGain.gain.value = 2.0;		// GUESS:  boost
		heterodyne.connect( heterodynePostGain );
		heterodynes.push( heterodynePostGain );

		// Create the power node
		var power = audioContext.createGainNode();
		powers.push( power );
		heterodynePostGain.connect( power );
		heterodynePostGain.connect( power.gain );

		// Create the lowpass filter to mask off the difference (near zero)
		var lpFilter = audioContext.createBiquadFilter();
		lpFilter.type = 0;	// Lowpass filter
		lpFilter.frequency.value = 5.0;	// Guesstimate!  Mask off 20Hz and above.
		lpFilter.Q.value = 1;	// don't need a peak
		lpFilters.push( lpFilter );
		power.connect( lpFilter );

		var lpFilterPostGain = audioContext.createGainNode();
		lpFilterPostGain.gain.value = 4.0; 
		lpFilter.connect( lpFilterPostGain );

   		var waveshaper = audioContext.createWaveShaper();
		waveshaper.curve = waveShaperCurve;
		lpFilterPostGain.connect( waveshaper );

		// Create the bandpass filter in the carrier chain
		var carrierFilter = audioContext.createBiquadFilter();
		carrierFilter.type = carrierFilter.BANDPASS;
		carrierFilter.frequency.value = vocoderBands[i].frequency;
		carrierFilter.Q.value = FILTER_QUALITY;
		carrierBands.push( carrierFilter );
		carrierNode.connect( carrierFilter );

		var carrierFilterPostGain = audioContext.createGainNode();
		carrierFilterPostGain.gain.value = 6.0;
		carrierFilter.connect( carrierFilterPostGain );
		carrierFilterPostGains.push( carrierFilterPostGain );

		// Create the carrier band gain node
		var bandGain = audioContext.createGainNode();
		carrierBandGains.push( bandGain );
		carrierFilterPostGain.connect( bandGain );
		waveshaper.connect( bandGain.gain );	// connect the lp controller

		bandGain.connect( audioContext.destination );
		bandGain.connect( outputAnalyser );

		// show the output
//		bandGain.connect( analyser2 );

		// Debugging visualizer
		if ( i == DEBUG_BAND ) {
//			modulatorFilterPostGain.connect( carrierAnalyser );

			modulatorNode.connect( analyser1 );
			modulatorFilterPostGain.connect( analyser2 );
		}
	}

		addSlider( "mod filter Q", modFilterBands[0].Q.value, 1.0, 100.0, modFilterBands, updateQs );
		addSlider( "mod filter post gain", modFilterPostGains[0].gain.value, 1.0, 100.0, modFilterPostGains, updateGains );
		addSlider( "carrier filter Q", carrierBands[0].Q.value, 1.0, 100.0, carrierBands, updateQs );
		addSlider( "carrier filter post gain", carrierFilterPostGains[0].gain.value, 1.0, 100.0, carrierFilterPostGains, updateGains );
		addSlider( "heterodyne post gain", heterodynes[0].gain.value, 1.0, 8.0, heterodynes, updateGains );


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
	var GAIN_WIDTH = 1200;
	vocoderCanvas.clearRect(0, 0, GAIN_WIDTH, CANVAS_HEIGHT);
  	vocoderCanvas.fillStyle = '#F6D565';
  	vocoderCanvas.lineCap = 'round';
	var binWidth = (GAIN_WIDTH / numVocoderBands)/2;

	// Draw rectangle for each vocoder bin.
	for (var i = 0; i < numVocoderBands; i++) {
    	vocoderCanvas.fillStyle = "hsl( " + Math.round((i*360)/numVocoderBands) + ", 100%, 50%)";
    	vocoderCanvas.fillRect(i * binWidth, CANVAS_HEIGHT, binWidth, -carrierBandGains[i].gain.value * CANVAS_HEIGHT );
	}
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
		
	analyserView1.doFrequencyAnalysis( analyser1 );
	analyserView2.doFrequencyAnalysis( analyser2 );
	drawVocoderGains();
	
  	rafID = window.webkitRequestAnimationFrame( updateAnalysers );
}


//  Notes for band-pass filter approach (to be implemented):
// The general approach is to feed the modulator signal through a bank of tuned band-pass filters.
// Each band-pass filter should then be multiplied by a sine wave at the band's center frequency
// (this is accomplished by feeding the sine wave audio signal into a gain node's gain AudioParam -
// AudioNode.connect() now has a prototype that takes an AudioParam as an input.)  To obtain power,
// the output of this multiplication should then be multipled by itself (again, via GainNode.gain),
// then fed through a low-pass filter capped at 8Hz-200Hz (experimentation time!) to remove the
// double-frequency signal.[1]  This should give the effect of an envelope follower - which can then
// be fed into a gain node on a band-pass'ed instance of the carrier signal, as in other approach.
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

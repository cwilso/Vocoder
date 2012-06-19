/*
 * Copyright (c) 2012 The Chromium Authors. All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are
 * met:
 *
 *    * Redistributions of source code must retain the above copyright
 * notice, this list of conditions and the following disclaimer.
 *    * Redistributions in binary form must reproduce the above
 * copyright notice, this list of conditions and the following disclaimer
 * in the documentation and/or other materials provided with the
 * distribution.
 *    * Neither the name of Google Inc. nor the names of its
 * contributors may be used to endorse or promote products derived from
 * this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
 * "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
 * LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
 * A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
 * OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
 * SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
 * LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
 * DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
 * THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

var CANVAS_WIDTH = 582;
var CANVAS_HEIGHT = 190;

var FILTER_QUALITY = 6;  // The Q value for the carrier and modulator filters

var animationRunning = false;
var outputAnalyser = null;

// These are "placeholder" gain nodes - because the modulator and carrier will get swapped in
// as they are loaded, it's easier to connect these nodes to all the bands, and the "real"
// modulator & carrier AudioBufferSourceNodes connect to these.
var modulatorInput = null;
var carrierInput = null;

// noise node added to the carrier signal
var noiseBuffer = null;
var noiseNode = null;
var noiseGain = null;

// Wavetable oscillator stuff
var oscillatorNode = null;
var carrierSignalGain = null;
var FOURIER_SIZE = 4096;
var wavetable = null;

// These are the arrays of nodes - the "columns" across the frequency band "rows"
var modFilterBands = null;		// tuned bandpass filters
var modFilterPostGains = null;	// post-filter gains.
var heterodynes = null;		// gain nodes used to multiply bandpass X sine
var powers = null;			// gain nodes used to multiply prev out by itself
var lpFilters = null;		// tuned LP filters to remove doubled copy of product
var lpFilterPostGains = null; 	// gain nodes for tuning input to waveshapers
var bandAnalysers = null;	// these are just used to drive the visual vocoder band drawing
var carrierBands = null;	// tuned bandpass filters, same as modFilterBands but in carrier chain
var carrierFilterPostGains = null;	// post-bandpass gain adjustment
var carrierBandGains = null;	// these are the "control gains" driven by the lpFilters

var modulatorCanvas = null;
var carrierCanvas = null;
var outputCanvas = null;
var DEBUG_BAND = 5;		// current debug band - used to display a filtered signal

var vocoderBands;
var numVocoderBands;

var hpFilterGain = null;

// this function will algorithmically re-calculate vocoder bands, distributing evenly
// from startFreq to endFreq, splitting evenly (logarhythmically) into a given numBands.
// The function places this info into the global vocoderBands and numVocoderBands variables.
function generateVocoderBands( startFreq, endFreq, numBands ) {
	// Remember: 1200 cents in octave, 100 cents per semitone

	var totalRangeInCents = 1200 * Math.log( endFreq / startFreq ) / Math.LN2;
	var centsPerBand = totalRangeInCents / numBands;
	var scale = Math.pow( 2, centsPerBand / 1200 );  // This is the scaling for successive bands

	vocoderBands = new Array();
	var currentFreq = startFreq;

	for (var i=0; i<numBands; i++) {
		vocoderBands[i] = new Object();
		vocoderBands[i].frequency = currentFreq;
		currentFreq = currentFreq * scale;
	}

	numVocoderBands = numBands;
}

function loadNoiseBuffer() {	// create a 5-second buffer of noise
    var lengthInSamples =  5 * audioContext.sampleRate;
    noiseBuffer = audioContext.createBuffer(1, lengthInSamples, audioContext.sampleRate);
    var bufferData = noiseBuffer.getChannelData(0);
    
    for (var i = 0; i < lengthInSamples; ++i) {
        bufferData[i] = (2*Math.random() - 1);	// -1 to +1
    }
}

function initBandpassFilters() {
	// When this function is called, the carrierNode and modulatorAnalyser 
	// may not already be created.  Create placeholder nodes for them.
	modulatorInput = audioContext.createGainNode();
	carrierInput = audioContext.createGainNode();

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

	if (lpFilterPostGains == null)
		lpFilterPostGains = new Array();

	if (bandAnalysers == null)
		bandAnalysers = new Array();

	
	if (carrierBands == null)
		carrierBands = new Array();

	if (carrierFilterPostGains == null)
		carrierFilterPostGains = new Array();

	if (carrierBandGains == null)
		carrierBandGains = new Array();

    var waveShaperCurve = new Float32Array(65536);
    generateMirrorCurve(waveShaperCurve);	// Populate with a curve that soft-clips AND does an abs()
	
	// Set up a high-pass filter to add back in the fricatives, etc.
	// (this isn't used in the "production" version, as I hid the slider)
	var hpFilter = audioContext.createBiquadFilter();
	hpFilter.type = hpFilter.HIGHPASS;	// Bandpass filter
	hpFilter.frequency.value = 8000; // or use vocoderBands[numVocoderBands-1].frequency;
	hpFilter.Q.value = 1; // 	no peaking
	modulatorInput.connect( hpFilter);

	hpFilterGain = audioContext.createGainNode();
	hpFilterGain.gain.value = 0.0;

	hpFilter.connect( hpFilterGain );
	hpFilterGain.connect( audioContext.destination );

	//clear the arrays
	modFilterBands.length = 0;
	modFilterPostGains.length = 0;
	heterodynes.length = 0;
	powers.length = 0;
	lpFilters.length = 0;
	lpFilterPostGains.length = 0;
	carrierBands.length = 0;
	carrierFilterPostGains.length = 0;
	carrierBandGains.length = 0;
	bandAnalysers.length = 0;

	var outputGain = audioContext.createGainNode();
	outputGain.connect(audioContext.destination);

	for (var i=0; i<numVocoderBands; i++) {
		// CREATE THE MODULATOR CHAIN
		// create the bandpass filter in the modulator chain
		var modulatorFilter = audioContext.createBiquadFilter();
		modulatorFilter.type = modulatorFilter.BANDPASS;	// Bandpass filter
		modulatorFilter.frequency.value = vocoderBands[i].frequency;
		modulatorFilter.Q.value = FILTER_QUALITY; // 	initial quality
		modulatorInput.connect( modulatorFilter );
		modFilterBands.push( modulatorFilter );

		// Now, create a second bandpass filter tuned to the same frequency - 
		// this turns our second-order filter into a 4th-order filter,
		// which has a steeper rolloff/octave
		var secondModulatorFilter = audioContext.createBiquadFilter();
		secondModulatorFilter.type = secondModulatorFilter.BANDPASS;	// Bandpass filter
		secondModulatorFilter.frequency.value = vocoderBands[i].frequency;
		secondModulatorFilter.Q.value = FILTER_QUALITY; // 	initial quality
		modulatorFilter.chainedFilter = secondModulatorFilter;
		modulatorFilter.connect( secondModulatorFilter );

		// create a post-filtering gain to bump the levels up.
		var modulatorFilterPostGain = audioContext.createGainNode();
		modulatorFilterPostGain.gain.value = 6.0;
		secondModulatorFilter.connect( modulatorFilterPostGain );
		modFilterPostGains.push( modulatorFilterPostGain );

		// Create the sine oscillator for the heterodyne
		var heterodyneOscillator = audioContext.createOscillator();
		heterodyneOscillator.frequency.value = vocoderBands[i].frequency;

		//TODO: the "if" clause here can be removed in future; some older Chrome builds don't have noteOn on Oscillator
		if (heterodyneOscillator.noteOn)
			heterodyneOscillator.noteOn(0);

		// Create the node to multiply the sine by the modulator
		var heterodyne = audioContext.createGainNode();
		modulatorFilterPostGain.connect( heterodyne );
		heterodyne.gain.value = 0.0;	// audio-rate inputs are summed with initial intrinsic value
		heterodyneOscillator.connect( heterodyne.gain );

		var heterodynePostGain = audioContext.createGainNode();
		heterodynePostGain.gain.value = 2.0;		// GUESS:  boost
		heterodyne.connect( heterodynePostGain );
		heterodynes.push( heterodynePostGain );

		// Create the power node
		var power = audioContext.createGainNode();
		powers.push( power );
		heterodynePostGain.connect( power );
		power.gain.value = 0.0;	// audio-rate inputs are summed with initial intrinsic value
		heterodynePostGain.connect( power.gain );

		// Create the lowpass filter to mask off the difference (near zero)
		var lpFilter = audioContext.createBiquadFilter();
		lpFilter.type = 0;	// Lowpass filter
		lpFilter.frequency.value = 5.0;	// Guesstimate!  Mask off 20Hz and above.
		lpFilter.Q.value = 1;	// don't need a peak
		lpFilters.push( lpFilter );
		power.connect( lpFilter );
//		heterodynePostGain.connect( lpFilter );

		var lpFilterPostGain = audioContext.createGainNode();
		lpFilterPostGain.gain.value = 1.0; 
		lpFilter.connect( lpFilterPostGain );
		lpFilterPostGains.push( lpFilterPostGain );

   		var waveshaper = audioContext.createWaveShaper();
		waveshaper.curve = waveShaperCurve;
		lpFilterPostGain.connect( waveshaper );

		// create an analyser to drive the vocoder band drawing
		var analyser = audioContext.createAnalyser();
		analyser.fftSize = 128;	//small, shouldn't matter
		waveshaper.connect(analyser);
		bandAnalysers.push( analyser );

		// Create the bandpass filter in the carrier chain
		var carrierFilter = audioContext.createBiquadFilter();
		carrierFilter.type = carrierFilter.BANDPASS;
		carrierFilter.frequency.value = vocoderBands[i].frequency;
		carrierFilter.Q.value = FILTER_QUALITY;
		carrierBands.push( carrierFilter );
		carrierInput.connect( carrierFilter );

		// We want our carrier filters to be 4th-order filter too.
		var secondCarrierFilter = audioContext.createBiquadFilter();
		secondCarrierFilter.type = secondCarrierFilter.BANDPASS;	// Bandpass filter
		secondCarrierFilter.frequency.value = vocoderBands[i].frequency;
		secondCarrierFilter.Q.value = FILTER_QUALITY; // 	initial quality
		carrierFilter.chainedFilter = secondCarrierFilter;
		carrierFilter.connect( secondCarrierFilter );

		var carrierFilterPostGain = audioContext.createGainNode();
		carrierFilterPostGain.gain.value = 10.0;
		secondCarrierFilter.connect( carrierFilterPostGain );
		carrierFilterPostGains.push( carrierFilterPostGain );

		// Create the carrier band gain node
		var bandGain = audioContext.createGainNode();
		carrierBandGains.push( bandGain );
		carrierFilterPostGain.connect( bandGain );
		bandGain.gain.value = 0.0;	// audio-rate inputs are summed with initial intrinsic value
		waveshaper.connect( bandGain.gain );	// connect the lp controller

		bandGain.connect( outputGain );

		// Debugging visualizer
		if ( i == DEBUG_BAND ) {
//			modulatorFilterPostGain.connect( carrierAnalyser );

//			modulatorFilterPostGain.connect( outputAnalyser );

//			carrierFilterPostGain.connect( analyser1 );
//			analyserView1.setOverlayText( "carrierFilterPostGain" );
//			lpFilterPostGain.connect( analyser2 );
//			analyserView2.setOverlayText( "lpFilterPostGain" );
		}
	}

	addSingleValueSlider( "hi-pass gain", hpFilterGain.gain.value, 0.0, 1.0, hpFilterGain, updateSingleGain );
	addSingleValueSlider( "hi-pass freq", hpFilter.frequency.value, 4000, 10000.0, hpFilter, updateSingleFrequency );
	addSingleValueSlider( "hi-pass Q", hpFilter.Q.value, 1, 50.0, hpFilter, updateSingleQ );

	addColumnSlider( "mod filter Q", modFilterBands[0].Q.value, 1.0, 20.0, modFilterBands, updateQs );
	addColumnSlider( "mod filter post gain", modFilterPostGains[0].gain.value, 1.0, 20.0, modFilterPostGains, updateGains );
	addColumnSlider( "heterodyne post gain", heterodynes[0].gain.value, 1.0, 8.0, heterodynes, updateGains );
	addColumnSlider( "lp filter Q", lpFilters[0].Q.value, 1.0, 100.0, lpFilters, updateQs );
	addColumnSlider( "lp filter frequency", lpFilters[0].frequency.value, 1.0, 100.0, lpFilters, updateFrequencies );
	addColumnSlider( "lp filter post gain", lpFilterPostGains[0].gain.value, 1.0, 10.0, lpFilterPostGains, updateGains );

	addSingleValueSlider( "carrier input gain", carrierInput.gain.value, 0.0, 10.0, carrierInput, updateSingleGain );
	addColumnSlider( "carrier filter Q", carrierBands[0].Q.value, 1.0, 20.0, carrierBands, updateQs );
	addColumnSlider( "carrier filter post gain", carrierFilterPostGains[0].gain.value, 1.0, 20.0, carrierFilterPostGains, updateGains );
	addSingleValueSlider( "output gain", outputGain.gain.value, 0.0, 10.0, outputGain, updateSingleGain );

	modulatorInput.connect( analyser1 );
	outputGain.connect( analyser2 );

	// Now set up our wavetable stuff.
	var real = new Float32Array(FOURIER_SIZE);
	var imag = new Float32Array(FOURIER_SIZE);
	real[0] = 0.0;
	imag[0] = 0.0;
	for (var i=1; i<FOURIER_SIZE; i++) {
		real[i]=1.0;
		imag[i]=1.0;
	}

	wavetable = audioContext.createWaveTable(real, imag);
	loadNoiseBuffer();

}

/* used for the old debug visualizer I don't currently use 

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

*/

function drawVocoderGains() {
	vocoderCanvas.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  	vocoderCanvas.fillStyle = '#F6D565';
  	vocoderCanvas.lineCap = 'round';
	var binWidth = (CANVAS_WIDTH / numVocoderBands)/2;
	var value;

	var sample = new Uint8Array(1); // should only need one sample

	// Draw rectangle for each vocoder bin.
	for (var i = 0; i < numVocoderBands; i++) {
    	vocoderCanvas.fillStyle = "hsl( " + Math.round((i*360)/numVocoderBands) + ", 100%, 50%)";
    	bandAnalysers[i].getByteTimeDomainData(sample);
    	value = ((1.0 * sample[0]) - 128.0) / 128;
    	vocoderCanvas.fillRect(i * binWidth, CANVAS_HEIGHT, binWidth, -value * 2 * CANVAS_HEIGHT );
	}
}

var rafID = null;

function cancelVocoderUpdates() {
	window.webkitCancelAnimationFrame( rafID );

	//turn off the carrier loop when the modulator is done playing
	if (carrierNode)
		carrierNode.noteOff(0); 
}

function updateAnalysers(time) {
//	if ( outputAnalyser )
//		updateAnalyser( outputAnalyser, outputCanvas );
		
	analyserView1.doFrequencyAnalysis( analyser1 );
	analyserView2.doFrequencyAnalysis( analyser2 );
	drawVocoderGains();
	
  	rafID = window.webkitRequestAnimationFrame( updateAnalysers );
}


//  Notes for band-pass filter approach:
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
// Oscillator's current peak-to-peak normalization is 0.5 to -0.5; it will change to 1 to -1.

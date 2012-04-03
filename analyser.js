var animationRunning = false;
var analysers = new Array;
var CANVAS_WIDTH = 600;
var CANVAS_HEIGHT = 120;
var modulatorAnalyser = null;
var carrierAnalyser = null;
var modulatorCanvas = null;
var carrierCanvas = null;

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

function updateAnalysers(time) {
	if ( modulatorAnalyser )
		updateAnalyser( modulatorAnalyser, modulatorCanvas );
	if ( carrierAnalyser )
		updateAnalyser( carrierAnalyser, carrierCanvas );

  	window.webkitRequestAnimationFrame( updateAnalysers );
}


function updateSingleGain( event ) {
	var t = event.target;
	var value = t.value;
	t.audioNode.gain.value = value;

	//update the numeric display
	t.parentNode.childNodes[2].textContent = value;
}

function updateSingleFrequency( event ) {
	var t = event.target;
	var value = t.value;
	t.audioNode.frequency.value = value;

	//update the numeric display
	t.parentNode.childNodes[2].textContent = value;
}

function updateSingleDetune( event ) {
	var t = event.target;
	var value = t.value;
	t.audioNode.detune.value = value;

	//update the numeric display
	t.parentNode.childNodes[2].textContent = value;
}

function updateSingleQ( event ) {
	var t = event.target;
	var value = t.value;
	t.audioNode.Q.value = value;

	//update the numeric display
	t.parentNode.childNodes[2].textContent = value;
}

function updateGains( event ) {
	var t = event.target;
	var value = t.value;
	for (var i=0; i<numVocoderBands; i++)
		t.audioNodes[i].gain.value = value;

	//update the numeric display
	t.parentNode.childNodes[2].textContent = value;
}

function updateQs( event ) {
	var t = event.target;
	var value = t.value;
	for (var i=0; i<numVocoderBands; i++)
		t.audioNodes[i].Q.value = value;

	//update the numeric display
	t.parentNode.childNodes[2].textContent = value;
}

function updateFrequencies( event ) {
	var t = event.target;
	var value = t.value;
	for (var i=0; i<numVocoderBands; i++)
		t.audioNodes[i].frequency.value = value;

	//update the numeric display
	t.parentNode.childNodes[2].textContent = value;
}

function clearSliders() {
	var sliders = document.getElementById("sliders");
	var child;

	for (child=sliders.firstChild; child; child=sliders.firstChild)
		sliders.removeChild( child );
}

function addColumnSlider( label, defaultValue, minValue, maxValue, nodeArray, onChange ) {
	// insert a range control
	// <input type="range" id="rangeEl" value="0.5" oninput="alert(this.value);" min="0.0" max="1.0" step="0.01">
	var div = document.createElement("div");
	div.appendChild(document.createTextNode(label));
	var ctl = document.createElement("input");
	ctl.type = "range";
	ctl.min = minValue;
	ctl.max = maxValue;
	ctl.step = (maxValue - minValue) / 1000.0;
	ctl.value = defaultValue;
	ctl.oninput = onChange;
	ctl.audioNodes = nodeArray;
	ctl.label = label;
	div.appendChild(ctl);
	div.appendChild(document.createTextNode(defaultValue));
	document.getElementById("sliders").appendChild(div);
}

function addSingleValueSlider( label, defaultValue, minValue, maxValue, node, onChange ) {
	// insert a range control
	// <input type="range" id="rangeEl" value="0.5" oninput="alert(this.value);" min="0.0" max="1.0" step="0.01">
	var div = document.createElement("div");
	div.appendChild(document.createTextNode(label));
	var ctl = document.createElement("input");
	ctl.type = "range";
	ctl.min = minValue;
	ctl.max = maxValue;
	ctl.step = (maxValue - minValue) / 1000.0;
	ctl.value = defaultValue;
	ctl.oninput = onChange;
	ctl.audioNode = node;
	ctl.label = label;
	div.appendChild(ctl);
	div.appendChild(document.createTextNode(defaultValue));
	document.getElementById("sliders").appendChild(div);
}


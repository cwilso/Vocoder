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

var IE = false;
if(navigator.appName=='Microsoft Internet Explorer')
	var IE=true;
var Jazz;
var active_element;
var current_in;
var msg;
var sel;
//var lastNote = -1;

function midiProc(t,a,b,c) {
  var cmd = a >> 4;
  var channel = a & 0xf;

  if ( cmd==8 || ((cmd==9)&&(c==0)) ) { // with MIDI, note on with velocity zero is the same as note off
//    if (b == lastNote) {   // this keeps from shutting off if we're overlapping notes
        // we don't currently need note off
//        lastNote = -1;
//    }
  } else if (cmd == 9) {  // note on message
    if (channel == 0 ) { // Change oscillator detune.
      var noteNumber = b - 60;
      var detuneValue = noteNumber * 100;
      var detunegroup = document.getElementById("detunegroup");
      $( detunegroup.children[1] ).slider( "value", detuneValue );
      updateSlider( detunegroup, detuneValue, " cents" );
      if (oscillatorNode)
        oscillatorNode.detune.value = detuneValue;
    } else if (channel == 1) { //pads - play previews
      if (b==48)
        previewModulator(); // is a toggle.
      else if (b==49)
        previewCarrier(); // is a toggle.
      else if (b==44)
        vocode(); // is a toggle.
    }
  } else if (cmd == 11) { // continuous controller
    if (b == 1) {   // CC1: Modulator gain level
      var value = Math.floor( (100 * c) / 63.5) / 50; // 0.0-4.0
      var modgaingroup = document.getElementById("modgaingroup");
      $( modgaingroup.children[1] ).slider( "value", value );
      updateSlider( modgaingroup, value, "" );
      modulatorGainValue = value;
      if (modulatorGain)
        modulatorGain.gain.value = value;
    } else if (b == 5) {  //  CC2: Carrier sample level
      var sampleValue = Math.floor( (100 * c) / 63.5) / 100; // 0.0-2.0
      var samplegroup = document.getElementById("samplegroup");
      $( samplegroup.children[1] ).slider( "value", sampleValue );
      updateSlider( samplegroup, sampleValue, "" );
      if (carrierSampleGain)
        carrierSampleGain.gain.value = sampleValue;
    } else if (b == 6) {  //  CC2: Carrier synth level
      var synthValue = Math.floor( (100 * c) / 63.5) / 100; // 0.0-2.0
      var synthgroup = document.getElementById("synthgroup");
      $( synthgroup.children[1] ).slider( "value", synthValue );
      updateSlider( synthgroup, synthValue, "" );
      if (oscillatorGain)
        oscillatorGain.gain.value = synthValue;
    } else if (b == 7) {  //  CC3: Carrier noise level
      var noiseValue = Math.floor( (100 * c) / 63.5) / 100; // 0.0-2.0
      var noisegroup = document.getElementById("noisegroup");
      $( noisegroup.children[1] ).slider( "value", noiseValue );
      updateSlider( noisegroup, noiseValue, "" );
      if (noiseGain)
        noiseGain.gain.value = noiseValue;
    } else if (b == 8) {
      hpFilterGain.gain.value = c / 63.5; // 0.0-1.0
    }
  }
}

//// Listbox
function changeMidi(){
 try{
  if(sel.selectedIndex){
   current_in=Jazz.MidiInOpen(sel.options[sel.selectedIndex].value,midiProc);
  } else {
   Jazz.MidiInClose(); current_in='';
  }
  for(var i=0;i<sel.length;i++){
   if(sel[i].value==current_in) sel[i].selected=1;
  }
 }
 catch(err){}
}

//// Connect/disconnect
function connectMidiIn(){
 try{
  var str=Jazz.MidiInOpen(current_in,midiProc);
  for(var i=0;i<sel.length;i++){
   if(sel[i].value==str) sel[i].selected=1;
  }
 }
 catch(err){}
}
function disconnectMidiIn(){
 try{
  Jazz.MidiInClose(); sel[0].selected=1;
 }
 catch(err){}
}
function onFocusIE(){
 active_element=document.activeElement;
 connectMidiIn();
}
function onBlurIE(){
 if(active_element!=document.activeElement){ active_element=document.activeElement; return;}
 disconnectMidiIn();
}

//init: create plugin
window.addEventListener('load', function() {   
  var Jazz = document.createElement("object");
  Jazz.style.position="absolute";
  Jazz.style.visibility="hidden";
  
  if (IE) {
    Jazz.classid = "CLSID:1ACE1618-1C7D-4561-AEE1-34842AA85E90";
  } else {
    Jazz.type="audio/x-jazz";
  }

  var fallback = document.createElement("a");
  fallback.style.visibility="visible";
  fallback.style.background="white";
  fallback.style.font="20px Arial,sans-serif";
  fallback.style.padding="20px";
  fallback.style.position="relative";
  fallback.style.top="20px";
  fallback.style.zIndex="100";
  fallback.style.border="2px solid red";
  fallback.style.borderRadius="5px";
  fallback.appendChild(document.createTextNode("This page requires the Jazz MIDI Plugin."));
  fallback.href = "http://jazz-soft.net/";
  Jazz.appendChild(fallback);

  document.body.insertBefore(Jazz,document.body.firstChild);

  sel=document.getElementById("midiIn");
  try{
   current_in=Jazz.MidiInOpen(0,midiProc);
   var list=Jazz.MidiInList();
   for(var i in list){
    sel[sel.options.length]=new Option(list[i],list[i],list[i]==current_in,list[i]==current_in);
   }
  }
  catch(err){}

  if(navigator.appName=='Microsoft Internet Explorer'){ document.onfocusin=onFocusIE; document.onfocusout=onBlurIE;}
  else{ window.onfocus=connectMidiIn; window.onblur=disconnectMidiIn;}
});
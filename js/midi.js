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
  } else if (cmd == 9) {
    var noteNumber = b - 60;
    if (oscillatorNode)
        oscillatorNode.detune.value = noteNumber * 100;
//        lastNote = b;
  } else if (cmd == 11) { // continuous controller
    if (b == 1) {
      noiseGain.gain.value = c / 63.5; // 0.0-2.0
    } else if (b == 2) {
      hpFilterGain.gain.value = c / 63.5; // 0.0-1.0
    } else if (b == 3) {
      oscillatorGain.gain.value = c / 1.27; // 0.0-100
    } else if (b == 4) {
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
/*
 * Hexode page glue, edited from dx7-synth-js by Matt Montag.
 * Source: https://github.com/mmontag/dx7-synth-js
 * Commit: f269f0e02fc67b2f824b01a8416339cd5c4829e0
 * License: MIT (LICENSE.txt). package.json in that commit says ISC; the
 * license file is the grant we follow.
 *
 * Changes from that commit (see CHANGES.md):
 * - no bundled cartridge and no song files (rights not clear)
 * - .syx bank load is a file the player chooses
 * - reverb tail is a short noise burst we generate, not the bundled impulse
 * - Web MIDI input kept; the song-file player is not wired up
 */
var _ = require('lodash');
var Angular = require('angular');
var ngStorage = require('ngstorage');
var MMLEmitter = require('mml-emitter');

var FMVoice = require('./voice-dx7');
var MIDI = require('./midi');
var Synth = require('./synth');
var SysexDX7 = require('./sysex-dx7');
var Visualizer = require('./visualizer');

var config = require('./config');
var defaultPresets = require('./default-presets');

var PARAM_START_MANIPULATION = 'param-start-manipulation';
var PARAM_STOP_MANIPULATION = 'param-stop-manipulation';
var PARAM_CHANGE = 'param-change';
var DEFAULT_PARAM_TEXT = '--';

var app = Angular.module('synthApp', ['ngStorage']);
app.config(['$localStorageProvider', function($localStorageProvider) {
	$localStorageProvider.setKeyPrefix('hexode-');
}]);
var synth = new Synth(FMVoice, config.polyphony);
var midi = new MIDI(synth);
var audioContext = new (window.AudioContext || window.webkitAudioContext)();
config.sampleRate = audioContext.sampleRate;
var visualizer = new Visualizer("analysis", 256, 35, 0xc0cf35, 0x2f3409, audioContext);
var scriptProcessor = null;
var reverbGainNode = null;

// A short decaying noise tail, written here. The upstream impulse
// (impulses/church-saint-laurentius.wav) is not included: the repo does not
// say where that recording came from.
function generatedRoom(ctx) {
	var rate = ctx.sampleRate;
	var len = Math.floor(rate * 0.8);
	var impulse = ctx.createBuffer(2, len, rate);
	for (var ch = 0; ch < 2; ch++) {
		var data = impulse.getChannelData(ch);
		for (var i = 0; i < len; i++) {
			data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3) * 0.35;
		}
	}
	var conv = ctx.createConvolver();
	conv.buffer = impulse;
	return conv;
}

var hexodePeak = 0;
var hexodeReady = false;
var hexodeGain = 1;
var hexodeLimit = false;
var hexodeHoldLatch = false;

function readHexVol() {
	try {
		var raw = localStorage.getItem('hexode_volume');
		if (raw == null || raw === '') return 1;
		var v = Number(raw);
		return isFinite(v) ? Math.max(0, Math.min(1, v)) : 1;
	} catch (e) { return 1; }
}
hexodeGain = readHexVol();

function paintHexDesk() {
	var slider = document.getElementById('hexVol');
	var lab = document.getElementById('hexVolV');
	var lim = document.getElementById('hexLim');
	var hold = document.getElementById('holdBtn');
	if (slider) slider.value = String(hexodeGain);
	if (lab) lab.textContent = Math.round(hexodeGain * 100) + '%';
	if (lim) lim.checked = !!hexodeLimit;
	if (hold) {
		hold.setAttribute('aria-pressed', hexodeHoldLatch ? 'true' : 'false');
		hold.textContent = hexodeHoldLatch ? 'Hold on' : 'Hold';
	}
}
function setHexGain(v, persist) {
	v = Math.max(0, Math.min(1, Number(v)));
	if (!isFinite(v)) v = 1;
	hexodeGain = v;
	if (persist) { try { localStorage.setItem('hexode_volume', String(v)); } catch (e) {} }
	paintHexDesk();
	return v;
}

function setupAudioGraph() {
	var reverbNode = generatedRoom(audioContext);
	reverbGainNode = audioContext.createGain();
	reverbNode.connect(reverbGainNode);

	scriptProcessor = audioContext.createScriptProcessor(config.bufferSize, 0, 2);
	scriptProcessor.connect(visualizer.getAudioNode());
	scriptProcessor.connect(reverbNode);

	scriptProcessor.connect(audioContext.destination);
	reverbGainNode.connect(audioContext.destination);

	var bufferSize = scriptProcessor.bufferSize || config.bufferSize;
	var bufferSizeMs = 1000 * bufferSize / config.sampleRate;
	var msPerSample = 1000 / config.sampleRate;
	// Attach to window to avoid GC. http://sriku.org/blog/2013/01/30/taming-the-scriptprocessornode
	scriptProcessor.onaudioprocess = window.audioProcess = function (e) {
		var buffer = e.outputBuffer;
		var outputL = buffer.getChannelData(0);
		var outputR = buffer.getChannelData(1);

		var sampleTime = performance.now() - bufferSizeMs;
		var visualizerFrequency = FMVoice.frequencyFromNoteNumber(synth.getLatestNoteDown());
		visualizer.setPeriod(config.sampleRate / visualizerFrequency);

		var bufPeak = 0;
		for (var i = 0, length = buffer.length; i < length; i++) {
			sampleTime += msPerSample;
			synth.processQueuedEventsUpToSampleTime(sampleTime);
			var output = synth.render();
			var ol = output[0] * hexodeGain;
			var orr = output[1] * hexodeGain;
			if (hexodeLimit) {
				if (ol > 0.89) ol = 0.89; else if (ol < -0.89) ol = -0.89;
				if (orr > 0.89) orr = 0.89; else if (orr < -0.89) orr = -0.89;
			}
			outputL[i] = ol;
			outputR[i] = orr;
			var a = ol < 0 ? -ol : ol;
			if (a > bufPeak) bufPeak = a;
		}
		hexodePeak *= 0.82;
		if (bufPeak > hexodePeak) hexodePeak = bufPeak;
	};
}

setupAudioGraph();

// Polyphony counter
setInterval(function() {
	var count = 0;
	synth.voices.map(function(voice) { if (voice) count++; });
	if (count) console.log("Current polyphony:", count);
}, 1000);

app.directive('toNumber', function() {
	return {
		require: 'ngModel',
		link: function (scope, elem, attrs, ctrl) {
			ctrl.$parsers.push(function (value) {
				return parseFloat(value || '');
			});
		}
	};
});

app.filter('reverse', function() {
	return function(items) {
		return items ? items.slice().reverse() : items;
	};
});

app.directive('toggleButton', function() {
	return {
		restrict: 'E',
		replace: true,
		transclude: true,
		require: 'ngModel',
		scope: {'ngModel': '='},
		template: '<button type="button" class="dx7-toggle ng-class:{\'dx7-toggle-on\':ngModel}" data-toggle="button" ng-click="ngModel = 1 - ngModel" ng-transclude></button>'
	};
});

app.directive('knob', function() {
	function link(scope, element, attrs) {
		var rotationRange = 300; // ±degrees
		var pixelRange = 200; // pixels between max and min
		var startY, startModel, down = false;
		var fgEl = element.find('div');
		var max = element.attr('max');
		var min = element.attr('min');
		var increment = (max - min) < 99 ? 1 : 2;
		element.on('mousedown', function(e) {
			startY = e.clientY;
			startModel = scope.ngModel || 0;
			down = true;
			e.preventDefault();
			e.stopPropagation();
			window.addEventListener('mousemove', onMove);
			window.addEventListener('mouseup', onUp);
			element[0].querySelector('.knob').focus();
			scope.$emit(PARAM_START_MANIPULATION, scope.ngModel);
		});

		element.on('touchstart', function(e) {
			if (e.touches.length > 1) {
				// Don't interfere with any multitouch gestures
				onUp(e);
				return;
			}

			startY = e.targetTouches[0].clientY;
			startModel = scope.ngModel || 0;
			down = true;
			e.preventDefault();
			e.stopPropagation();
			window.addEventListener('touchmove', onMove);
			window.addEventListener('touchend', onUp);
			element[0].querySelector('.knob').focus();
			scope.$emit(PARAM_START_MANIPULATION, scope.ngModel);
		});

		element.on('keydown', function(e) {
			var code = e.keyCode;
			if (code >= 37 && code <= 40) {
				e.preventDefault();
				e.stopPropagation();
				if (code == 38 || code == 39) {
					scope.ngModel = Math.min(scope.ngModel + 1, max);
				} else {
					scope.ngModel = Math.max(scope.ngModel - 1, min);
				}
				apply();
			}
		});

		element.on('wheel', function(e) {
			var knob = element[0].querySelector('.knob');
			if (document.activeElement !== knob) return;
			e.preventDefault();
			var step = e.shiftKey ? 1 : increment;
			if (e.deltaY > 0) {
				scope.ngModel = Math.max(scope.ngModel - step, min);
			} else {
				scope.ngModel = Math.min(scope.ngModel + step, max);
			}
			apply();
		});

		function onMove(e) {
			if (down) {
				var clientY = e.clientY;
				if (e.targetTouches && e.targetTouches[0])
					clientY = e.targetTouches[0].clientY;
				var dy = (startY - clientY) * (max - min) / (pixelRange * (e.shiftKey ? 4 : 1));
				// TODO: use 'step' attribute
				scope.ngModel = Math.round(Math.max(min, Math.min(max, dy + startModel)));
				apply();
			}
		}

		function onUp(e) {
			down = false;
			window.removeEventListener('mousemove', onMove);
			window.removeEventListener('mouseup', onUp);
			window.removeEventListener('touchmove', onMove);
			window.removeEventListener('touchend', onUp);
			scope.$emit(PARAM_STOP_MANIPULATION, scope.ngModel);
		}

		var apply = _.throttle(function () {
			scope.$emit(PARAM_CHANGE, scope.label + ": " + scope.ngModel);
			scope.$apply();
		}, 33);

		scope.getDegrees = function() {
			return (this.ngModel - min) / (max - min) * rotationRange - (rotationRange / 2) ;
		}
	}

	return {
		restrict: 'E',
		replace: true,
		require: 'ngModel',
		scope: {ngModel: '=', label: '@'},
		template: '<div><div class="param-label">{{ label }}</div><div class="knob" tabindex="0" title="{{ label }}. Drag up or down. Hold Shift for a finer drag. Arrow keys move one step. The mouse wheel works while the knob is focused."><div class="knob-foreground" ng-style="{\'transform\': \'rotate(\' + getDegrees() + \'deg)\'}"></div></div></div>',
		link: link
	};
});

app.directive('slider', function() {
	function link(scope, element, attrs) {
		var sliderHandleHeight = 8;
		var sliderRailHeight = 50;
		var positionRange = sliderRailHeight - sliderHandleHeight;
		var pixelRange = 50;
		var startY, startModel, down = false;
		var max = element.attr('max');
		var min = element.attr('min');
		var increment = (max - min) < 99 ? 1 : 2;
		element.on('mousedown', function(e) {
			startY = e.clientY;
			startModel = scope.ngModel || 0;
			down = true;
			e.preventDefault();
			e.stopPropagation();
			window.addEventListener('mousemove', onMove);
			window.addEventListener('mouseup', onUp);
			element[0].querySelector('.slider').focus();
			scope.$emit(PARAM_START_MANIPULATION, scope.ngModel);
		});

		element.on('touchstart', function(e) {
			if (e.touches.length > 1) {
				// Don't interfere with any multitouch gestures
				onUp(e);
				return;
			}

			startY = e.targetTouches[0].clientY;
			startModel = scope.ngModel || 0;
			down = true;
			e.preventDefault();
			e.stopPropagation();
			window.addEventListener('touchmove', onMove);
			window.addEventListener('touchend', onUp);
			element[0].querySelector('.slider').focus();
			scope.$emit(PARAM_START_MANIPULATION, scope.ngModel);
		});

		element.on('keydown', function(e) {
			var code = e.keyCode;
			if (code >= 37 && code <= 40) {
				e.preventDefault();
				e.stopPropagation();
				if (code === 38 || code === 39) {
					scope.ngModel = Math.min(scope.ngModel + 1, max);
				} else {
					scope.ngModel = Math.max(scope.ngModel - 1, min);
				}
				apply();
			}
		});

		element.on('wheel', function(e) {
			var slider = element[0].querySelector('.slider');
			if (document.activeElement !== slider) return;
			e.preventDefault();
			var step = e.shiftKey ? 1 : increment;
			if (e.deltaY > 0) {
				scope.ngModel = Math.max(scope.ngModel - step, min);
			} else {
				scope.ngModel = Math.min(scope.ngModel + step, max);
			}
			apply();
		});

		function onMove(e) {
			if (down) {
				var clientY = e.clientY;
				if (e.targetTouches && e.targetTouches[0])
					clientY = e.targetTouches[0].clientY;
				var dy = (startY - clientY) * (max - min) / (pixelRange * (e.shiftKey ? 4 : 1));
				scope.ngModel = Math.round(Math.max(min, Math.min(max, dy + startModel)));
				apply();
			}
		}

		function onUp(e) {
			down = false;
			window.removeEventListener('mousemove', onMove);
			window.removeEventListener('mouseup', onUp);
			window.removeEventListener('touchmove', onMove);
			window.removeEventListener('touchend', onUp);
			scope.$emit(PARAM_STOP_MANIPULATION, scope.ngModel);
		}

		var apply = _.throttle(function() {
			scope.$emit(PARAM_CHANGE, scope.label + ": " + scope.ngModel);
			scope.$apply();
		}, 33);

		scope.getTop = function() {
			return positionRange - ((this.ngModel - min) / (max - min) * positionRange);
		}
	}

	return {
		restrict: 'E',
		replace: true,
		require: 'ngModel',
		scope: {ngModel: '=', label: '@'},
		template: '<div><div class="slider" tabindex="0" title="{{ label }}. Drag up or down. Hold Shift for a finer drag. Arrow keys move one step. The mouse wheel works while the slider is focused."><div class="slider-foreground" ng-style="{\'top\': getTop() + \'px\'}"></div></div><div class="slider-meter"></div></div>',
		link: link
	};
});

app.controller('MidiCtrl', ['$scope', function($scope) {
	// MIDI input lives in midi.js. The upstream song-file list is not shipped:
	// those .mid files are named for works whose redistribution rights are not
	// stated in the repo.
	var self = this;
	var mml = null;
	var mmlDemos = [ "t92 l8 o4 $" +
		"[>cg<cea]2.        [>cg<ceg]4" +
		"[>>a<a<c+fa+]2.    [>>a <a <c+ e a]4" +
		"[>>f <f g+ <c g]2. [>>f <f g+ <c f]4" +
		"[>>g <g g+ b <g+]2.[>>g <g <g]4;" +
		"t92 $ l1 o3 v12 r r r r2 r8 l32 v6 cdef v8 ga v10 b<c v12 de v14 fg;",
		"t120$ l8 o3    >g+2.. g+ a+4. a+ <c2 >a+    g+2.. a+4 a+4 <c4. >d+" +
			"              a+ g+2. g+ a+4. a+ <c2 >a+   g+2.. a+4 a+4 <c2.;" +
			"t120$l8 o4    rr g g4 g+ a+4 d4 d4 d+2     d c g g4 g+ a+4 d4 d4 d+2" +
			"              rr g g4 g+ a+4 d4 d4 d+2     d c g g4 g+ a+4 d4 d4 d+2.;" +
			"t120$l8 o4 v9 rr d+ d+2 r >a+4 a+4 <c2     >a+ g+ <d+ d+2 r >a+4 a+4 a+2" +
			"              rr d+ d+2 r >a+4 a+4 <c2     >a+ g+ <d+ d+2 r >a+4 a+4 a+2.;" +
			"t120$l8 o4 v8 rr c c2 r   >f4 f4 g2        a+ g+ <c c2 >f f4 r f g2<" +
			"              rr c c2 r   >f4 f4 g2        a+ g+ <c c2 >f f4 r f g2.<;"
	];
	var qwertyNotes = [];
	//Lower row: zsxdcvgbhnjm...
	qwertyNotes[16] = 41; // = F2
	qwertyNotes[65] = 42;
	qwertyNotes[90] = 43;
	qwertyNotes[83] = 44;
	qwertyNotes[88] = 45;
	qwertyNotes[68] = 46;
	qwertyNotes[67] = 47;
	qwertyNotes[86] = 48; // = C3
	qwertyNotes[71] = 49;
	qwertyNotes[66] = 50;
	qwertyNotes[72] = 51;
	qwertyNotes[78] = 52;
	qwertyNotes[77] = 53; // = F3
	qwertyNotes[75] = 54;
	qwertyNotes[188] = 55;
	qwertyNotes[76] = 56;
	qwertyNotes[190] = 57;
	qwertyNotes[186] = 58;
	qwertyNotes[191] = 59;

	// Upper row: q2w3er5t6y7u...
	qwertyNotes[81] = 60; // = C4 ("middle C")
	qwertyNotes[50] = 61;
	qwertyNotes[87] = 62;
	qwertyNotes[51] = 63;
	qwertyNotes[69] = 64;
	qwertyNotes[82] = 65; // = F4
	qwertyNotes[53] = 66;
	qwertyNotes[84] = 67;
	qwertyNotes[54] = 68;
	qwertyNotes[89] = 69;
	qwertyNotes[55] = 70;
	qwertyNotes[85] = 71;
	qwertyNotes[73] = 72; // = C5
	qwertyNotes[57] = 73;
	qwertyNotes[79] = 74;
	qwertyNotes[48] = 75;
	qwertyNotes[80] = 76;
	qwertyNotes[219] = 77; // = F5
	qwertyNotes[187] = 78;
	qwertyNotes[221] = 79;
	qwertyNotes[220] = 80;

	this.createMML = function (idx) {
		var mml = new MMLEmitter(audioContext, mmlDemos[idx]);
		var noteHandler = function(e) {
			synth.noteOn(e.midi, e.volume / 20);
			e.noteOff(function() {
				synth.noteOff(e.midi);
			});
		};
		mml.tracks.map(function(track) { track.on('note', noteHandler); });
		return mml;
	};

	this.onDemoClick = function(idx) {
		if (mml && mml._ended === 0) {
			mml.stop();
			synth.panic();
			mml = null;
		} else {
			mml = this.createMML(idx);
			mml.start();
		}
	};

	this.onVizClick = function() {
		visualizer.cycleMode();
	};

	var heldCodes = new Set();
	function releaseKeys() {
		heldCodes.clear();
		hexodeHoldLatch = false;
		paintHexDesk();
		if (mml) { mml.stop(); mml = null; }
		synth.panic();
	}
	this.panic = releaseKeys;

	this.onKeyDown = function(ev) {
		var note = qwertyNotes[ev.keyCode];
		if (ev.metaKey) return false;
		if (ev.keyCode === 32) {
			releaseKeys();
			ev.stopPropagation();
			ev.preventDefault();
			return false;
		}
		if (ev.keyCode === 192) {
			var typing = ev.target && (ev.target.tagName === 'INPUT' || ev.target.tagName === 'SELECT' || ev.target.tagName === 'TEXTAREA');
			if (!typing && !ev.repeat) synth.sustainPedal(true);
			if (!typing) { ev.stopPropagation(); ev.preventDefault(); }
			return false;
		}
		if (note) {
			if (!ev.repeat && !heldCodes.has(ev.keyCode)) {
				heldCodes.add(ev.keyCode);
				synth.noteOn(note, 0.8 + (ev.ctrlKey ? 0.47 : 0));
			}
			ev.stopPropagation();
			ev.preventDefault();
		}
		return false;
	};

	this.onKeyUp = function(ev) {
		if (ev.keyCode === 192) {
			synth.sustainPedal(hexodeHoldLatch);
			return false;
		}
		var note = qwertyNotes[ev.keyCode];
		if (note && heldCodes.has(ev.keyCode)) {
			heldCodes.delete(ev.keyCode);
			synth.noteOff(note);
		}
		return false;
	};

	window.addEventListener('keydown', this.onKeyDown, false);
	window.addEventListener('keyup', this.onKeyUp, false);
	window.addEventListener('blur', releaseKeys, false);
	document.addEventListener('visibilitychange', function() {
		if (document.visibilityState === 'hidden') releaseKeys();
	});
}]);

app.controller('OperatorCtrl', function($scope) {
	$scope.$watchGroup(['operator.oscMode', 'operator.freqCoarse', 'operator.freqFine', 'operator.detune'], function() {
		FMVoice.updateFrequency($scope.operator.idx);
		$scope.freqDisplay = $scope.operator.oscMode === 0 ?
			parseFloat($scope.operator.freqRatio).toFixed(2).toString() :
			$scope.operator.freqFixed.toString().substr(0,4).replace(/\.$/,'');
	});
	$scope.$watch('operator.volume', function() {
		FMVoice.setOutputLevel($scope.operator.idx, $scope.operator.volume);
	});
	$scope.$watch('operator.pan', function() {
		FMVoice.setPan($scope.operator.idx, $scope.operator.pan);
	});
});

app.controller('PresetCtrl', ['$scope', '$localStorage', function ($scope, $localStorage) {
	var self = this;

	this.lfoWaveformOptions = [ 'Triangle', 'Saw Down', 'Saw Up', 'Square', 'Sine', 'Sample & Hold' ];
	this.presets = defaultPresets;
	this.selectedIndex = 0;
	this.paramDisplayText = DEFAULT_PARAM_TEXT;

	var paramManipulating = false;
	var paramDisplayTimer = null;

	function flashParam(value) {
		self.paramDisplayText = value;
		$scope.$apply();
		clearTimeout(paramDisplayTimer);
		if (!paramManipulating) {
			paramDisplayTimer = setTimeout(function() {
				self.paramDisplayText = DEFAULT_PARAM_TEXT;
				$scope.$apply();
			}, 1500);
		}
	}

	$scope.$on(PARAM_START_MANIPULATION, function(e, value) {
		paramManipulating = true;
		flashParam(value);
	});

	$scope.$on(PARAM_STOP_MANIPULATION, function(e, value) {
		paramManipulating = false;
		flashParam(value);
	});

	$scope.$on(PARAM_CHANGE, function(e, value) {
		flashParam(value);
	});

	// Upstream fetched roms/ROM1A.SYX and selected voice 11. That file is a
	// 32-voice bulk dump (F0 43 00 09 20 00) whose names are the familiar
	// factory set. It is not in this tree. The page starts on the single
	// "Init" voice that ships in default-presets.js, and a player can load
	// their own 32-voice .syx.
	this.basePresets = Angular.copy(defaultPresets);
	this.$storage = $localStorage;
	this.presets = [];
	for (var i = 0; i < this.basePresets.length; i++) {
		if (this.$storage[i]) this.presets[i] = Angular.copy(this.$storage[i]);
		else this.presets[i] = Angular.copy(this.basePresets[i]);
	}
	this.selectedIndex = 0;

	function binaryString(bytes) {
		var s = '';
		for (var n = 0; n < bytes.length; n++) s += String.fromCharCode(bytes[n]);
		return s;
	}

	this.loadSysexBuffer = function(buffer) {
		var bytes = new Uint8Array(buffer);
		if (bytes.length < 6 + 128 * 32) {
			self.paramDisplayText = "NEED 32-VOICE BANK";
			return null;
		}
		var bank = SysexDX7.loadBank(binaryString(bytes));
		for (var k = 0; k < 32; k++) delete self.$storage[k];
		self.basePresets = bank;
		self.presets = bank.map(function(p) { return Angular.copy(p); });
		self.selectedIndex = 0;
		self.onChange();
		self.paramDisplayText = (self.presets[0].name || "").trim() || "BANK";
		return self.presets[0].name;
	};

	var syxInput = document.getElementById('syxIn');
	if (syxInput) {
		syxInput.addEventListener('change', function(ev) {
			var file = ev.target.files && ev.target.files[0];
			if (!file) return;
			var reader = new FileReader();
			reader.onload = function() {
				$scope.$apply(function() { self.loadSysexBuffer(reader.result); });
			};
			reader.readAsArrayBuffer(file);
		});
	}

	this.onChange = function() {
		this.params = this.presets[this.selectedIndex];
		FMVoice.setParams(this.params);
		// TODO: separate UI parameters from internal synth parameters
		// TODO: better initialization of computed parameters
		for (var i = 0; i < this.params.operators.length; i++) {
			var op = this.params.operators[i];
			FMVoice.setOutputLevel(i, op.volume);
			FMVoice.updateFrequency(i);
			FMVoice.setPan(i, op.pan);
		}
		FMVoice.setFeedback(this.params.feedback);
	};

	this.save = function() {
		this.$storage[this.selectedIndex] = Angular.copy(this.presets[this.selectedIndex]);
		console.log("Saved preset %s.", this.presets[this.selectedIndex].name);
	};

	this.reset = function() {
		if (confirm('Are you sure you want to reset this patch?')) {
			delete this.$storage[this.selectedIndex];
			console.log("Reset preset %s.", this.presets[this.selectedIndex].name);
			this.presets[this.selectedIndex] = Angular.copy(self.basePresets[this.selectedIndex]);
			this.onChange();
		}
	};

	$scope.$watch('presetCtrl.params.feedback', function(newValue) {
		if (newValue !== undefined) {
			FMVoice.setFeedback(self.params.feedback);
		}
	});

	$scope.$watchGroup([
		'presetCtrl.params.lfoSpeed',
		'presetCtrl.params.lfoDelay',
		'presetCtrl.params.lfoAmpModDepth',
		'presetCtrl.params.lfoPitchModDepth',
		'presetCtrl.params.lfoPitchModSens',
		'presetCtrl.params.lfoWaveform'
	], function() {
		FMVoice.updateLFO();
	});

	$scope.presetCtrl.reverb = 33;
	$scope.$watch('presetCtrl.reverb', (value) => {
		reverbGainNode.gain.value = 4 * value / 100;
	});

	self.onChange();

	// Audio context unlock that should work in both iOS and Chrome
	function unlockAudioContext(context) {
		if (context.state === 'suspended') {
			var events = ['touchstart', 'touchend', 'mousedown', 'keydown'];
			var unlock = function unlock() {
				events.forEach(function (event) {
					document.body.removeEventListener(event, unlock)
				});

				console.log("Resuming audio context...");
				context.resume();
				flashParam("HEXODE");

			};

			events.forEach(function (event) {
				document.body.addEventListener(event, unlock, false)
			});
		}
	}

	unlockAudioContext(audioContext);
	hexodeReady = true;
	window.__hexodeLoadSysex = function(buffer) { return self.loadSysexBuffer(buffer); };

}]);

window.__hexode = {
	ready: function() { return hexodeReady; },
	noteOn: function(n, v) { synth.noteOn(n, v == null ? 0.8 : v); },
	noteOff: function(n) { synth.noteOff(n); },
	panic: function() { synth.panic(); },
	held: function() {
		return synth.voices.filter(function(v) { return v && v.down === true; }).map(function(v) { return v.note; });
	},
	midi: function(data) {
		var bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
		synth.processMidiEvent({ data: bytes });
	},
	resume: function() { return audioContext.resume(); },
	peak: function() { return hexodePeak; },
	gain: function() { return hexodeGain; },
	setGain: function(v) { return setHexGain(v, true); },
	limit: function() { return hexodeLimit; },
	hold: function() { return hexodeHoldLatch; },
	loadSysex: function(list) {
		var bytes = list instanceof Uint8Array ? list : new Uint8Array(list);
		var buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
		var el = document.querySelector('[ng-controller="PresetCtrl as presetCtrl"]');
		var scope = Angular.element(el).scope();
		var name = null;
		scope.$apply(function() { name = window.__hexodeLoadSysex(buf); });
		return name;
	}
};

paintHexDesk();
var hexVol = document.getElementById('hexVol');
if (hexVol) hexVol.addEventListener('input', function() { setHexGain(hexVol.value, true); });
var hexLim = document.getElementById('hexLim');
if (hexLim) hexLim.addEventListener('change', function() { hexodeLimit = !!hexLim.checked; });
var holdBtn = document.getElementById('holdBtn');
if (holdBtn) holdBtn.addEventListener('click', function() {
	hexodeHoldLatch = !hexodeHoldLatch;
	synth.sustainPedal(hexodeHoldLatch);
	paintHexDesk();
});

/*
**    Copyright (C) 2003-2015 Institute for Systems Biology 
**                            Seattle, Washington, USA. 
**
**    This library is free software; you can redistribute it and/or
**    modify it under the terms of the GNU Lesser General Public
**    License as published by the Free Software Foundation; either
**    version 2.1 of the License, or (at your option) any later version.
**
**    This library is distributed in the hope that it will be useful,
**    but WITHOUT ANY WARRANTY; without even the implied warranty of
**    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
**    Lesser General Public License for more details.
**
**    You should have received a copy of the GNU Lesser General Public
**    License along with this library; if not, write to the Free Software
**    Foundation, Inc., 59 Temple Place, Suite 330, Boston, MA  02111-1307  USA
*/

	
define([
    "dojo/_base/declare",
    "dojo/Deferred",
    "dojo/debounce",
    "dojo/on",
    "dijit/form/HorizontalSlider",
    "dijit/form/HorizontalRule",
    "dijit/form/HorizontalRuleLabels",
    "dojo/dom-construct",
    "dojo/_base/array",
    "dojo/Stateful",
    "app/utils",
    "dojo/domReady!"
],function(
	declare,
	Deferred,
	debounce,
	on,
	HSlider,
	HRuler,
	HRulerLabels,
	domConstruct,
	DojoArray,
	Stateful,
	utils
) {	
	
	var MAX_LABELS = 11;
	
	/////////////////////////////////
	// TimeSlider
	////////////////////////////////
	//
	// Wrapper object which produces a HorizontalTimeSlider, upper HorizontalRuler, and Lower Horizontal Label using a supplied DOM Node ID.
	// The resulting DOM node can then be attached to the DOM.
	//
	return declare([Stateful],{
		
		_id: null,
		
		_asyncLoader: null,
		
		disabled: null,
		
		// DOM node which will house the slider and its rulers
		domNode: null,
		
		// DOM node which the slider will convert into a table
		_sliderDomNode: null,

		_destroyables: null,
		
		// Slider widget object
		_slider: null,
		// Slider ruler widget object
		_sliderRuler: null,
		// Slider values widget object
		_sliderValues: null,
		// Slider label widget object
		_sliderLabel: null,
		
		_started: null,
				
		// Number of slider stop points if there are specific values
		_count: null,
		// If this slider sends results for all values during a drag, or just the stop value
		_intermediateChanges: null,
		// Is the slider a continuous series of values, or a individual values
		_discreteValues: null,
		
		// In the case of numeric sliders, start point/minimum value
		_min: null,
		// In the case of numeric sliders, stop point/maximum value
		_max: null,
		// Value to start the slider on
		_startValue: null,
		// Model ID this slider is associated with (necessary for onChange events)
		_model: null,
		
		_onChangeAction: null,
		
		value: null,
		
		_disabledGetter: function() {
			return this.disabled;
		},
		
		_disabledSetter: function(val) {
			this.disabled = val;
			this._slider.set("disabled",val);
		},
		
		getValue: function() {
			return (this._slider ? this._slider.get("value") : null);
		},

		_valueGetter: function() {
			return this.getValue();
		},
		
		_valueSetter: function(val,withOnChange) {
			this.setValue(val,!withOnChange);
		},
		
		// A wrapper around the slider widget's value setting method which checks for
		// the completion of the widget's initial load before passing the value in.
		setValue: function(val,withoutOnChange) {
			var self=this;
			if(self._asyncLoader) {
				self._asyncLoader.promise.then(function(){
					self._slider && self._slider.set("value",val,!withoutOnChange);
				});
			}			
		},
		
		remove: function() {
			var self=this;
			DojoArray.forEach(this._destroyables,function(destMe){
				self[destMe] && self[destMe].destroyRecursive();
				self[destMe] = null;
			});
			this._asyncLoader = null;
		},
		
		/////////////////////////
		// _makeSliderRulers
		/////////////////////////
		//
		//
		_makeSliderRulers: function(params) {
			
			var timeSliderDef = params.timeSliderDef;
			
			// Label Pattern example: {places: 0,pattern: "#h"}
			var namedStages,labelPattern = "#",labelText,labels = params.labels;		
			
			if(timeSliderDef) {
				labelText = timeSliderDef.units;
				if(timeSliderDef.namedStages) {
					namedStages = {};
					DojoArray.forEach(timeSliderDef.namedStages,function(stage){
						namedStages[stage.order] = stage.abbrev;
					});
				}
			}
			
			this._sliderRuler = new HRuler({
		    	container: (params.rulerDecor || "topDecoration"),
		    	count: this._count,
		    	ruleStyle: "height: 5px;"
			},(domConstruct.create("div",{},this._sliderDomNode,"first")));
			
			this._destroyables.push("_sliderRuler");
	
			var interval = 1;
			
			// If an explicit label set was not provided, construct one
			if(!labels) {
				labels = new Array();

				if(this._count > MAX_LABELS) {
					if((this._count/3) > MAX_LABELS) {
						interval = (this._count%MAX_LABELS === 0 ? this._count/MAX_LABELS : Math.round(this._count/MAX_LABELS));
					} else {
						interval = 3;
					}
				}
				
				// HRulerLabels are always distributed evenly due to how the DOM works, 
				// so we put in blanks for anything we're skipping so they will line up with
				// their hashmarks
				//
				// Because we are providing a preformatted label set, the constraints object
				// will be ignored; this means we have to format these ourself
				for(var i = this._min; i <= this._max; i++) {
					if(((i-this._min)%interval) === 0) {
						if(namedStages) {
							labels.push(namedStages[i]);
						} else {
							labels.push(labelPattern.replace("#",i));
						}
					} else {
						labels.push("");
					}
				}
			}
						
		    this._sliderValues = new HRulerLabels({
		    	container: (params.rulerDecor || "topDecoration"),
		    	labels: labels,
		    	style: "height: 10px; font-size: 0.6em;"
		    	// You can also supply a constraints object, eg. {places: 0, pattern: "#h"} 
		    	// if you did not supply a preformatted label set
		    	// To do this you must then supply min, max, interval, etc.
		    },domConstruct.create("div",{},this._sliderDomNode,(params.rulerDecor === "bottomDecoration" ? "last" : "first")));  
		    
		    this._destroyables.push("_sliderValues");
		    
		    if(labelText) {
		    	this._sliderLabel = new HRulerLabels({
			    	container: "bottomDecoration",
			    	style: "height: 10px; font-size: 0.6em;",
			    	labels: [labelText]
			    },domConstruct.create("div",{},this._sliderDomNode,"last"));
			    
			    this._destroyables.push("_sliderLabel");	
		    }
			
		},
		
		///////////////////////
		// start
		//////////////////////
		//
		//
		start: function(withDebounce) {
			var self=this;
		    this._slider = new HSlider({
		    	id: self._id,
		        name: "slider_widget_" + utils.makeId(),
			    minimum: self._min,
		        maximum: self._max,
		        value: self._startValue,
		        discreteValues: self._discreteValues,
		        intermediateChanges: (self._intermediateChanges || false),
		        onChange: self._onChangeAction
	    
		    },this._sliderDomNode);
		    this._slider.startup();
		    this._sliderValues.startup();
		    this._sliderRuler.startup();
		    this._sliderLabel && this._sliderLabel.startup();
		    
		    this._destroyables.push("_slider");
		    this._asyncLoader.resolve();
		    
		    if(withDebounce) {
		    	// Add a debounce call which is delayed out past the main throttled event, such that it will will ensure
			    // the onchange throttler doesn't prevent final values from being managed
			    this._slider.own(on(this._slider,"change",debounce(self._onChangeAction,75)));	
		    }
		    		    
		    this._started = true;
			
		    this.disabled = false;
		},
		
		
		//////////////////////
		// constructor
		/////////////////////
		//
		//
		constructor: function(params) {
			
			this._onChangeAction = (params.onChangeAction  || function(val) { console.debug("["+this._id+"] new val:" + val); });
			
			this._intermediateChanges = params.intermediateChanges;
			this._discreteValues = (params.discreteValues ? params.count : null);
			this._min = params.min;
			this._max = params.max;
			this._count = params.count;
			this._startValue = params.value;
			this._id = "slider_" + (params.id || utils.makeId()) + "_" + params.modelId;
			this._model = params.modelId;
			this._started = false;
			this._destroyables = [];
			
			this.domNode = domConstruct.create("div",{id: "sliderwrapper_" + (params.sliderNodeId || utils.makeId()),style: "height: 35px;"},params.containerDomNode,"first");
			this._sliderDomNode = domConstruct.create("div",{id: "slidernode_"+(params.sliderNodeId || utils.makeId()),style: "height: 35px;"},this.domNode,"first");
			
			this._asyncLoader = new Deferred();
			
			this._makeSliderRulers(params);
		}
	});
	
});
/*
**    Copyright (C) 2003-2014 Institute for Systems Biology 
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
    "dojo/Deferred",
    "dijit/form/HorizontalSlider",
    "dijit/form/HorizontalRule",
    "dijit/form/HorizontalRuleLabels",
    "dijit/layout/ContentPane",
    "dojo/dom-construct",
    "dojo/dom-style",
    "dojo/dom",
    "dojo/_base/array",
    "app/utils",
    "dojo/domReady!"
],function(
	Deferred,
	HSlider,
	HRuler,
	HRulerLabels,
	ContentPane,
	domConstruct,
	domStyle,
	dom,
	DojoArray,
	utils
) {
	
	var model_ = null;
	
	var ONCHANGE_ACTION = "CLIENT_SET_MODEL";
	
	// Label Pattern example: {places: 0,pattern: "#h"}
	var labeltext = "NOT_DEFINED";
	var labelpattern = "#"; 
	var namedStages = null;
	
	var asyncLoader = null;
	
	var disablingOverlay_ = null;
	
	var slider,sliderNodeId,sliderRuler,sliderLabel,sliderValues,sliderPane;
	var min,max,count,value,onchangeEvent;
		
	var PREFERRED_HEIGHT = 65;
	var MAX_LABELS = 10;
	var DEFAULT_REGION = "top";
	
	var enabled_ = false;
	
	var loaded_ = false;
	
	function _remove() {
		slider && slider.destroyRecursive();
		sliderRuler && sliderRuler.destroyRecursive();
		sliderValues && sliderValues.destroyRecursive();
		sliderLabel && sliderLabel.destroyRecursive();		
		
		disablingOverlay_.parentNode = null,slider = null,sliderRuler = null,sliderValues = null,sliderLabel = null;
						
		sliderPane && sliderPane.destroyRecursive();
		
		domStyle.set(disablingOverlay_,"display","none");
		
		sliderPane = null;
		
		loaded_ = false;
		enabled_ = false;
		asyncLoader = null;		
		model_ = null;
	}
	
	function _disable() {
		
		slider && slider.destroyRecursive();
		sliderRuler && sliderRuler.destroyRecursive();
		sliderValues && sliderValues.destroyRecursive();
		sliderLabel && sliderLabel.destroyRecursive();
		
		disablingOverlay_.parentNode = null,slider = null,sliderRuler = null,sliderValues = null,sliderLabel = null;
		
		sliderPane && sliderPane.destroyDescendants();
		
		domConstruct.place(disablingOverlay_,sliderPane.domNode,"first");
		
		enabled_ = false;
		asyncLoader = null;	
		model_ = null;
	}
	
	return {
		load: function(params) {
			
			asyncLoader = new Deferred();			
			
			var region = params && params.region ? params.region : DEFAULT_REGION;
			
			var timeSliderDef = params.timeSliderDef;
			
			if(timeSliderDef) {
				labeltext = timeSliderDef.units;
				if(timeSliderDef.namedStages) {
					namedStages = {};
					DojoArray.forEach(timeSliderDef.namedStages,function(stage){
						namedStages[stage.order] = stage.abbrev;
					});
				}
			}
			
			if(!sliderPane) {
				sliderPane = new ContentPane({
					id: "slider_pane",
					region: region
				});
			}

			if(!disablingOverlay_) {
				disablingOverlay_ = domConstruct.create("div",{ id: "slider_pane_disabling","class": "DisablingOverlay" },sliderPane.domNode,"first");
			} else {
				domStyle.set(disablingOverlay_,"display","none");
			}			
			
			if(params) {
				min = params.statemin;
				max = params.statemax;
				count = params.statelength;
				value = params.currstate;
				model_ = params.model;

				sliderNodeId = "slider_" + utils.makeId();
							
				var sliderNode;
				if(!sliderNode) {
					sliderNode = domConstruct.create("div",{id: sliderNodeId},sliderPane.domNode,"first");
				}
							
				var rulerNode = domConstruct.create("div",{},sliderNode,"first");
				sliderRuler = new HRuler({
			    	container: "topDecoration",
			    	count: count,
			    	ruleStyle: "height: 5px;"
				},rulerNode);
		
				var interval = 1;
				var labels = new Array();

				if(count > MAX_LABELS) {
					if((count/3) > MAX_LABELS) {
						labelCount = MAX_LABELS;
						interval = (count%MAX_LABELS === 0 ? count/MAX_LABELS : Math.floor(count/MAX_LABELS));
					} else {
						labelCount = (count%3 === 0 ? count/3 : Math.floor(count/3));
						interval = 3;
					}
				}
				
				// HRulerLabels are always distributed evenly due to how the DOM works, 
				// so we put in blanks for anything we're skipping so they will line up with
				// their hashmarks
				//
				// Because we are providing a preformatted label set, the constraints object
				// will be ignored; this means we have to format these ourself
				for(var i = min; i <= max; i++) {
					if(((i-min)%interval) === 0) {
						if(namedStages) {
							labels.push(namedStages[i]);
						} else {
							labels.push(labelpattern.replace("#",i));
						}
					} else {
						labels.push("");
					}
				}
				
			    var rulerValuesNode = domConstruct.create("div",{},sliderNode,"first");
			    sliderValues = new HRulerLabels({
			    	container: "topDecoration",
			    	labels: labels,
			    	style: "height: 10px; font-size: 0.6em;"
			    	// You can also supply a constraints object, eg. {places: 0, pattern: "#h"} 
			    	// if you did not supply a preformatted label set
			    	// To do this you must then supply min, max, interval, etc.
			    },rulerValuesNode);  
			    
			    var rulerLabelNode = domConstruct.create("div",{},sliderNode,"last");
			    sliderLabel = new HRulerLabels({
			    	container: "bottomDecoration",
			    	style: "height: 10px; font-size: 0.6em;",
			    	labels: [labeltext]
			    },rulerLabelNode);
			}
		    
		    loaded_ = true;
		    
			return sliderPane;

		},
		
		remove: function() {
			_remove();
		},
		
		start: function() {
			if(!enabled_) {
			    slider = new HSlider({
			        name: "slider_widget_" + utils.makeId(),
			        prevOnChange_: null,
				    minimum: min,
			        maximum: max,
			        value: value,
			        discreteValues: count,
			        intermediateChanges: false,
			        onChange: function(val) {
			        	// Don't allow a flurry of onChange events to execute all at once;
			        	// force them to defer against one another in a chain
			        	var self=this;
			        	var myDeferred;
			        	if(!this.prevOnChange_) {
			        		this.prevOnChange_ = new Deferred();
			        		var theirDeferred = this.prevOnChange_;
				        	require(["controllers/ActionCollection"],function(ActionCollection){
				        		ActionCollection[ONCHANGE_ACTION]({modelId: model_, state: val, isSliderChange: true}).then(function(){
				        			theirDeferred.resolve();
				        		},function(err){
				        			theirDeferred.reject(err);
				        		});
				        	});
			        	} else {
			        		myDeferred = this.prevOnChange_;
			        		var theirDeferred = new Deferred();
			        		this.prevOnChange_ = theirDeferred;
			        		myDeferred.promise.then(function(){
					        	require(["controllers/ActionCollection"],function(ActionCollection){
					        		ActionCollection[ONCHANGE_ACTION]({modelId: model_, state: val, isSliderChange: true}).then(function(){
					        			theirDeferred.resolve();
					        		},function(err){
					        			theirDeferred.reject(err);
					        		});
					        	});
			        		});
			        	}
			        }
			    },sliderNodeId);			
			    slider && slider.startup();
			    sliderValues && sliderValues.startup();
			    sliderRuler && sliderRuler.startup();
			    sliderLabel && sliderLabel.startup();
			}
		    
		    domStyle.set(disablingOverlay_,"display","none");
		    enabled_ = true;	
		    asyncLoader.resolve();
		},
		
		resize: function(newSize) {
			if(!newSize) {
				newSize = {h: PREFERRED_HEIGHT};
			}
			sliderPane && sliderPane.resize(newSize);
		},	
		
		disable: function() {
			_disable();
			domStyle.set(disablingOverlay_,"display","block");
			enabled_ = false;
		},
		
		isEnabled: function() {
			return enabled_;
		},
		
		prefHeight: function() {
			return PREFERRED_HEIGHT;
		},
		
		isLoaded: function() {
			return loaded_;
		},
		
		getValue: function() {
			if(!loaded_) {
				return null;
			}
			return slider.get("value");
		},
				
		setValue: function(args) {
			if(asyncLoader) {
				asyncLoader.promise.then(function(){
					slider && slider.set("value",args.value,!args.withoutOnChange);
				});
			}
		}
	};	
});
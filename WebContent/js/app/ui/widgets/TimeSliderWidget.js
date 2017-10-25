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
    "./BTHSlider",
    "dijit/layout/ContentPane",
    "dojo/dom-construct",
    "dojo/_base/array",
    "app/utils",
    "dojo/domReady!"
],function(
	declare,
	Deferred,
	BioTapHSlider,
	ContentPane,
	domConstruct,
	DojoArray,
	utils
) {
	
	var ONCHANGE_ACTION = "CLIENT_SET_MODEL";
	var PREFERRED_HEIGHT = 65;
	var DEFAULT_REGION = "top";
	var MAX_SLIDERS = 5;
	
		
	/////////////////////////////////////////////
	// TimeSliderWidget
	/////////////////////////////////////////////
	//
	// An extended dijit.layout.ContentPane which houses a series of BTHSlider widgets and swaps them out based on a stored value.
	//
	return declare([ContentPane],{
		
		_asyncBuilder: null,
		
		// Collection of slider widgets; we keep up to MAX_SLIDERS
		_sliders: null,
		
		// The current model ID, also keys the current slider
		modelId: null,
		
		// The event that occurs when the value changes
		_onChangeAction: null,
		
		// The overlay which covers this content pane in the case of disabling
		_disablingOverlay: null,
		
		// Definition for the time slider as provided by the server;
		// contains definitions of labels and values
		_timeSliderDef: null,
		
		//////////////////////////
		// _setModelIdAttr
		/////////////////////
		//
		// Any time the model changes, we check to see if we need to make a new slider, and if so, do that.
		// We then enable the relevant slider, if there is one
		//
		_setModelIdAttr: function(val,params) {
			if(!val) {
				this.set("disabled",true);
				return;
			}
			
			if(!this._sliders[val]) {
				if(!params) {
					console.error("[ERROR] Requested a time slider for "+val+" but that slider does not exist and no definition was supplied!");
					return;
				}
				var sliders = Object.keys(this._sliders);
				if(sliders.length > MAX_SLIDERS) {
					this._sliders[sliders[0]].remove();
					(this.modelId === sliders[0]) && this.destroyDescendants();
					delete this._sliders[sliders[0]];
				}
				params.modelId = val;
				params.id = utils.makeId();
				params.discreteValues = true;
				params.timeSliderDef = this._timeSliderDef;

				this._makeSlider(params);
			}
			
			if(this.domNode.firstChild) {
				domConstruct.place(this._sliders[val].domNode,this.domNode.firstChild,"replace");
			} else {
				domConstruct.place(this._sliders[val].domNode,this.domNode,"first");
			}
			
			!this._sliders[val]._started && this._sliders[val].start();

			this.modelId = val;
			
			if(params && (params.value !== this._sliders[val].get("value"))) {
				this._sliders[val].set("value",params.value,!!params.withOnChange);
			}
			
			this.set("disabled",false);
		},
		
		////////////////////
		// _makeOnChange
		////////////////////
		//
		//
		_makeOnChange: function(actionName) {
			var onChangeAction = actionName || this._onChangeAction;
	    	var self=this;
			return function(val) {
		    	// Don't allow a flurry of onChange events to execute all at once;
		    	// force them to defer against one another in a chain
		    	var myDeferred;
		    	if(!this.prevOnChange_) {
		    		this.prevOnChange_ = new Deferred();
		    		var theirDeferred = this.prevOnChange_;
		        	require(["controllers/ActionCollection"],function(ActionCollection){
		        		ActionCollection[onChangeAction]({modelId: self.modelId, state: val, isSliderChange: true}).then(function(){
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
			        		ActionCollection[onChangeAction]({modelId: self.modelId, state: val, isSliderChange: true}).then(function(){
			        			theirDeferred.resolve();
			        		},function(err){
			        			theirDeferred.reject(err);
			        		});
			        	});
		    		});
		    	}  	
		    };
		},
		
		////////////////////
		// _getValueAttr
		//////////////////
		//
		// Return the value of the currently active slider
		//
		_getValueAttr: function() {
			if(this._sliders[this.modelId] && !this._disabled) {
				return this._sliders[this.modelId].get("value");	
			}
			return null;
		},

		///////////////////
		// _setValueAttr
		//////////////////
		//
		// Set the value of the currently active slider
		//
		_setValueAttr: function(args) {
			if(this._sliders[this.modelId] && !this._disabled) {
				this._sliders[this.modelId].setValue(args.value,args.withoutOnChange);
			}
		},
		
		//////////////////////
		// _setDisabledAttr
		/////////////////////
		//
		// Disable the slider (pulls the slider off the DOM Node but doesn't destroy it!)
		//
		_setDisabledAttr: function(val) {
			var self=this;
			require(["dojo/dom-style"],function(domStyle){
				if(val) {
					if(self.domNode.firstChild) {
						domConstruct.place(self._disablingOverlay,self.domNode.firstChild,"replace");
					} else {
						domConstruct.place(self._disablingOverlay,self.domNode,"first");	
					}	
				} else {
					domConstruct.place(self._sliders[self.modelId].domNode,self.domNode.firstChild,"replace");
				}
				domStyle.set(self._disablingOverlay,"display",val ? "block" : "none");
			});
		},
				
		/////////////////
		// _makeSlider
		////////////////
		//
		// Make a slider based on the provided parameters and store it in the _sliders collection
		// This DOES NOT place the slider on the DOM
		//
		_makeSlider: function(params) {
			params.sliderNodeId = "slider_" + utils.makeId();
			if(!this.modelId) {
				params.containerDomNode = this.domNode;	
			}
			params.onChangeAction = this._makeOnChange();
			this._sliders[params.modelId] = new BioTapHSlider(params);
		},
		
		// Get the preferred height
		prefHeight: function() {
			return PREFERRED_HEIGHT;
		},
		
		// Override
		/////////////////
		// postCreate
		/////////////////
		//
		// Create a disabling overlay for this widget to be put in place any time it's disabled
		//
		postCreate: function() {
			
			this.inherited(arguments);
			this._disablingOverlay = domConstruct.create("div",{id: "disabling_"+this.id,"class": "DisablingOverlay"},this.domNode,"first");			
			this._asyncBuilder.resolve();
		},
		 
		// Override
		///////////
		// resize
		///////////
		//
		// Enforce the value in PREFERRED_HEIGHT
		//
		resize: function(newSize) {
			if(!newSize) {
				newSize = {};
			}
			newSize.h = PREFERRED_HEIGHT;
			this.inherited(arguments);
		},
		
		/////////////
		// remove
		/////////////
		//
		// Destroy this widget and all of its contained sliders
		//
		remove: function() {
			var self=this;
			DojoArray.forEach(Object.keys(this._sliders),function(slider){
				self._sliders[slider] && self._sliders[slider].remove();
			});
			domConstruct.destroy(this._disablingOverlay);
			this.destroyRecursive();
		},
		
		constructor: function(params) {
			var self=this;
			this._asyncBuilder = new Deferred();
			params.id = "timeslider_pane_"+(params.id || utils.makeId());
			params.region = (params.region || DEFAULT_REGION);
			params["class"] = (params["class"] ? params["class"] + " " : "") + "TimeSliderPane";
			this._timeSliderDef = params.timeSliderDef;
			
			this._sliders = {};
			
			this._onChangeAction = params.onChangeAction || ONCHANGE_ACTION;
			
			this.inherited(arguments);
			
			this._asyncBuilder.promise.then(function(){
				if(params.modelId !== null && params.modelId !== undefined) {
					self.set("modelId",params.modelId);
				}
				// If this slider is being generated for a current model, enable it, otherwise,
				// disable it
				self.set("disabled",!(params.modelId !== null && params.modelId !== undefined));
			});

		}
		
	});
		
});
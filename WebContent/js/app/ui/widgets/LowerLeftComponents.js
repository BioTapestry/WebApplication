define([
	"dijit/layout/BorderContainer"
	,"dojo/_base/array"
	,"dojo/_base/declare"
	,"./TimeSliderWidget"
	,"./Overlay/OverlayWidget"
	,"./ModelAnnotImgWidget"
	,"app/utils"
],function(
	BorderContainer
	,DojoArray
	,declare
	,TimeSlider
	,Overlay
	,ModelAnnotImg
	,utils
){
	
	var MIN_SIZE_LEFT_LOWER_CONTAINER = 85;
	
	var componentProps = {
		timeSlider: {
			prefReg: "top",
			promote: true,
			module: TimeSlider
		},
		modelAnnotImg: {
			prefReg: "bottom",
			promote: false,
			module: ModelAnnotImg
		},
		overlay: {
			prefReg: "center",
			promote: false,
			module: Overlay
		}
	};
	
	
	////////////////////////////
	// LowerLeftComponents
	///////////////////////////
	// 
	// Extended BorderContainer which houses all of the lower left BT components
	// (Overlay, Model Annotation Image, Time Slider) which are active.
	
	var LowerLeftComponents = declare([BorderContainer],{
			
		// A convenience object indicating which modules are actually loaded; can also
		// be used to iterate through loaded modules
		_components: null,
		
		_totalReqHeight: 0,
		
		// If an object is loaded, a copy of the reference is stored here for use
		timeSlider: null,
		overlay: null,
		modelAnnotImg: null,
		
		// The current model ID; this is more relevant to our children than
		// to us, but we store a copy
		modelId: null,
		
		_setModelIdAttr: function(val,params) {
			var self=this;
			this.modelId = val;
			DojoArray.forEach(Object.keys(this._components),function(comp){
				self[comp].set("modelId",val,params);
			});
		},
		
		// Resizing events require us to adjust the container's area,
		// because if we have all 3 items normally the 'center' item
		// gets any leftover area, but we actually need each part to
		// have a fixed amount of space.
		_arrangePanesAndSize: function() {
			var promotable,center,first,totalHeightNeeded = 0;
			var self=this;
			if(Object.keys(this._components).length > 0) {
				for(var i in componentProps) {
					if(this[i]) {
						if(!first) {
							first = this[i];
						}
					
						if(componentProps[i].promote) {
							promotable = this[i];
						}
						
						// A minimum of one component MUST have a region of center
						if(componentProps[i].prefReg === "center") {
							if(!center) {
								center = this[i];
							}
						}
						totalHeightNeeded += this[i].prefHeight();
						this[i].set("region",componentProps[i].prefReg);
					}
				}
				if(!center) {
					center = (!promotable) ? first : promotable;
					center.set("region","center");
				}
			}
			
			this._totalReqHeight = totalHeightNeeded;
			
			require(["views"],function(BTViews){
				self.resize({h: (totalHeightNeeded)});
				BTViews.resizeApplicationPane();
			});
		},
		
		// Make sure that newSize has the minimum size we require;
		// if not, force it to
		resize: function(newSize) {
			if(newSize !== undefined && newSize !== null) {
				if(newSize.h !== undefined && newSize.h !== null) {
					MIN_SIZE_LEFT_LOWER_CONTAINER = newSize.h;
					this.set("minSize",newSize.h);
				}
				this.inherited(arguments);
				
				// Because all new size in a BorderContainer goes to the center, we have to resize any fixed elements
				// (in this case, top and bottom) to get them back to the right size
				this.modelAnnotImg && this.modelAnnotImg.resize();
				this.timeSlider && this.timeSlider.resize();
				
			} else {
				this.inherited(arguments);
			}
		},
		    	
		// Destroy a given component of this LLC
		remove: function(thisComp,withoutResize) {
			if(this[thisComp]) {
				this.removeChild(this[thisComp]);
				this[thisComp].remove();
				this[thisComp] = null;
				delete this._components[thisComp];
				if(!withoutResize) {
					this._arrangePanesAndSize();	
				}
			}
		},
		
		// Destroy all of our components
		removeAll: function(withoutResize) {
			var self=this;
			DojoArray.forEach(Object.keys(this._components),function(comp){
				self.remove(comp,withoutResize);
			});
		},
		
		// Load a specific component, optionally destroy the existing component
		load: function(thisComp,params,withRemove) {
    		if(this[thisComp] && withRemove) {
    			this.remove(thisComp);
    		}
    		this[thisComp] = new componentProps[thisComp].module(params);
    		this.addChild(this[thisComp]);
    		this._components[thisComp] = true;
    		this._arrangePanesAndSize();
		},
    	
    	disable: function(thisComp) {
    		this[thisComp] && this[thisComp].set("disabled",true);
    	},
    	
    	enable: function(thisComp) {
    		this[thisComp] && this[thisComp].set("disabled",false);
    	},
    	
    	getValue: function(thisComp,subWidget) {
    		if(subWidget) {
    			return this[thisComp].getValue(subWidget);
    		}
    		return this[thisComp].get("value");
    	},
    	
    	setValue: function(thisComp,args) {
    		if(args && args.subWidget) {
    			this[thisComp].setValue(args.subWidget,args);
    		} else {
    			this[thisComp].set("value",args);
    		}
    	},
    	
    	setProp: function(thisComp,thisProp,value,args) {
    		if(this[thisComp]) {
    			if(args && args.subWidg) {
    				this[thisComp].setProp(args.subWidg,thisProp,value,args);
    			} else {
    				this[thisComp].set(thisProp,value,args);	
    			}
    			
    		}
    	},
    	
    	applyCurrentOverlay: function() {
    		this.overlay && this.overlay.applyCurrentOverlay();
    	},
    	setOverlay: function(overlay,pathSet) {
    		this.overlay && this.overlay.setOverlay(overlay,pathSet);
    	},
    	toggleModules: function(e) {
    		if(this.overlay) {
    			return this.overlay.toggleModules(e);	
    		}
    		return null;
    	},
		
		postCreate: function(params){
			this.inherited(arguments);
		},
		
		constructor: function(params) {
			
			this.id = "lowerleftWrapper_" + (params.id || utils.makeId());
			params["class"] = "LeftLowerWrapper";
	    	params.region = "center";
	    	params.gutters = false;
	    	params.minSize = MIN_SIZE_LEFT_LOWER_CONTAINER;
	    	this._components = {};
			
			this.inherited(arguments);
		}
	});
	
	// Our collection of all LowerLeftComponents, indexed by their relevant tabIDs
	var _llcCollex = {
	};
	
	return {
		getLowerLeftComponents: function(tabId) {
			return _llcCollex[tabId];
		},
		makeNewLowerLeftComponents: function(tabId,args) {
			if(_llcCollex[tabId]) {
				console.error("[ERROR] That LowerLeftComponents already exists! ("+tabId+")");
			} else {
				_llcCollex[tabId] = new LowerLeftComponents(args || {});	
			}
			return _llcCollex[tabId];
		},
		remove: function(tabId) {
			if(_llcCollex[tabId]) {
				_llcCollex[tabId].removeAll();
				_llcCollex[tabId].destroyRecursive();
				delete _llcCollex[tabId];
			}			
		}
	};
});
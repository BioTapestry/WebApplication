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
    "dijit/layout/BorderContainer",
    "dijit/layout/ContentPane",
    "./TimeSlider",
    "./ModelAnnotationImage",
    "./Overlay",
    "dojo/domReady!"
],function(
	BorderContainer,
	ContentPane,
	TimeSlider,
	ModelAnnotImg,
	Overlay
){
	
	var components_ = {
		timeSlider: {
			module: TimeSlider,
			prefReg: "top",
			promote: true,
			component: null
		},
		modelAnnotImg: {
			module: ModelAnnotImg,
			prefReg: "bottom",
			promote: false,
			component: null
		},
		overlay: {
			module: Overlay,
			prefReg: "center",
			promote: false,
			component: null
		}
	};
	
	var MIN_SIZE_LEFT_LOWER_CONTAINER = 15;
	
    var container_ = new BorderContainer({
    	id: "left_lower_wrapper",
    	region: "bottom",
    	gutters: false,
    	minSize: MIN_SIZE_LEFT_LOWER_CONTAINER
    });
    
	container_.startup();
    
    function resizeContainer_(newSize) {
		if(newSize !== undefined && newSize !== null) {
			if(newSize.h !== undefined && newSize.h !== null) {
				MIN_SIZE_LEFT_LOWER_CONTAINER = newSize.h;
				container_.set("minSize",newSize.h);
			}
			container_.resize(newSize);
			
			// Because all new size in a BorderContainer goes to the center, we have to resize any fixed elements
			// (in this case, top and bottom) to get them back to the right size
			components_.modelAnnotImg.module.resize();
			components_.timeSlider.module.resize();
			
		} else {
			container_.resize();
		}    	
    }
    
    
	function _arrangePanesAndSize() {
		var promotable,center,first,totalHeightNeeded = 0;
		
		if(container_.getChildren().length > 0) {
			for(var i in components_) {
				if(components_.hasOwnProperty(i) && components_[i].component !== null) {
					if(!first) {
						first = components_[i].component;
					}
					
					if(components_[i].promote) {
						promotable = components_[i].component;
					}
					
					// A minimum of one component MUST have a region of center
					if(components_[i].prefReg === "center") {
						if(!center) {
							center = components_[i].component;
						}
					}
					totalHeightNeeded += components_[i].module.prefHeight();
					components_[i].component.set("region",components_[i].prefReg);
				}
			}
			
			if(!center) {
				center = (!promotable) ? first : promotable;
				center.set("region","center");
			}
		}
				
		require(["views"],function(BTViews){
			resizeContainer_({h: (totalHeightNeeded)});
			BTViews.resizeApplicationPane();
		});
	};
	
	function _clear(thisComponent,withoutResize) {
		if(components_[thisComponent].module.isLoaded()) {
			container_.removeChild(components_[thisComponent].component);
			components_[thisComponent].module.remove();
			components_[thisComponent].component = null;
			if(!withoutResize) {
				_arrangePanesAndSize();	
			}
		}
	};
	
    return {
    	resizeContainer: function(newSize) {
    		resizeContainer_(newSize);
    	},
    	
    	clear: function(thisComponent,withoutResize) {
    		_clear(thisComponent,withoutResize);
    	},
    	
    	clearAll: function() {
    		for(var i in components_) {
    			if(components_.hasOwnProperty(i)) {
    	    		_clear(i);
    			}
    		}
    	},
    	
    	disable: function(thisComponent,args) {
    		if(components_[thisComponent].module.isLoaded()) {
    			components_[thisComponent].module.disable(args);
    		}
    	},
    	
    	enable: function(thisComponent) {
    		components_[thisComponent].module.enable();
    	},    	
    	
    	load: function(thisComponent,params,removeFirst) {
    		if(components_[thisComponent].module.isEnabled() && removeFirst) {
    			components_[thisComponent].module.remove();
    		}
    		components_[thisComponent].component = components_[thisComponent].module.load(params);
    		container_.addChild(components_[thisComponent].component);
    		components_[thisComponent].module.start();
    		_arrangePanesAndSize();
    	},
    	
    	getModule: function(component) {
    		return components_[component].module;
    	},

    	getValue: function(thisComponent) {
    		return components_[thisComponent].module.getValue();
    	},
    	
    	setValue: function(thisComponent,args) {
    		components_[thisComponent].module.setValue(args);
    	},

    	getContainer: function() {
    		return container_;
    	}
    	
    };
	
});
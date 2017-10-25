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

/****************************************************
 * ZoomController
 ****************************************************
 * 
 * A module which holds the allowed zoom values, manages custom zoom
 * values, and 
 * 
 * 
 * 
 * 
 * 
 */

define([  
    "dojo/Stateful",
    "dojo/_base/declare",
    "dojo/dom"
],function(
	Stateful,
	declare,
	dom
) {
	
	var appZoomStates = {
		inState: "MAIN_ZOOM_IN",
		outState: "MAIN_ZOOM_OUT"
	};
	
	return declare([Stateful],{	
		
		// defaultZoomLevel_
		//
		// Default level the zoomer will start out with and have available
		// for any resets.
		defaultZoomLevel_: null,
		_defaultZoomLevel_Setter: function(val) {
			this.defaultZoomLevel_ = val;
		},
		_defaultZoomLevel_Getter: function() {
			return this.defaultZoomLevel_;
		},
		
		// zoomInterval_
		//
		// When a zoom in or out is done, the number of Array indicies to move
		zoomInterval_: 1,
		
		// customZooming_
		// 
		// Some workspaces are too large to fit even at the lowest zoom value; in these
		// cases, a custom level is set which will encompass the whole workspace
		customZooming_: false,
		
		// useCustomZoom_
		//
		// custom zoom levels are stored on their own array; when we are indexing on this
		// array, useCustomZoom_ is true, and when we are indexing on the primary zoom
		// array, useCustomZoom_ is false
		useCustomZoom_: false,
		
		// customZoomValues_
		//
		// Array of custom zooming values
		customZoomValues_: null,
		
		// zoomedToWorkspace_
		// 
		// There are two types of custom zoom--workspace custom zoom or model custom zoom. 
		// These two are not placed on the custom zoom array together at this time, but
		// rather replace one another depending on the zoom state (workspace zoom or not).
		zoomedToWorkspace_: false,
		
		// modelZoomValue_
		// 
		// In the case custom zooming is needed for both the workspace and the whole model,
		// the model value is temporarily stored here when a workspace custom zoom is being employed.
		modelZoomValue_: null,

		
		// The default zoom values array of scaling values
		zoomValues_: new Array(0.06, 0.12, 0.20, 0.25, 0.33, 0.38, 
			0.44, 0.50, 0.62, 0.67, 0.75, 0.85, 1.0, 1.25, 1.5, 2.0),
							
		//////////////////////
		// updateStates
		/////////////////////
		//
		//
		updateStates: function(zoomLevel,states) {
			var self=this;
			require(["controllers/StatesController"],function(StatesController){
				if(self.useCustomZoom_) {
					StatesController.setState(states.inState,true);
					StatesController.setState(states.outState,false);
				} else {
					StatesController.setState(states.inState,(zoomLevel < (self.zoomValues_.length-1)));
					if(self.customZooming_) {
						StatesController.setState(states.outState,(zoomLevel >= 0));
					} else {
						StatesController.setState(states.outState,(zoomLevel > 0));	
					}
				}
			});				
		},
		
		////////////////////
		// disableZooming
		///////////////////
		//
		//
		disableZooming: function(states) {
			require(["controllers/StatesController"],function(StatesController){
				StatesController.setState(states.inState,false);
				StatesController.setState(states.outState,false);
			});		
		},
		
		/////////////////
		// zoomIn
		////////////////
		//
		// If we are using a custom zoom, move to the main set of zoom values and return
		// 0. If we are on the main set of zoom values, return the next highest one if
		// possible, otherwise, return the highest possible array index.
		// 
		// Update the zoom states represented by the parameter states regardless of return value.
		// 
		// @param zoomLevel
		// @param states
		// @returns
		zoomIn: function(zoomLevel,states) {
			if(this.useCustomZoom_) {
				this.useCustomZoom_ = false;
				this.updateStates(0,states ? states : appZoomStates);
				if(this.zoomedToWorkspace_) {
					this.zoomedToWorkspace_ = false;
					this.customZoomValues_[0] = this.modelZoomValue_;
				}
				return 0;
			}
			if(zoomLevel < (this.zoomValues_.length-this.zoomInterval_)) {
				this.updateStates(zoomLevel+this.zoomInterval_,states ? states : appZoomStates);
				return (zoomLevel+this.zoomInterval_);
			}
			return zoomLevel;
		},
		
		/***************************
		 * zoomOut
		 ***************************
		 * 
		 * If the zoom level can be 'zoomed out' (array index reduced) then do so.
		 * If it cannot, check for a custom zoom possibility, and use that instead.
		 * 
		 * Update the zoom states represented by the parameter states regardless of return value.
		 * 
		 * @param zoomLevel
		 * @param states
		 * @returns
		 * 
		 */
		zoomOut: function(zoomLevel,states) {
			if(zoomLevel >= this.zoomInterval_) {
				this.updateStates(zoomLevel-this.zoomInterval_,states ? states : appZoomStates);
				return (zoomLevel-this.zoomInterval_);
			}	
			
			if(this.customZooming_ && !this.useCustomZoom_) {
				this.useCustomZoom_ = true;
				this.updateStates(0,states ? states : appZoomStates);
				return 0;
			}
			return zoomLevel;
			
		},
			
		/**********************************
		 * getZoomValue
		 **********************************
		 * 
		 * Return the zoom scale value (eg. 0.06 for 6% scaling) as represented
		 * in either the customZoomValues array or the zoomValues array, at the
		 * provided level.
		 * 
		 * 
		 * @param level
		 * @returns
		 * 
		 */
		getZoomValue: function(level) {
			if(this.useCustomZoom_) {
				return this.customZoomValues_[level];
			}
			return this.zoomValues_[level];
		},	
		
		/**
		 * 
		 * 
		 * 
		 * @returns
		 */
		getDefaultZoom: function() {
			return this.defaultZoomLevel_;
		},
		
		/**
		 * 
		 * 
		 * 
		 * 
		 * 
		 * 
		 * 
		 * @param modelSize
		 * @param clientSize
		 * @param zoomType
		 * @param states
		 * @returns
		 * 
		 */		
		getOptimalZoom: function(modelSize,clientSize,zoomType,states) {
			var optimalZoom = this.zoomValues_[this.defaultZoomLevel_];
			switch(zoomType) {
				case "WORKSPACE":
					this.zoomedToWorkspace_ = true;
				case "OPTIMAL_WHOLE_MODEL":
				case "OPTIMAL_SELECTED":
					var widthZoom = clientSize.w/modelSize.w;
					var heightZoom = clientSize.h/modelSize.h;
					optimalZoom = Math.min(widthZoom,heightZoom);
					break;
				case "OPTIMAL_GROUP_NODE":
					var widthZoom = clientSize.w/modelSize.w;
					var heightZoom = clientSize.h/modelSize.h;					
					optimalZoom = Math.min(1.0,widthZoom,heightZoom);
					break;
				default: 
			
					break;
			}			

			var closestZoom = this.getClosestZoomValue(optimalZoom);
			
			if(this.zoomValues_[closestZoom] > optimalZoom && zoomType !== "OPTIMAL_SELECTED") {
				if(!this.customZooming_) {
					this.customZoomValues_ = [optimalZoom];
					this.customZooming_ = true;
				} else {
					this.customZoomValues_[0] = optimalZoom;
				}
				if(zoomType === "OPTIMAL_WHOLE_MODEL") {
					this.modelZoomValue_ = optimalZoom;
				}
				this.useCustomZoom_ = true;
				closestZoom = 0;				
			} else {
				this.useCustomZoom_ = false;
			}
			
			this.updateStates(closestZoom,states ? states : appZoomStates);

			return closestZoom;
		},
		
		/***********************
		 * getClosestZoomValue
		 ***********************
		 * 
		 * Given a desired zoom value, binary search the set of zoomValues for the closest
		 * available value which is equal to or lower than that value. Returns the index 
		 * of that value.
		 * 
		 * @param val
		 * @returns {Number}
		 * 
		 */
		getClosestZoomValue: function(val) {
			var start=0,stop=this.zoomValues_.length-1,mid=Math.floor((stop+start)/2);
			var done = false;
			
			while(!done) {
				if(start > stop || this.zoomValues_[mid] === val) {
					done = true;
				} else {
					if(val < this.zoomValues_[mid]) {
						stop = mid-1;
					} else {
						start = mid+1;
					}
				}
				mid=Math.floor((stop+start)/2);
			}
			
			var returnVal = 0;
			
			if(mid >= 0 && mid <= (this.zoomValues_.length-1)) {
				while(mid > 0 && this.zoomValues_[mid] > val) {
					mid--;
				}
				returnVal = mid;
			} else if(mid >= this.zoomValues_.length) {
				returnVal = this.zoomValues_.length-1;
			}
			
			return returnVal;
		},
		
		/****************************
		 * constructor
		 ****************************
		 *
		 * Takes in the default zoom value for the zoomer and applies it
		 *
		 * @param defaultZoomLevel
		 * 
		 */
		constructor: function(defaultZoomLevel) {
			this.defaultZoomLevel_ = defaultZoomLevel;
		}
	});
	
});
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
    "dojo/_base/array",
    "models/LocalStates"
],function(
	DojoArray,
	LocalStates
){
	
	////////////////////////////////////////
	// StatesController
	///////////////////////////////////////
	//
	// A module for managing client-side (local) states, which are used in activating or deactivating various 
	// actions and their related widgets (eg. toolbar buttons, menu items)
	// 
	// The list of watchable local states is maintained in the LocalStates module, which this module interacts
	// with to assign watch callbacks, determine if a state is local, and apply masking to turn a state on or
	// off based on client and server events
		
	// Masks are meant to change the *current* status of a state without changing its
	// overall state. For example, a mask might make a state be false when it is already
	// false; if the mask is removed the state should *remain* false.
	var activeMasks = {};

	function _stateIsLocal(key) {
		return !!(LocalStates[key] !== undefined);
	};
	
	function _setState(key,state) {
		if(LocalStates[key] !== undefined) {
			LocalStates.set(key,state);
		}
	};
	
	function _getState(key) {
		if(LocalStates[key] !== undefined) {
			return LocalStates.get(key);
		}
		return null;
	};
		
	////////////////////////////////////////////////////////////////////////
	// Module Interface
	////////////////////////////////////////////////////////////////////////
	
	return {
		
		// base state names for frequently used local states which may need to be
		// named similarly but not identically to a local state (eg., zoom in for
		// a floating artboard should not be named MAIN_ZOOM_IN as it will effect
		// the application zoom button, but it should still be named [something]_ZOOM_IN).
		zoomIn: "_ZOOM_IN",
		zoomOut: "_ZOOM_OUT",
		zoomToAllSelected: "_ZOOM_TO_ALL_SELECTED",
		selectNone: "_SELECT_NONE",
		zoomToCurrSel: "_ZOOM_TO_CURRENT_SELECTED",
		centerOnPrev: "_CENTER_ON_PREVIOUS_SELECTED",
		centerOnNext: "_CENTER_ON_NEXT_SELECTED",
		
		setStateWatch: function(key,callback) {
			return(LocalStates.watch(key,callback));
		},
		
		setState: function(key,value) {
			_setState(key,value);
		},
		getState: function(key) {
			return _getState(key);
		},
		
		stateIsLocal: function(key) {
			return _stateIsLocal(key);
		},
		
		updateMasks: function(masks) {
			if(masks && masks.maskingActive) {
				if(masks.maskedOn && masks.maskedOn.length > 0) {
					DojoArray.forEach(masks.maskedOn,function(mask){
						activeMasks[mask] = true;
					});
				}
				if(masks.maskedOff && masks.maskedOff.length > 0) {
					DojoArray.forEach(masks.maskedOff,function(mask){
						activeMasks[mask] = false;
					});
				}				
			} else {
				activeMasks = {};
			}
		},
		
		updateItemStates: function(myItems,states) {
			DojoArray.forEach(myItems,function(item){
				if(item.typeAndKey) {
					var isEnabled = null;
					if(activeMasks[item.typeAndKey] !== null && activeMasks[item.typeAndKey] !== undefined) {
						isEnabled = activeMasks[item.typeAndKey];
					} else if(_stateIsLocal(item.typeAndKey)) {
						isEnabled = _getState(item.typeAndKey);
					} else {
						if(states) {
							isEnabled = states[item.typeAndKey];
						}
					}
					if(isEnabled !== null && isEnabled !== undefined) {
						item.set("disabled",!isEnabled);
					} else {
						if(states) {
							item.set("disabled",false);
						}
					}
				}
			});
		}
	};
	
});
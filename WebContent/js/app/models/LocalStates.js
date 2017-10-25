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

/**
 * Module for flagging what states are managed locally by the client
 * 
 * 
 */

define([
    "dojo/Stateful",
    "dojo/_base/declare"        
],function(
	Stateful,
	declare
){
	
	///////////////////////////////////
	// LocalStates
	//////////////////////////////////
	//
	// A module defining locally-controlled action states. Via the StatesController, these states
	// can be watched for changes in their value. If a state is not a member of the LocalStates singleton
	// then its status will not be tracked for watch callbacks, but it can be added for general
	// value storage.
	
	var LocalStates = declare([Stateful],{
		MAIN_ZOOM_IN: null,
		MAIN_ZOOM_OUT: null,
		MAIN_SELECT_ALL: null,
		MAIN_SELECT_NONE: null,
		MAIN_ZOOM_TO_ALL_SELECTED: null,
		MAIN_ZOOM_TO_CURRENT_SELECTED: null,
		MAIN_CENTER_ON_PREVIOUS_SELECTED: null,
		MAIN_CENTER_ON_NEXT_SELECTED: null,
		POP_APPEND_TO_CURRENT_SELECTION: null,
		MAIN_DRAW_NETWORK_MODULE: null,
		MAIN_DRAW_NETWORK_MODULE_LINK: null,
		MAIN_EDIT_CURR_NETWORK_OVERLAY: null,
		MAIN_REMOVE_CURR_NETWORK_OVERLAY: null,
		MAIN_TOGGLE_MODULE_COMPONENT_DISPLAY: null,
		ON_PATH: null,
		PATH_COMBO: null,
		
		
		_MAIN_ZOOM_INSetter: function(val) {
			this.MAIN_ZOOM_IN = val;
		},
		_MAIN_ZOOM_INGetter: function() {
			return this.MAIN_ZOOM_IN;
		},
		_MAIN_ZOOM_OUTSetter: function(val) {
			this.MAIN_ZOOM_OUT = val;
		},
		_MAIN_ZOOM_OUTGetter: function() {
			return this.MAIN_ZOOM_OUT;
		},
		
		_MAIN_SELECT_ALLSetter: function(val) {
			this.MAIN_SELECT_ALL = val;
		},
		_MAIN_SELECT_ALLGetter: function() {
			return this.MAIN_SELECT_ALL;
		},
		
		_MAIN_SELECT_NONESetter: function(val) {
			this.MAIN_SELECT_NONE = val;
		},
		_MAIN_SELECT_NONEGetter: function() {
			return this.MAIN_SELECT_NONE;
		},

		MAIN_ZOOM_TO_ALL_SELECTEDSetter: function(val) {
			this.MAIN_ZOOM_TO_ALL_SELECTED = val;
		},
		MAIN_ZOOM_TO_ALL_SELECTEDGetter: function() {
			return this.MAIN_ZOOM_TO_ALL_SELECTED;
		},		

		MAIN_ZOOM_TO_CURRENT_SELECTEDSetter: function(val) {
			this.MAIN_ZOOM_TO_CURRENT_SELECTED = val;
		},
		MAIN_ZOOM_TO_CURRENT_SELECTEDGetter: function() {
			return this.MAIN_ZOOM_TO_CURRENT_SELECTED;
		},		
		
		MAIN_CENTER_ON_NEXT_SELECTEDSetter: function(val) {
			this.MAIN_CENTER_ON_NEXT_SELECTED = val;
		},
		MAIN_CENTER_ON_NEXT_SELECTEDGetter: function() {
			return this.MAIN_CENTER_ON_NEXT_SELECTED;
		},		
		
		MAIN_CENTER_ON_PREVIOUS_SELECTEDSetter: function(val) {
			this.MAIN_CENTER_ON_PREVIOUS_SELECTED = val;
		},
		MAIN_CENTER_ON_PREVIOUS_SELECTEDGetter: function() {
			return this.MAIN_CENTER_ON_PREVIOUS_SELECTED;
		},
		
		MAIN_DRAW_NETWORK_MODULESetter: function(val) {
			this.MAIN_DRAW_NETWORK_MODULE = val;
		},
		MAIN_DRAW_NETWORK_MODULEGetter: function() {
			return this.MAIN_DRAW_NETWORK_MODULE;
		},
		MAIN_DRAW_NETWORK_MODULE_LINKSetter: function(val) {
			this.MAIN_DRAW_NETWORK_MODULE_LINK = val;
		},
		MAIN_DRAW_NETWORK_MODULE_LINKGetter: function() {
			return this.MAIN_DRAW_NETWORK_MODULE_LINK;
		},
		MAIN_EDIT_CURR_NETWORK_OVERLAYSetter: function(val) {
			this.MAIN_EDIT_CURR_NETWORK_OVERLAY = val;
		},
		MAIN_EDIT_CURR_NETWORK_OVERLAYGetter: function() {
			return this.MAIN_EDIT_CURR_NETWORK_OVERLAY;
		},
		MAIN_REMOVE_CURR_NETWORK_OVERLAYSetter: function(val) {
			this.MAIN_REMOVE_CURR_NETWORK_OVERLAY = val;
		},
		MAIN_REMOVE_CURR_NETWORK_OVERLAYGetter: function() {
			return this.MAIN_REMOVE_CURR_NETWORK_OVERLAY;
		},
		MAIN_TOGGLE_MODULE_COMPONENT_DISPLAYSetter: function(val) {
			this.MAIN_TOGGLE_MODULE_COMPONENT_DISPLAY = val;
		},
		MAIN_TOGGLE_MODULE_COMPONENT_DISPLAYGetter: function() {
			return this.MAIN_TOGGLE_MODULE_COMPONENT_DISPLAY;
		},
		
		ON_PATHSetter: function(val) {
			this.ON_PATH = val;
		},
		ON_PATHGetter: function() {
			return this.ON_PATH;
		},	
		PATH_COMBOSetter: function(val) {
			this.PATH_COMBO = val;
		},
		PATH_COMBOGetter: function() {
			return this.PATH_COMBO;
		},	
		
		constructor: function(states) {
			declare.safeMixin(this,states);
		}
	});
	
	var BioTapestryLocalStates = new LocalStates({
		MAIN_ZOOM_IN: true,
		MAIN_ZOOM_OUT: true,
		MAIN_SELECT_ALL: true,
		MAIN_SELECT_NONE: false,
		MAIN_ZOOM_TO_ALL_SELECTED: false,
		MAIN_ZOOM_TO_CURRENT_SELECTED: false,
		MAIN_CENTER_ON_PREVIOUS_SELECTED: false,
		MAIN_CENTER_ON_NEXT_SELECTED: false,
		POP_APPEND_TO_CURRENT_SELECTION: null,
		MAIN_DRAW_NETWORK_MODULE: false,
		MAIN_DRAW_NETWORK_MODULE_LINK: false,
		MAIN_EDIT_CURR_NETWORK_OVERLAY: false,
		MAIN_REMOVE_CURR_NETWORK_OVERLAY: false,
		MAIN_TOGGLE_MODULE_COMPONENT_DISPLAY: false,	
		ON_PATH: {},
		PATH_COMBO: {},
		SHOW_OVERLAY: null
	});
	
	// Singleton
	return BioTapestryLocalStates;

});
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
    "dojo/Stateful",
    "dojo/_base/declare"
],function(
	Stateful,
	declare
) {
	
	var ConditionStates = declare([Stateful],{
		SHOW_PATH: null,
		_SHOW_PATHSetter: function(val) {
			this.SHOW_PATH = val;
		},
		_SHOW_PATHGetter: function() {
			return this.SHOW_PATH;
		},
		
		SHOW_OVERLAY: null,
		_SHOW_OVERLAYSetter: function(val) {
			this.SHOW_OVERLAY = val;
		},
		_SHOW_OVERLAYGetter: function() {
			return this.SHOW_OVERLAY;
		},
		
		DO_GAGGLE: null,
		_DO_GAGGLESetter: function(val) {
			this.DO_GAGGLE = val;
		},
		_DO_GAGGLEGetter: function() {
			return this.DO_GAGGLE;
		},
		
		EDITOR: null,
		_EDITORSetter: function(val) {
			this.EDITOR = val;
			this.VIEWER = !val;
		},
		_EDITORGetter: function() {
			return this.EDITOR;
		},

		VIEWER: null,
		_VIEWERSetter: function(val) {
			this.VIEWER = val;
			this.EDITOR = !val;
		},
		_VIEWERGetter: function() {
			return this.VIEWER;
		},
		
		constructor: function(states) {
			declare.safeMixin(this,states);
		},
		
		applyStates: function(states) {
			for(var i in states) {
				if(states.hasOwnProperty(i)) {
					if(this[i] !== states[i]) {
						this.set(i,states[i]);	
					}
				}
			}
		}
		
	});
	
	// request initial states from the server goes here
	
	var BioTapestryConditions = new ConditionStates({
		SHOW_PATH: false,
		SHOW_OVERLAY: false,
		DO_GAGGLE: false,
		EDITOR: false,
		VIEWER: true
	});
	
	// singleton
	return BioTapestryConditions;

});
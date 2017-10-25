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
    "dojo/_base/declare",
    "dojo/Stateful",
	"dojo/domReady!"
],function(
	declare,
	Stateful
) {
		
	var DYNAMIC_PRECURSOR = "{DiP}@";
	
	return(declare([Stateful],{
		
		type_: null,
		
		state_: null,
		_state_Setter: function(val) {
			this.state_ = val;
		},
		_state_Getter: function() {
			return this.state_;
		},
		states_: null,
		stateMin_: null,
		stateMax_: null,
		
		annotationImages_: null,
		
		// This is the root instance
		vfgParent_: null,
		
		// This is the direct parent model
		parent_: null,
		
		message_: null,
		
		hitboxes_: null,
		
		drawingObjects_: null,
		_drawingObjects_Getter: function() {
			return this.drawingObjects_[this.state_];
		},
		_drawingObjects_Setter: function(val) {
			this.drawingObjects_[this.state_] = val;
		},
				
		// The time at which the information for this model will
		// expire and need to be refreshed off the server
		expiry_: 0,
		_expiry_Getter: function() {
			return this.expiry_;
		},
		_expiry_Setter: function(val) {
			this.expiry_ = val;
		},
		
		modelId_: null,
		_modelId_Getter: function() {
			return this.getModelId();
		},
		_modelId_Setter: function(val) {
			this.modelId_ = val;
		},
		
		getDrawingObject: function() {
			return this.drawingObjects_[this.state_];
		},
		getModelId: function() {
			if(this.type_ === "DYNAMIC_PROXY") {
				return DYNAMIC_PRECURSOR + this.vfgParent_ + "-" + this.modelId_ + ":" + this.state_;
			}
			return this.modelId_;
		},

		getTooltips: function() {
			return this.drawingObjects_[this.state_].tooltips;
		},
		
		getNotes: function() {
			return this.drawingObjects_[this.state_].displayText ? this.drawingObjects_[this.state_].displayText.noteText : null;
		},

		getModuleDescs: function() {
			return this.drawingObjects_[this.state_].displayText ? this.drawingObjects_[this.state_].displayText.moduleText : null;
		},
		
		
		getBaseModelId: function() {
			return this.modelId_;
		},
		getCacheExpir: function() {
			return this.expiry_;
		},
		getMessage: function() {
			return this.message_;
		},
		getHitBoxes: function() {
			return this.hitboxes_;
		},
		
		overlay_: null,
		_overlay_Setter: function(val) {
			this.overlay_ = val;
		},
		_overlay_Getter: function() {
			return this.overlay_;
		},
		
		overlayDefs_: null,
		
		// Quick method for loading up new information
		update: function(params) {
			for(var i in params) {
				if(this.hasOwnProperty(i)) {
					this[i] = params[i];
				}
			}
		},
		
		constructor: function(params) {
			declare.safeMixin(this,params);
			this.drawingObjects_ = {};
			this.annotationImages_ = {};
		}
	}));

});
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
	"controllers/ZoomController",
    "dojo/_base/declare",
    "dojo/Stateful",
    "dojo/_base/array",
    "dojo/Deferred",
	"dojo/domReady!"
],function(
	ZoomController,
	declare,
	Stateful,
	DojoArray,
	Deferred
) {
	
	// models are cached for 5 minutes
	var BASE_CACHE_EXPIRATION = 300000;
	
	return(declare([Stateful],{
		
		asyncModelLoader: null,
		_asyncModelLoaderSetter: function(val) {
			this.asyncModelLoader = val;
		},
		_asyncModelLoaderGetter: function() {
			return this.asyncModelLoader;
		},
		
		// The depth of this model from the VfG, where the index
		// of the VfG's depth is 0
		depth_: null,
		
		// The ID of this model's VfG parent model
		vfgParent_: null,
		
		
		drawingObject_: null,
		_drawingObject_Getter: function() {
			return this.drawingObject_;
		},
		_drawingObject_Setter: function(val) {
			this.drawingObject_ = val;
		},		
		
		// Return a note for the Node with the ID 'node'
		getNote: function(node) {
			return this.notes_[node];
		},
		
		// Get the Tooltip for the Node with the ID 'node', 
		// however if this is for pathing we have to do an additional
		// calculation to determine what we are sending
		getTooltip: function(node,isForPathing,btCanvas) {
			var tooltip = null;
			var self=this;
			if(this.tooltips_) {
				if(isForPathing) {
					if(node.getType() === "linkage") {
						var hitSeg = node.segments[0];
						var segSet = this.tooltips_.linkSegMaps[node.srctag]["isLink = "+hitSeg.islink+" isOnly = "+hitSeg.isonly+" label = "+hitSeg.label+" endID = null"];
						if(segSet.length > 1) {
							var selectionSet = btCanvas.getSelectedNodes();
							DojoArray.forEach(segSet,function(seg){
								if(selectionSet[seg] || selectionSet[btCanvas.getSharedIds(seg)]) {
									tooltip = self.tooltips_.linkTips[seg];
								}								
							});

							if(!tooltip) {
								tooltip = this.tooltips_.ambiguousTips[node.srctag]; 
							}
						} else {
							tooltip = this.tooltips_.linkTips[segSet[0]];
						}
					} else {
						tooltip = this.tooltips_.nodeTips[node.id];
					}
				} else { 
					tooltip = this.tooltips_[node];
				}
			}
			return tooltip;
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
			
		// The modelID of this model; note that in the case of a dynamic proxy
		// this is the full ID and not the parts of the constructed ID
		modelId_: null,
		_modelId_Getter: function() {
			return this.modelId_;
		},
		_modelId_Setter: function(val) {
			this.modelId_ = val;
		},

		// Tooltip text to display; this map should be keyed with node/link IDs
		tooltips_: null,
		_tooltips_Getter: function() {
			return this.tooltips_;
		},
		_tooltips_Setter: function(val) {
			this.tooltips_ = val;
		},		
		
		// Note text to display; this map should be keyed with note IDs
		notes_: null,
		_notes_Getter: function() {
			return this.tooltips_;
		},
		_notes_Setter: function(val) {
			this.notes_ = val;
		},
		
		moduleDescs_: null,
		_moduleDescs_Getter: function() {
			return this.moduleDescs_;
		},
		_moduleDescs_Setter: function(val) {
			this.moduleDescs_ = val;
		},
		
		overlay_: null,
		_overlay_Getter: function() {
			return this.overlay_;
		},
		_overlay_Setter: function(val) {
			this.overlay_ = val;
		},
		
		toggledRegions_: null,
		_toggledRegions_Getter: function() {
			return this.toggledRegions_;
		},
		_toggledRegions_Setter: function(val) {
			this.toggledRegions_ = val;
		},
		
		// Set a watch function on a property of this object
		// This will only report a change if the property
		// has Setter and Getter methods
		setWatch: function(thisProp,thisWatcher) {
			return this.watch(thisProp,thisWatcher);
		},
				
		constructor: function(params) {
			if(params) {
				declare.safeMixin(this,params);
			}
			this.expiry_ = Date.now() + BASE_CACHE_EXPIRATION;
			
		}
	}));

});
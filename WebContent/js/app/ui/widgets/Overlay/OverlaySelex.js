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
    "dojo/_base/declare"
	,"dijit/form/ComboBox"
	,"dojo/store/Memory"
	,"dojo/_base/array"
    ,"dojo/dom-construct"
],function(
	declare
	,ComboBox
	,Memory
	,DojoArray
	,domConstruct
){
	
	// Default value of the selection box, also the 'empty' or
	// 'no overlay' value
	var SELEX_NONE = "None";
	
	// Default onChange if one is not provided
	var onChangeAction = function(e) {
		console.debug("selex onchange:",e);
	};
	
	return declare([ComboBox],{
		
		_selexData: null,
		
		_selexStates: null,
		
		modelId: null,
		
		_onPath: null,
		
		_pathSet: null,
		
		_setDisabledAttr: function(val) {
			this.disabled = val;
			if(val) {
				this._selexStates[this.modelId] = this.value;
				this.set("value","None");
				this.modelId = "null";
			}
		},
		
		_setModelIdAttr: function(val,overlayDefs) {
			if(!this._selexData[val]) {
				this.loadData({modelId: val,defs: overlayDefs});
			}
			if(this.modelId !== val) {
				// Store our current selection value for if we return to this model
				this._selexStates[this.modelId] = this.value;
				
				// If the current value of the ComboBox from its old data store happens
				// to be the same as the value for the new one, the onChange won't trigger,
				// so we clear out the current value to force an onChange to happen.
				this.set("value","",false);
				
				this.set("store",this._selexData[val].mem);
				
				this.modelId = val;
				if(!this._selexStates[val]) {
					this._selexStates[val] = this._selexData[val].startView;
				}
				
				this.set("value",this._selexStates[val]);				
			}			
		},
				
		loadData: function(params) {
			var startView = SELEX_NONE;
			var model = params.modelId || "null";
			
			// If we have a Memory store for this already, don't do anything
			// TODO: eventually we need to support replacement for editor
			if(this._selexData[model]) {
				return;
			}
			
			var data = [{id: SELEX_NONE, name: SELEX_NONE}];
			if(params.defs) {
				DojoArray.forEach(Object.keys(params.defs),function(def){
					var overlayDef = params.defs[def];
					if(overlayDef.isStartView) {
						startView = overlayDef.name;
					}
					data.push({id: overlayDef.ID, name: overlayDef.name, opaque: overlayDef.isOpaque});					
				});
			}

			this._selexData[model] = {startView: startView, mem: (new Memory({data: data, idProperty: "id"}))};
		},
		
		// To avoid needing to edit the template or perform actions which should be specific to this
		// widget from outside of it, this shim method will place the label for the widget
		// once it has been parented to another DOM node
		placeLabel: function() {
			domConstruct.create("label",{
				"for": this.id,
				id: "label_"+this.id,
				"class": "OverlayLabel OverlaySelexLabel", 
				innerHTML: "Overlay:"
			},this.domNode.parentNode,"first");
		},
						
		postCreate: function(params) {
			this.inherited(arguments);
			
			this.set("modelId", this.modelId || "null");
			
			this.textbox.readOnly = true;
		},
		
		remove: function() {
			for(var i in this._selexData) {
				delete this._selexData[i];
			}
			
			for(var i in this._selexStates) {
				delete this._selexStates[i];
			}
		},
		
		constructor: function(params) {
			
			if(!params.onChange) {
				this.onChange = onChangeAction;
			}
			
			this.modelId = params.modelId;
			
			this.id = "overlaySelex_"+(params.id || Date.now() /* utils.makeId */);
			this["class"] = "OverlaySelect";
						
			this._selexStates = {};
			this._selexData = {};
			
			this.loadData(params.overlay ? {modelId: params.modelId, defs: params.overlay} : {});
									
			this._onPath = false;
			this._pathSet = false;
			this.labelAttr = "name";
						
			this.inherited(arguments);
		}
	});
	
});
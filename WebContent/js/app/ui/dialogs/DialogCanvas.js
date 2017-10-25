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
    "dijit/Destroyable",
    "dijit/_WidgetBase",
    "dijit/registry",
    "controllers/StatesController",
    "controllers/ArtboardController",
    "views/BioTapestryCanvas"
],function(
	declare,
	Stateful,
	Destroyable,
	_WidgetBase,
	registry,
	StatesController,
	ArtboardController,
	BTCanvas
) {

	/////////////////////
	// DialogCanvas
	/////////////////////
	//
	// A wrapper for the BTCanvas class to manage its presense in a dialog box
	
	return declare([Stateful,Destroyable],{
		
		disabledContent_: null,
		_disabledContent_Setter: function(val) {
			this.disabledContent_ = val;
			var self=this;
			require(["dojo/dom"],function(dom){
				if(dom.byId(self.disablingOverlayId_)) {
					dom.byId(self.disablingOverlayId_).innerHTML = "<p class=\"disabledText\" id=\"" + self.disablingOverlayId_ + "_text\">" + val + "</p>";
				}
			});
		},
		
		
		zoomStates_: null,
		
		id: null,
		_idSetter: function(val) {
			this.id = val;
		},
		_idGetter: function() {
			return this.id;
		},
		
		artboardAttachmentParams_: null,
		
		cnvContainerDomNodeId_: null,
		cnvWrapperDomNodeId_: null,
		
		myArtboardController_: null,
		
		disablingOverlayId_: null,
		disalblingEventHandlers_: null,
		
		disabled: false,
		_disabledSetter: function(val) {
			this.disabled = val;
			var self=this;
			require(["dojo/dom-style","dojo/dom","dojo/_base/array","dojo/on"],function(domStyle,dom,DojoArray,on){
				var display = val ? "block" : "none";
				if(dom.byId(self.disablingOverlayId_)) {
					domStyle.set(self.disablingOverlayId_,"display",display);
					if(val) {
						self.disablingEventHandlers_ = new Array();
						self.disablingEventHandlers_.push(on(dom.byId(self.disablingOverlayId_),"click",function(e){e.stopPropagation();}));
						self.disablingEventHandlers_.push(on(dom.byId(self.disablingOverlayId_),"mouseover",function(e){e.stopPropagation();}));
					}
				}
				 if(!val) {
					DojoArray.forEach(self.disablingEventHandlers_,function(handler){handler.remove();});
				}
			});
		},
		_disabledGetter: function() {
			return this.disabled;
		},
		
		attachArtboard: function() {
			var self=this;
			
			var params = this.artboardAttachmentParams_ || {}; 

			declare.safeMixin(params,{id: this.id,zoomStates: this.zoomStates_});
			this.myArtboardController_.attachArtboard(params);
			require(["dojo/dom-construct"],function(domConstruct){
				var disablingOverlay = domConstruct.create("div",
					{
						id: self.disablingOverlayId_,
						innerHTML: self.disabledContent_ ? "<p class=\"disabledText\" id=\"" + self.disablingOverlayId_ + "_text\">" + self.disabledContent_ + "</p>" : "", 
						style: "display: " + (self.disabled ? "block" : "none")+
							"; width: 100%; height: 100%; z-index: 951; background-color: rgba(0,0,0,0.25); position: absolute;"
					},self.cnvWrapperDomNodeId_,"first"
				);
				self.set("disabled",self.disabled);
			});
		},
		
		getMyArtboardController: function() {
			return this.myArtboardController_;
		},
			
		getMyBtCanvas: function() {
			return BTCanvas.getBtCanvas(this.cnvContainerDomNodeId_);
		},
		
		destroyRecursive: function() {
			registry.remove(this);
			var self=this;
			require(["controllers/ArtboardController"],function(ArtboardController){
				ArtboardController.removeController(self.cnvContainerDomNodeId_);
			});
			this.destroy();
		},
		
		constructor: function(params) {

			this.cnvContainerDomNodeId_ = params.cnvContainerDomNodeId;
			this.cnvWrapperDomNodeId_ = params.cnvWrapperDomNodeId;
			this.id = params.id;
			this.disabledContent_ = params.disabledContent;
			
			this.artboardAttachmentParams_ = params.artboardAttachmentParams;
			
			this.zoomStates_ = {
				inState: params.id + StatesController.zoomIn,
				outState: params.id + StatesController.zoomOut
			};

			if(params.floatingArtboard === undefined || params.floatingArtboard === null) {
				params.floatingArtboard = true;
			}
			
			declare.safeMixin(params,{canvasStates: {
				SELECT_NONE: params.id + StatesController.selectNone,
				ZOOM_TO_ALL_SELECTED: params.id + StatesController.zoomToAllSelected
			}});
			
			this.disablingOverlayId_ = this.cnvWrapperDomNodeId_ + "_disabled_overlay";
			registry.add(this);
			
			delete params.id;
			
			this.myArtboardController_ = ArtboardController.makeArtboardController(params);
		}
	});
});
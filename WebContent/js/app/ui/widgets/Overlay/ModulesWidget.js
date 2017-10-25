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
	"dijit/layout/ContentPane"
	,"dijit/form/Button"
	,"dijit/form/CheckBox"
	,"dijit"
    ,"dojo/dom-construct"
    ,"dojo/dom-style"
    ,"dojo/_base/declare"
    ,"dojo/_base/array"
    ,"dojo/on"
    ,"app/utils"
    ,"dojo/domReady!"
],function(
	ContentPane
	,Button
	,CheckBox
	,dijit
	,domConstruct
	,domStyle
	,declare
	,DojoArray
	,on
	,utils
) {
	
		
	// Default value of the selection box, also the 'empty' or
	// 'no overlay' value
	var SELEX_NONE = "None";

	// Opacity radio button ID
	var OPACITY_BTN = "opacity";
	var OPACITY_SFX = "_opacity";
	
	var ALLCLEAR_BTN_ACTION = "AC";
	var SHOWHIDE_BTN_ACTION = "SH";
	
	var OPACITY_CUTOFF = 0.5;
	
	
	return declare([ContentPane],{
		
		// The model ID our modules correspond to - this is only set
		// once at construction and not again
		modelId: null,
		
		// The overlay ID corresponding to our currently displayed modules pane.
		// This ID must be unique to a tab otherwise module sets will overwrite
		// one another.
		overlayId: null,
		
		// A map of the content panes which hold an overlays module checkboxes, indexed
		// by overlay ID
		_checkBoxPanes: null,
		
		// ContentPane to swap CheckBoxPanes in and out of, so the order of the Widget's
		// display is preserved.
		_checkBoxHolder: null,

		// Button members
		_btnsPane: null,
		// An array of all module button widgets
		_moduleBtns: null,
		// A subset of the module button widgets which are only relevant to opaque modules
		_opacityBtns: null,
		// The zoom button, which has special behaviors
		_zoomBtn: null,
		
		/////////////////////////
		// _setOverlayIdAttr
		////////////////////////
		//
		//
		_setOverlayIdAttr: function(val,params) {
			this.overlayId = val;
			this.modelId = params.modelId;
			this._swapCheckBoxPane(params);
			if(!val || val === SELEX_NONE) {
				this.set("disabled",true);
			} else {
				if(this.disabled) {
					this.set("disabled",false,params);
				}	
			}
		},
		
		/////////////////////////
		// _setDisabledAttr
		////////////////////////
		//
		//
		_setDisabledAttr: function(val,params) {
			this.disabled = val;
			DojoArray.forEach(this._btnsPane.getChildren(),function(btn){
				btn.set("disabled",val);
			});
			this.updateOpacityBtns(val ? 1 : params.intensity,val ? false : params.isOpaque);
			if(!val) {
				this._updateZoomBtnStatus();
			}
		},
		
		_moduleOnChange: null,
		
		////////////////////////////////////////
		// _moduleBtnAction
		///////////////////////////////////////
		//
		// Unified action for module button click events.
		//
		_moduleBtnAction: function(type,checked) {
			var self=this;
			var somethingChanged = false;
			DojoArray.forEach(this._checkBoxPanes[this.overlayId].getChildren(),function(child){
				// Checkboxes
				if(type == ALLCLEAR_BTN_ACTION && child.type === "checkbox" && child.controlType !== OPACITY_BTN) {
					if(child.checked !== checked) {
						somethingChanged = true;
					}
					child.set("checked",checked,false);
				}
				// Radios
				if(child.type === "checkbox" && child.controlType === OPACITY_BTN) {
					if(type === ALLCLEAR_BTN_ACTION) {
						!checked && child.set("checked",checked,false);
						var intensitySliderValue = dijit.getEnclosingWidget(self.domNode.parentNode)._intensitySlider.getValue();
						child.set("disabled",!checked || (intensitySliderValue <= OPACITY_CUTOFF));
					} else if(type === SHOWHIDE_BTN_ACTION) {
						if(child.checked !== checked) {
							somethingChanged = true;	
						}
						!child.disabled && child.set("checked",checked,false);
					}
				}
			});
			if(somethingChanged) {
				this._moduleOnChange();
			}
			if(type === ALLCLEAR_BTN_ACTION) {
				this._zoomBtn.set("disabled",!checked);	
				require(["controllers/StatesController"],function(StatesController){
					DojoArray.forEach(["MAIN_DRAW_NETWORK_MODULE_LINK","MAIN_TOGGLE_MODULE_COMPONENT_DISPLAY"],function(overlayState){
						StatesController.setState(overlayState,checked);
					});
				});
			}
		},
		
		/////////////////////////
		// _swapCheckBoxPane
		/////////////////////////
		//
		//
		_swapCheckBoxPane: function(params) {
			if(!this._checkBoxPanes[this.overlayId]) {
				if(!params.modules) {
					console.error("[ERROR] Tried to change to an unbuilt Module ("+this.overlayId+") and no definition provided!");
					return;
				}
				this._buildCheckBoxPane(params.modules);
			}
			
			this._checkBoxHolder.removeChild(this._checkBoxHolder.getChildren()[0]);
			this._checkBoxHolder.addChild(this._checkBoxPanes[this.overlayId]);
			
			this.updateOpacityBtns(params.intensity,params.isOpaque);
			
			this._updateZoomBtnStatus();
		},
		
		//////////////////////////
		// _updateZoomBtnStatus
		/////////////////////////
		//
		//
		_updateZoomBtnStatus: function() {
			var moduleSet = this._checkBoxPanes[this.overlayId];
			var modules = moduleSet ? moduleSet.getChildren() : null;
			var zoomEnabled = false;
			DojoArray.forEach(modules,function(module){
				if(module.controlType !== OPACITY_BTN) {
					zoomEnabled = zoomEnabled || module.checked || false;
				}
			});	
			this._zoomBtn.set("disabled",!zoomEnabled);
			require(["controllers/StatesController"],function(StatesController){
				DojoArray.forEach(["MAIN_DRAW_NETWORK_MODULE_LINK","MAIN_TOGGLE_MODULE_COMPONENT_DISPLAY"],function(overlayState){
					StatesController.setState(overlayState,zoomEnabled);
				});
			});
		},
		
		////////////////////////////
		// _buildCheckBoxPane
		///////////////////////////
		//
		//
		_buildCheckBoxPane: function(params) {
			var self=this;
			var checkBoxPane = new ContentPane({
				id: "modulecheckboxes_pane_" + params.ID,
				"class": "ModuleCheckboxesPane"
			});
	
			DojoArray.forEach(params.modules,function(module){
				var containerId = params.ID+"_"+module.name+"_chk_container";
				var checkContainer = domConstruct.create("p",{id: containerId, "class":"ModuleCheckContainer"},checkBoxPane.domNode,"last");
							
				var thisCheck = new CheckBox({
					id: params.ID+"_"+module.ID,
					checked: (module.shownInit === false ? false : true),
					controlType: "module",
					name: module.name,
					value: {moduleId: module.ID,overlayId: params.ID,modelId: self.modelId},
					onChange: function() {
						self._updateZoomBtnStatus();
						self._moduleOnChange();
					},
					style: "float: left; padding-top: 5px;"
				});

				thisCheck.placeAt(checkContainer);
				var placeLabel = thisCheck;
				
				var thisRadio;
				
				if(params.isOpaque) {
					thisRadio = new CheckBox({
						id: params.ID+"_"+module.ID+OPACITY_SFX,
						checkControl: thisCheck,
						controlType: OPACITY_BTN,
						checked: module.revealInit === true ? true : false,
						name: module.name+OPACITY_SFX,
						value: {moduleId: module.ID,overlayId: params.ID,modelId: self.modelId, name: module.name+OPACITY_SFX},
						"class": "CheckBoxRadio",
						onChange: function() {
							self._moduleOnChange();
						},
						style: "float: left; padding-top: 5px;"
					});
					thisRadio.set("disabled",!(thisCheck.checked));
					thisRadio.placeAt(checkContainer);
					placeLabel = thisRadio;
					
					thisCheck.own(on(thisCheck,"change",function(val){
						var intensitySliderValue = dijit.getEnclosingWidget(self.domNode.parentNode)._intensitySlider.getValue();
						thisRadio.set("disabled",!val || (intensitySliderValue <= OPACITY_CUTOFF));
					}));
				}
								
				domConstruct.create("label",{"for": containerId, innerHTML: module.ID,"class":"ModuleCheckLabel"},placeLabel.domNode,"after");
			});
			
			this._checkBoxPanes[params.ID] = checkBoxPane;			
		},
		
		/////////////////////////////
		// _buildButtons
		////////////////////////////
		//
		//
		_buildButtons: function() {
			
			var self=this;
			
			this._btnsPane = new ContentPane({
				id: "modulebtns_"+this.id,
				"class": "OverlayBtnsPane"
			});
			
			var MINIRIGHT = "MiniButton RightHand";
			
			var showBtn = new Button({
				id: "overlayshowbtn_"+this.id,
				label: "Show",
				onClick: function(e) {
					self._moduleBtnAction(SHOWHIDE_BTN_ACTION,true);
				},
				"class": MINIRIGHT
			});
			
			var hideBtn = new Button({
				id: "overlayhidebtn_"+this.id,
				label: "Hide",
				onClick: function(e) {
					self._moduleBtnAction(SHOWHIDE_BTN_ACTION,false);
				},
				"class": MINIRIGHT
			});	
			
			this._zoomBtn = new Button({
				id: "overlayzoombtn_"+this.id,
				label: "Zoom",
				onClick: function(e) {
					require(["controllers/ActionCollection"],function(ActionCollection){
						ActionCollection.CLIENT_ZOOM_TO_MODULES({moduleZoom:"ACTIVE"});
					});
				},
				disabled: true,
				"class": "MiniButton"
			});
					
			var allBtn = new Button({
				id: "overlayallbtn_"+this.id,
				label: "All",
				onClick: function(e) {
					self._moduleBtnAction(ALLCLEAR_BTN_ACTION,true);	
				},
				"class": MINIRIGHT
			});
			
			var clearBtn = new Button({
				id: "overlayclrbtn_"+this.id,
				label: "Clear",
				onClick: function(e) {
					self._moduleBtnAction(ALLCLEAR_BTN_ACTION,false);
				},
				"class": MINIRIGHT
			});
			
			this._moduleBtns = [allBtn,clearBtn];
			
			this._btnsPane.addChild(this._zoomBtn);
			this._btnsPane.addChild(clearBtn);
			this._btnsPane.addChild(hideBtn);
			this._btnsPane.addChild(showBtn);
			this._btnsPane.addChild(allBtn);
			
			this._opacityBtns = [showBtn,hideBtn];

			this.addChild(this._btnsPane);	
			
			this.updateOpacityBtns();
			this._updateZoomBtnStatus();
		},
		
		getModulePane: function(id) {
			return this._checkBoxPanes[id];
		},
		
		///////////////////////////
		// getModuleChildren
		///////////////////////////
		//
		//
		getModuleChildren: function(id) {
			if(this._checkBoxPanes[id]) {
				return this._checkBoxPanes[id].getChildren();
			}
			return null;
		},
				
		/////////////////////////
		// updateOpacityBtns
		////////////////////////
		//
		//
		updateOpacityBtns: function(intensity,isOpaque) {
			DojoArray.forEach(this._opacityBtns,function(btn){
				domStyle.set(btn.domNode,"display",(isOpaque ? "block" : "none"));
				if(isOpaque) {
					btn.set("disabled",(intensity <= OPACITY_CUTOFF));
				}
			});
		},
		
		resize: function(newSize) {
			this.inherited(arguments);
		},

		////////////////////////
		// postCreate
		///////////////////////
		//
		//
		postCreate: function(params){
			
			this.inherited(arguments);
			
			// Create the 'empty' module checkbox pane which corresponds to "None" on the OverlaySelex widget
			this._checkBoxPanes[SELEX_NONE] = new ContentPane({
				id: "modulecheckboxes_pane_empty"+this.id,
				"class": "OverlayCheckBoxPaneEmpty"
			});
			
			this.addChild(this._checkBoxHolder);
			
			this._buildButtons();
			
			this.set("overlayId","None",{ID:"None", modelId: self.modelId,modules: []});
			
			domConstruct.create("span",{innerHTML: "View Modules",style: "font-weight: bold;"},this.domNode,"first");
			
		},
		
		///////////////////
		// remove
		///////////////////
		//
		// Make sure to call destroy on all currently unbound checkBoxPanes, because otherwise they'll leak
		remove: function() {
			var currentPane = this._checkBoxHolder.getChildren()[0];
			for(var i in this._checkBoxPanes) {
				if(this._checkBoxPanes[i] !== currentPane) {
					this._checkBoxPanes[i].destroyRecursive();
				}
				delete this._checkBoxPanes[i];
			}
			this.destroyRecursive();
		},

		///////////////////
		// constructor
		///////////////////
		//
		//
		constructor: function(params){
			
			this._moduleOnChange = params.moduleOnChange;
			
			this.id = "moduleswidget_" + (params.id || utils.makeId());
			this.modelId = params.modelId || "null";
			this._opacityBtns = [];
			this._moduleBtns = [];
			this._checkBoxPanes = {};
			this._checkBoxHolder = new ContentPane({id: "modulecheckholder_"+this.id,"class": "OverlayCheckBoxHolder"});
			this["class"] = "OverlayModulesPane";
			
			this.inherited(arguments);
		}
	});
});
	

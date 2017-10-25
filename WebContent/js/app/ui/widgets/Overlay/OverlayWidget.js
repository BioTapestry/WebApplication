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
    "widgets/BTHSlider"
    ,"./OverlaySelex"
    ,"./ModulesWidget"
    ,"dijit"
    ,"dojo/Deferred"
    ,"dojo/_base/declare"
    ,"dojo/_base/array"
    ,"dijit/layout/ContentPane"
    ,"dojo/throttle"
    ,"dojo/dom-construct"
    ,"dojo/dom-style"
    ,"app/utils"
        
],function(
	BioTapHSlider
	,OverlaySelex
	,ModulesWidget
	,dijit
	,Deferred
	,declare
	,DojoArray
	,ContentPane
	,throttle
	,domConstruct
	,domStyle
	,utils
){
	
	// Default value of the selection box, also the 'empty' or
	// 'no overlay' value
	var SELEX_NONE = "None";
	
	// Action to run when Overlay control values change
	var OVERLAY_ACTION = "CLIENT_SET_OVERLAY";	
	
	// Opacity radio button ID
	var OPACITY_CHK = "opacity";
	var OPACITY_SFX = "_opacity";
	var OPACITY_CUTOFF = 0.5;
	
	var PREFERRED_HEIGHT = 210;
	
	return declare([ContentPane],{
		
		modelId: null,
		
		pathSet: null,
		
		onPath: null,
		
		_disablingOverlay: null,
		
		_overlayDefs: null,
		
		_asyncBuilder: null,
		
		// The slider which controls the alpha of overlays and modules
		_intensitySlider: null,
		_intensitySliderPane: null,
		
		// The checkbox set that controls the display of network modules
		_modules: null,
		
		// The selection box that controls which overlay and corresponding modules is active
		_overlaySelex: null,
		_overlaySelexPane: null,

		////////////////////////
		// _setPathSetAttr
		//////////////////////
		//
		//
		_setOnPathAttr: function(val) {
			this._overlaySelex && this._overlaySelex.set("_onPath",val);
		},
		
		////////////////////////
		// _setPathSetAttr
		//////////////////////
		//
		//
		_setPathSetAttr: function(val) {
			this._overlaySelex && this._overlaySelex.set("_pathSet",val);
		},
		
		/////////////////////
		// _setModelIdAttr
		////////////////////
		//
		//
		_setModelIdAttr: function(val,params) {
			if(!params) {
				params = {};
			}
			if(!this._overlayDefs) {
				this._overlayDefs = {};
			}
			
			this.set("disabled",false);
			this.modelId = val;
			var self=this;
			
			if(params.defs && !this._overlayDefs[self.modelId]) {
				this._overlayDefs[self.modelId] = {};
				DojoArray.forEach(params.defs,function(def){
					self._overlayDefs[self.modelId][def.ID] = def;
				});
			}
			
			this.set("pathSet",params.pathSet);
			
			this._overlaySelex.set("modelId",val,self._overlayDefs[self.modelId]);
		},
		
		/////////////////////////
		// _setDisabledAttr
		////////////////////////
		//
		//
		_setDisabledAttr: function(val) {
			this._disablingOverlay && domStyle.set(this._disablingOverlay,"display",val ? "block": "none");
			this._overlaySelex.set("disabled",val);			
		},
		
		//////////////////////////////////////
		// buildOverlayObject_
		////////////////////////////////////
		//
		// Builds a configuration object to be used in displaying the overlay as
		// defined by the widgets. This object is expected by the overlay API
		// of the CanvasRenderer. It should be formatted as:
		//
		// {id: <overlay id>, enabled_modules: [<{ id: <module id>[, show: true/false]}]}
		//
		// the show property of an enabled modules is only specified for opaque overlays;
		// if not supplied it is assumed to be false (which will hide the contents of the
		// module contained in the overlay)
		//
		_buildOverlayObject: function() {
			var overlay = {id: null, onPath: false};
			
			if(!this._overlaySelex) {
				return overlay;
			}
			
			overlay.onPath = this._overlaySelex._onPath;
			
			var selItem = this._overlaySelex.get("item") || this._overlaySelex.store.query({name: this._overlaySelex.get("value")})[0];
			if(!selItem || selItem.id === SELEX_NONE) {
				return overlay;
			}
			
			overlay.id = selItem.id;
			
			var moduleSet = this._modules.getModulePane(selItem.id);
			if(!moduleSet) {
				return overlay;
			}
			
			var modules = moduleSet.getChildren();
			if(modules.length <= 0) {
				return overlay;
			}
			
			overlay.enabled_modules = [];
			
			DojoArray.forEach(modules,function(module){
				if(module.checked && module.controlType !== OPACITY_CHK) {
					var mod = {id: module.name};
					if(selItem.opaque) {
						var opacity = dijit.byId(module.id+OPACITY_SFX);
						mod.show=(opacity && opacity.checked ? true : false);
					}
					overlay.enabled_modules.push(mod);
				}
			});
					
			// Intensity is always an available value
			overlay.intensity = this._intensitySlider.getValue();
			
			return overlay;
		},
		
		////////////////////////////
		// _buildModulesWidget
		///////////////////////////
		//
		//
		_buildModulesWidget: function(params) {
			var self=this;
			var moduleOnChange = function() {
				self._overlaySelex._onPath = false;
				
				require(["controllers/ActionCollection"],function(ActionCollection){
					ActionCollection[OVERLAY_ACTION](self._buildOverlayObject());
				});
			};
			
			params.moduleOnChange = moduleOnChange;
			params.modelId = self.modelId;
			
			this._modules = new ModulesWidget(params);			
		},
		
		
		///////////////////////////
		// _buildSubWidgets
		//////////////////////////
		//
		//
		_buildSubWidgets: function(params){
			this._buildIntensitySlider({overlayId: params.overlayDefs ? params.overlayDefs.ID : "None"});
			
			this._buildOverlaySelex(params);
			
			this._buildModulesWidget(params);
		},
		
		// Get the preferred height
		prefHeight: function() {
			return PREFERRED_HEIGHT;
		},
		
		
		resize: function(newSize) {
			if(!newSize) {
				newSize = {};
			}
			newSize.h = PREFERRED_HEIGHT;
			this.inherited(arguments);
		},
		
		////////////////////////
		// _buildOverlaySelex
		///////////////////////
		//
		//
		_buildOverlaySelex: function(params) {
			var self=this;
			
			var overlayOnChange = function(e) {
				
				// If the selBox _pathSet is true, then this was a load-triggered onChange in response to a pathing
				// change with no overlay. As a result, we should set pathSet to false because any future onChange
				// is a guarantee to remove us from the path, unless it is also in response a load--in which case,
				// _pathSet will be correct already.
				if(!this._pathSet) {
					this._onPath = false;
				} else {
					this._pathSet = false;
				}				
				
				// Sometimes the store is slow to update the selection box's item attribute
				// during onChange callback; query the store directly in such an instance
				var thisItem = this.item ? this.item : this.store.query({name: e})[0];
				var moduleDefs = (self._overlayDefs[self.modelId] ? self._overlayDefs[self.modelId][thisItem.id] : null);
				
				self._modules.set("overlayId",thisItem.id,{
					intensity: self._intensitySlider.getValue(),
					isOpaque: thisItem.opaque,
					modelId: self.modelId,
					modules: moduleDefs
				});
				
				self._intensitySlider.set("disabled",(e === SELEX_NONE));

				require(["controllers/ActionCollection","controllers/StatesController"],function(ActionCollection,StatesController){
					ActionCollection[OVERLAY_ACTION](self._buildOverlayObject());
					DojoArray.forEach(["MAIN_DRAW_NETWORK_MODULE","MAIN_EDIT_CURR_NETWORK_OVERLAY","MAIN_REMOVE_CURR_NETWORK_OVERLAY"],function(overlayState){
						StatesController.setState(overlayState,(e !== "None"));
					});
				});				
			};
			
			this._overlaySelexPane = new ContentPane({
				id: "overlayselex_pane_" + (params.id || utils.makeId()),
				"class": "OverlaySelexPane"
			});	
			
			this._overlaySelex = new OverlaySelex({onChange: overlayOnChange});	
			
			this._overlaySelexPane.addChild(this._overlaySelex);
		},
		
		
		////////////////////////////
		// _buildIntensitySlider
		////////////////////////////
		//
		//
		_buildIntensitySlider: function(params) {
			var self=this;
			var intensityOnChange = throttle(				
				function(newVal){
					var selItem = self._overlaySelex.get("item") || self._overlaySelex.store.query({name: self._overlaySelex.get("value")})[0];
					DojoArray.forEach(self._modules.getModuleChildren(selItem.id),function(btn){
						if(btn.controlType === OPACITY_CHK) {
							btn.set("disabled",((newVal <= OPACITY_CUTOFF) || !btn.checkControl.checked));
						}
					});
					if(selItem && selItem.opaque) {
						self._modules.updateOpacityBtns(newVal,selItem.opaque);
					}
					require(["controllers/ActionCollection"],function(ActionCollection){
						ActionCollection[OVERLAY_ACTION](self._buildOverlayObject());
					});
				},20
			);
	
			
			this._intensitySliderPane = new ContentPane({
				id: "intensityslider_pane_" + (params.id || utils.makeId()),
				"class": "IntensitySliderPane"
			});					
			
			this._intensitySlider = new BioTapHSlider({
				id: "intensityslider_" + (params.id || utils.makeId()), 
				rulerDecor: "bottomDecoration",
				min: 0,
				max: 1,
				count: 2,
				labels: ["min","max"],
				value: params.intensityVal || 1,
				intermediateChanges: true,
				containerDomNode: self._intensitySliderPane.domNode,
				onChangeAction: intensityOnChange
			});
		},
		
		postCreate: function() {
			
			this.inherited(arguments);
			
			this.addChild(this._overlaySelexPane);
			this.addChild(this._modules);
		    this.addChild(this._intensitySliderPane);
		    
			this._overlaySelex.placeLabel();
			
			this._disablingOverlay = domConstruct.create("div",{id: "disabling_overlay_"+this.id,"class": "DisablingOverlay"},this.domNode,"first");			
		},
		
		startup: function() {
			this._intensitySlider.start(true);
		    domConstruct.create("span",{
		    	id: "label_"+this._intensitySlider.id,
		    	"class": "OverlayLabel OverlayIntensityLabel",
		    	innerHTML: "Intensity"
    		},this._intensitySlider.domNode.parentNode,"first");
			if(this._overlaySelex.get("value") === SELEX_NONE) {
				this._intensitySlider.set("disabled",true);
			}
			this.inherited(arguments);
			this._asyncBuilder.resolve();
		},
		
		applyCurrentOverlay: function() {
			var self=this;
			require(["controllers/ActionCollection"],function(ActionCollection){
				ActionCollection[OVERLAY_ACTION](self._buildOverlayObject());
			});
		},
		
		setProp: function(widg,thisProp,value,args) {
			this[widg] && this[widg].set(thisProp,value,args);
		},
		
		getValue: function(widg) {
			if(this[widg]) {
				return this[widg].get("value");	
			}
			return null;
		},
		
		//////////////
		// setValue
		//////////////
		//
		// Set the "value" of a subwidget
		//
		setValue: function(widg,args) {
			this[widg] && this[widg].set("value",args.value,!args.withoutOnChange);	
		},
		
		////////////////////////////////////
		// setOverlay
		///////////////////////////////////
		//
		// Sets a provided overlay given an object of the format:
		// { 
		// 		id: <id>[, name: <name>], 
		// 		enabled_modules: [{id: <id>[, show: <true|false>]}]
		//		[,revealed_modules: [id]]
		// }
		//
		// revealed_modules can be used to adjust the 'show' variable
		// of disabled modules. if a revealed_module boolean differs
		// from the value in enabled_modules, the value in enabled_modules
		// will supercede it.
		//
		setOverlay: function(overlay,pathSet) {
			var self=this;
			var overlaySetAsync = new Deferred();
			
			// The selection box has to be set by the 'name' of the Overlay,
			// so fetch that out if we didn't receive it
			if(!overlay.name) {
				var selItem = this._overlaySelex.store.query({id: overlay.id})[0];
				if(!selItem) {
					return;
				}
				overlay.name = selItem.name;
			}
			
			this._overlaySelex.set("value",overlay.name);
			
			var mods = this._modules.getModuleChildren(overlay.id);
			
			var enabledMap = {};
			DojoArray.forEach(overlay.enabled_modules,function(mod) {
				enabledMap[mod.id || mod] = {show: mod.show};
			});
			
			var revealedMap;
			DojoArray.forEach(overlay.revealed_modules,function(mod) {
				if(!revealedMap) {
					revealedMap = {};
				}
				revealedMap[mod.id || mod] = 1;
			});
			
			
			DojoArray.forEach(mods,function(module){
				if(module.controlType !== OPACITY_CHK) {
					module.set("checked",!!enabledMap[module.name],false);
					
					var opacity = dijit.byId(module.id+OPACITY_SFX);
					
					// An opacity button cannot be enabled for use if the module is disabled,
					// or the slider is below 50%
					opacity && opacity.set("disabled",!module.get("checked") || (self._intensitySlider.getValue() <= OPACITY_CUTOFF));
					
					if(opacity) {
						opacity.set("checked",(enabledMap[module.name] && enabledMap[module.name].show),false);
						if(revealedMap && revealedMap[module.name] && (!enabledMap[module.name] || enabledMap[module.name].show === undefined)) {
							opacity.set("checked",true,false);
						}
					}
				}
			});
			this._modules._updateZoomBtnStatus();
			
			require(["controllers/ActionCollection"],function(ActionCollection){
				ActionCollection[OVERLAY_ACTION](self._buildOverlayObject()).then(function(){
					overlaySetAsync.resolve();
				});
			});
			
			return overlaySetAsync.promise;
		},
		
		
		///////////////////////////////////
		// toggleModules
		//////////////////////////////////
		//
		// Toggles modules based on criteria provided in args. Unlike 'setOverlay', this method sets the
		// new overlay and module states based on the current state, where-as setOverlay overrides the 
		// state with whatever is supplied.
		//
		toggleModules: function(args) {
			var self=this;
			
			var overlaySetAsync = new Deferred();
			
			var modules = {};
			DojoArray.forEach(args.modules,function(mod){
				modules[mod] = 1;
			});
						
			var overlay = args.overlay || (this._overlaySelex.get("item") ? this._overlaySelex.get("item").id : this._overlaySelex.store.query({name: this._overlaySelex.get("value")})[0].id);
			
			var mods = this._modules.getModuleChildren(overlay);
			
			DojoArray.forEach(mods,function(module){
				if(module.controlType !== OPACITY_CHK) {
					if(args.enable !== "NO_CHANGE") {
						if(modules[module.name]) {
							module.set("checked",args.enable,false);
						} else if(args.enable_other !== "NO_CHANGE") {
							module.set("checked",(args.enable_other === "INVERSE" ? !args.enable : args.enable),false);
						}
					}
					
					var opacity = dijit.byId(module.id+OPACITY_SFX);
					
					// An opacity button cannot be enabled for use if the module is disabled,
					// or the slider is below 50%
					opacity && opacity.set("disabled",!module.get("checked") || (self._intensitySlider.getValue() <= OPACITY_CUTOFF));
					
					if(opacity && args.reveal !== "NO_CHANGE") {
						if(modules[module.name]) {
							opacity.set("checked",(args.reveal === "TOGGLE" ? !opacity.get("checked") : args.reveal),false);	
						} else if(args.reveal_other !== "NO_CHANGE"){
							opacity.set("checked",(args.reveal === "INVERSE" ? !opacity.get("checked") : args.reveal),false);
						}
					}
				}
			});
			
			self._modules._updateZoomBtnStatus();

			require(["controllers/ActionCollection"],function(ActionCollection){
				ActionCollection[OVERLAY_ACTION](self._buildOverlayObject()).then(function(){
					overlaySetAsync.resolve();
				});
			});
			
			return overlaySetAsync.promise;
		},
		
		remove: function() {
			this._modules.remove();
			this._overlaySelex.remove();
			this._intensitySlider.remove();
			
			domConstruct.destroy(this._disablingOverlay);
			
			this._asyncBuilder = null;
			
			this.destroyRecursive();
		},
				
		constructor: function(params){
			var self=this;
			
			this.modelId = params.modelId || "null";
			this.id = "overlaywidget_" + (params.id || Date.now());
			this["class"] = "OverlayWidgetPane";
			this._asyncBuilder = new Deferred();
			this.region = "center";
			
			if(params.overlayDefs) {
				this._overlayDefs = {};
				this._overlayDefs[self.modelId] = {};
				DojoArray.forEach(params.overlayDefs,function(def){
					self._overlayDefs[self.modelId][def.ID] = def;
				});
			}
			
			this._buildSubWidgets(params);
			
			this.inherited(arguments);
		}
		
	});
	
	
});
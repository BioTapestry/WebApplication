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
	"dijit/layout/ContentPane",
	"dijit/form/ComboBox",
	"dojo/store/Memory",
	"dojo/Deferred",
	"dojo/throttle",
	"dojo/debounce",
	"dijit/form/Button",
    "dijit/form/HorizontalSlider",
    "dijit/form/HorizontalRule",
    "dijit/form/HorizontalRuleLabels",
    "dijit/form/CheckBox",
    "dijit/form/RadioButton",
    "dojo/dom-construct",
    "dojo/dom-style",
    "dojo/dom",
    "dojo/on",
    "dojo/_base/declare",
    "dojo/_base/array",
    "dijit",
    "app/utils",
    "dojo/domReady!"
],function(
	ContentPane,
	Select,
	Memory,
	Deferred,
	throttle,
	debounce,
	Button,
	HSlider,
	HRuler,
	HRulerLabels,
	CheckBox,
	RadioButton,
	domConstruct,
	domStyle,
	dom,
	on,
	declare,
	DojoArray,
	dijit,
	utils
) {
	
	// Action to run when Overlay control values change
	var OVERLAY_ACTION = "CLIENT_SET_OVERLAY";
	
	// Default value of the selection box, also the 'empty' or
	// 'no overlay' value
	var SELEX_NONE = "None";

	// Opacity radio button ID
	var OPACITY_BTN = "opacity";
	var OPACITY_SFX = "_opacity";
	
	var ALLCLEAR_BTN_ACTION = "AC";
	var SHOWHIDE_BTN_ACTION = "SH";
	
	// Slider variables
	var slider_,sliderNodeId,sliderRuler,sliderValues,sliderPane_;
	var min,max,count,value,onchangeEvent;
	
	// Select variables
	var selectPane_;
	var selectionBox_;
	var selectData_ = {};
	var selectState_ = {};
	
	// Modules variables
	var checkBoxPanes_ = {};
	var modulesPane_;
	
	// Buttons variables
	var buttonsPane_;
	var buttons_;
	var opacityButtons_;
	var zoomBtn_;
	
	// Disabling DOM element
	var disablingOverlay_;
		
	// Widget consts
	var PREFERRED_HEIGHT = 210;
	var DEFAULT_REGION = "center";
	
	// The main content pane for the overlay module
	var mainPane_ = null;
	
	// Simple booleans for querying the state of the overlay module
	var enabled_ = false;
	var loaded_ = false;
	
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
	function buildOverlayObject_() {

		var overlay = {id: null, onPath: false};
		
		if(!selectionBox_) {
			return overlay;
		}
		
		overlay.onPath = selectionBox_.onPath_;
		
		var selItem = selectionBox_.get("item") || selectionBox_.store.query({name: selectionBox_.get("value")})[0];
		if(!selItem || selItem.id === SELEX_NONE) {
			return overlay;
		}
		
		overlay.id = selItem.id;
		
		var moduleSet = checkBoxPanes_[selItem.id];
		if(!moduleSet) {
			return overlay;
		}
		
		var modules = moduleSet.getChildren();
		if(modules.length <= 0) {
			return overlay;
		}
		
		overlay.enabled_modules = [];
		
		DojoArray.forEach(modules,function(module){
			if(module.checked && module.controlType !== OPACITY_BTN) {
				var opacity = dijit.byId(module.id+OPACITY_SFX);
				var mod = {id: module.name};
				if(selItem.opaque) {
					mod.show=(opacity && opacity.checked ? true : false);
				}
				overlay.enabled_modules.push(mod);
			}
		});
				
		// Intensity is always an available value
		overlay.intensity = slider_.get("value");
		
		return overlay;
	};
	
	
	///////////////////////////////
	// startSlider_
	///////////////////////////////
	//
	// Run widget.startup() on the components of the TimeSlider; this will build and render them
	//
	function startSlider_() {
		
	    slider_ = new HSlider({
	        name: "slider_widget_" + utils.makeId(),
		    minimum: min,
	        maximum: max,
	        value: value,
	        intermediateChanges: true,
	        onChange: onchangeEvent
	    },sliderNodeId);			
	    slider_ && slider_.startup();
	    sliderValues && sliderValues.startup();
	    sliderRuler && sliderRuler.startup();
	    
	    // Add a debounce call which is delayed out past the main throttled event, such that it will will ensure
	    // the onchange throttler doesn't prevent final values from being managed
	    slider_.own(on(slider_,"change",debounce(onchangeEvent,75)));
	    
	    enabled_ = true;
	};
	
	//////////////////////////////
	// buildSlider_
	//////////////////////////////
	// 
	// Builds the TimeSlider widget. Its value is persistent across models. onChange firing is throttled at
	// 0.2s to prevent excessive draw delay.
	//
	function buildSlider_(params) {
		min = 0.0;
		max = 1;
		value = 1;
		
		onchangeEvent = throttle(
			function(newVal){
				var selItem = selectionBox_.get("item") || selectionBox_.store.query({name: selectionBox_.get("value")})[0];
				DojoArray.forEach(checkBoxPanes_[selItem.id].getChildren(),function(btn){
					if(btn.controlType === OPACITY_BTN) {
						btn.set("disabled",((newVal <= 0.5) || !btn.checkControl.checked));
					}
				});
				if(selItem && selItem.opaque) {
					DojoArray.forEach(opacityButtons_,function(btn){
						btn.set("disabled",(newVal <= 0.5));
					});
				}
				require(["controllers/ActionCollection"],function(ActionCollection){
					ActionCollection[OVERLAY_ACTION](buildOverlayObject_());
				});
			},20);
		
		var region = (params && params.region) ? params.region : DEFAULT_REGION;			
		
		if(!sliderPane_) {
			sliderPane_ = new ContentPane({
				id: "intensity_slider_pane",
				region: region
			});
		}
		
		sliderNodeId = "slider_" + utils.makeId();
					
		var sliderNode = domConstruct.create("div",{id: sliderNodeId},sliderPane_.domNode,"first");
					
		var rulerNode = domConstruct.create("div",{},sliderNode,"first");
		sliderRuler = new HRuler({
	    	container: "bottomDecoration",
	    	count: 2,
	    	ruleStyle: "height: 5px;"
		},rulerNode);
		
	    var rulerValuesNode = domConstruct.create("div",{},sliderNode,"last");
	    sliderValues = new HRulerLabels({
	    	container: "bottomDecoration",
	    	labels: ["min","max"],
	    	style: "height: 10px; font-size: 0.6em;"
	    },rulerValuesNode);
	    	    
	    mainPane_.addChild(sliderPane_);
	    
	    domConstruct.create("span",{id: "intensity_slider_label",innerHTML: "Intensity"},sliderPane_.domNode,"first");
	};
	
	/////////////////////////////
	// buildSelect_
	////////////////////////////
	//
	// The select box is not swapped out between models, so its state is stored in the selectState_ map, and its stores
	// are held in the selectData_ map. Both are keyed on the model ID.
	//
	function buildSelect_(params) {
		
		var startView = SELEX_NONE;
		var model = params ? params.modelId : "null";

		if(!selectData_[model]) {
			var data = [{id: SELEX_NONE, name: SELEX_NONE}];
			if(params) {
				for(var i in params.defs) {
					if(params.defs.hasOwnProperty(i)) {
						if(params.defs[i].isStartView) {
							startView = params.defs[i].name;
						}
						data.push({id: params.defs[i].ID, name: params.defs[i].name, opaque: params.defs[i].isOpaque});
						buildModuleChecks_(params.defs[i],model);
					}
				}
			}
			selectData_[model] = new Memory({data: data, idProperty: "id"});
		}
		
		if(!selectionBox_) {
			selectionBox_ = new Select({
				onPath_: false,
				store: selectData_[model],
				style: "width: 100px;",
				labelAttr: "name",
				onChange: function(e) {
					
					// If the selBox pathSet_ is true, then this was a load-triggered onChange in response to a pathing
					// change with no overlay. As a result, we should set pathSet to false because any future onChange
					// is a guarantee to remove us from the path, unless it is also in response a load--in which case,
					// pathSet_ will be correct already.
					if(!this.pathSet_) {
						this.onPath_ = false;
					} else {
						this.pathSet_ = false;
					}
					
					modulesPane_.removeChild(modulesPane_.getChildren()[0]);

					// Sometimes the store is slow to update the selection box's item attribute
					// during onChange callback; query the store directly in such an instance
					var thisItem = this.item ? this.item : this.store.query({name: e})[0];
					
					modulesPane_.addChild(checkBoxPanes_[thisItem.id]);
					toggleControlsForNone_((e === SELEX_NONE));
					
					if(thisItem && thisItem.opaque) {
						DojoArray.forEach(opacityButtons_,function(btn){
							domStyle.set(btn.domNode,"display","block");
							btn.set("disabled",(slider_.value <= 0.5));
						});
					} else {
						DojoArray.forEach(opacityButtons_,function(btn){
							domStyle.set(btn.domNode,"display","none");
						});						
					}
					
					updateZoomBtnStatus_();
					
					require(["controllers/ActionCollection"],function(ActionCollection){
						ActionCollection[OVERLAY_ACTION](buildOverlayObject_());
					});
				},
				modelId: model
			});		
			
			selectionBox_.textbox.readOnly = true;
			selectState_[model] = startView;
			selectionBox_.set("value",startView);
		}
		selectionBox_.pathSet_ = params ? params.pathSet : false;
		
		if(selectionBox_.modelId !== model) {
			selectState_[selectionBox_.modelId] = selectionBox_.get("value");
			// If the current value of the selectionBox_ from its old data store happens
			// to be the same as the value for the new one, the onChange won't trigger,
			// so we clear out the current value to force an onChange to happen.
			selectionBox_.set("value","",false);
			selectionBox_.set("store",selectData_[model]);
			selectionBox_.set("modelId",model);
			if(!selectState_[model]) {
				selectState_[model] = startView;
			}
			
			selectionBox_.set("value",selectState_[model]);
		}
						
		if(!selectPane_) {
			selectPane_ = new ContentPane({
				id: "overlay_select_pane"
			});
			
			selectPane_.addChild(selectionBox_);
		    mainPane_.addChild(selectPane_,0);
		    domConstruct.create("span",{id: "overlay_selection_label",innerHTML: "Overlay:"},selectionBox_.domNode,"before");
		}
	};
	
	//////////////////////////////////////
	// buildModules_
	/////////////////////////////////////
	//
	// Creates the content pane which will hold modules checkbox panes, and an empty/blank ContentPane 
	// for default modules checkboxes (i.e. when the selectionBox_ value is SELEX_NONE)
	//
	function buildModules_() {
		modulesPane_ = new ContentPane({
			id: "modules_pane"
		});
		domConstruct.create("span",{innerHTML: "View Modules",style: "font-weight: bold;"},modulesPane_.domNode,"first");
		mainPane_.addChild(modulesPane_);
		
		checkBoxPanes_[SELEX_NONE] = new ContentPane({
			id: "module_checkboxes_pane_empty"
		});
		modulesPane_.addChild(checkBoxPanes_[SELEX_NONE]);
	};
	
	
	//////////////////////////////
	// buildModuleChecks_
	///////////////////////////////
	//
	// The Modules checkbox pane holds a pane of checkboxes (and if an overlay is opaque, radio buttons), which are 
	// keyed by the model ID in a map. This allows for easy swap out when the model is changed, and stores their state.
	//
	function buildModuleChecks_(params,modelId) {
		if(params && !checkBoxPanes_[params.ID]){
			var checkBoxPane = new ContentPane({
				id: "module_checkboxes_pane_" + params.ID,
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
					value: {moduleId: module.ID,overlayId: params.ID,modelId: modelId},
					onChange: function(e) {
						selectionBox_.onPath_ = false;
						updateZoomBtnStatus_();
						require(["controllers/ActionCollection"],function(ActionCollection){
							ActionCollection[OVERLAY_ACTION](buildOverlayObject_());
						});						
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
						value: {moduleId: module.ID,overlayId: params.ID,modelId: modelId, name: module.name+OPACITY_SFX},
						"class": "CheckBoxRadio",
						onChange: function(e) { 
							selectionBox_.onPath_ = false;
							require(["controllers/ActionCollection"],function(ActionCollection){
								ActionCollection[OVERLAY_ACTION](buildOverlayObject_());
							});
						},
						style: "float: left; padding-top: 5px;"
					});
					thisRadio.set("disabled",!(thisCheck.checked));
					thisRadio.placeAt(checkContainer);
					placeLabel = thisRadio;
				}
				
				thisCheck.own(on(thisCheck,"change",function(val){
					thisRadio && thisRadio.set("disabled",!val || (slider_.value <= 0.5));
				}));
				
				domConstruct.create("label",{"for": containerId, innerHTML: module.ID,"class":"ModuleCheckLabel"},placeLabel.domNode,"after");
			});
			
			checkBoxPanes_[params.ID] = checkBoxPane;
		}		
	};
	
	function _moduleBtnAction(type,checked) {
		var selItem = selectionBox_.get("item") || selectionBox_.store.query({name: selectionBox_.get("value")})[0];
		var somethingChanged = false;
		DojoArray.forEach(checkBoxPanes_[selItem.id].getChildren(),function(child){
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
					child.set("disabled",!checked || (slider_.value <= 0.5));
				} else if(type === SHOWHIDE_BTN_ACTION) {
					if(child.checked !== checked) {
						somethingChanged = true;	
					}
					!child.disabled && child.set("checked",checked,false);
				}
			}
		});
		if(somethingChanged) {
			require(["controllers/ActionCollection"],function(ActionCollection){
				ActionCollection[OVERLAY_ACTION](buildOverlayObject_());
			});
		}
		if(type === ALLCLEAR_BTN_ACTION) {
			zoomBtn_.set("disabled",!checked);	
		}
	};
	
	///////////////////////////////////////
	// buildButtons_
	////////////////////////////////////////
	//
	// The show and hide buttons are only relevant in an opaque overlay, and are hidden/disabled 
	// based on the opacity radio button (see Module Checkboxes) and slider value (<= 0.5).
	//
	function buildButtons_(isOpacity) {
		buttonsPane_ = new ContentPane({
			id: "overlay_buttons_pane"
		});
		
		var MINIRIGHT = "MiniButton RightHand";
		
		var showBtn = new Button({
			id: "overlay_show_btn",
			label: "Show",
			onClick: function(e) {
				_moduleBtnAction(SHOWHIDE_BTN_ACTION,true);
			},
			"class": MINIRIGHT
		});
		
		var hideBtn = new Button({
			id: "overlay_hide_btn",
			label: "Hide",
			onClick: function(e) {
				_moduleBtnAction(SHOWHIDE_BTN_ACTION,false);
			},
			"class": MINIRIGHT
		});	
		
		zoomBtn_ = new Button({
			id: "overlay_zoom_btn",
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
			id: "overlay_all_btn",
			label: "All",
			onClick: function(e) {
				_moduleBtnAction(ALLCLEAR_BTN_ACTION,true);	
			},
			"class": MINIRIGHT
		});
		
		var clearBtn = new Button({
			id: "overlay_clr_btn",
			label: "Clear",
			onClick: function(e) {
				_moduleBtnAction(ALLCLEAR_BTN_ACTION,false);
			},
			"class": MINIRIGHT
		});
		
		buttons_ = [allBtn,clearBtn];
		
		buttonsPane_.addChild(zoomBtn_);
		buttonsPane_.addChild(clearBtn);
		buttonsPane_.addChild(hideBtn);
		buttonsPane_.addChild(showBtn);
		buttonsPane_.addChild(allBtn);
		
		opacityButtons_ = [showBtn,hideBtn];

		mainPane_.addChild(buttonsPane_);
	};
	
	function updateZoomBtnStatus_() {
		var selItem = selectionBox_.get("item") || selectionBox_.store.query({name: selectionBox_.get("value")})[0];
		var moduleSet = checkBoxPanes_[selItem.id];
		var modules = moduleSet.getChildren();
		var zoomEnabled = false;
		DojoArray.forEach(modules,function(module){
			if(module.controlType !== OPACITY_BTN) {
				zoomEnabled = zoomEnabled || module.checked || false;
			}
		});	
		zoomBtn_.set("disabled",!zoomEnabled);
	};
	
	
	////////////////////////////////////
	// toggleControlsForNone_
	//////////////////////////////////
	//
	// 'None' is a special value in the selection box which disables controls but does not
	// activate the disabling overlay (this is only activated when the whole overlay panel
	// is disabled). 
	//
	function toggleControlsForNone_(disable) {
		DojoArray.forEach(buttons_,function(btn){btn.set("disabled",disable);});
		modulesPane_ && modulesPane_.set("disabled",disable);
		slider_ && slider_.set("disabled",disable);
	};
	
	/////////////////////////////////////////
	// toggleControls_
	/////////////////////////////////////////
	//
	// Change the disabled state of the Overlay widget and all contained controls
	// (unlike toggleControlsForNone_, this will also unhide the disablingOverlay)
	//
	function toggleControls_(isDisabled) {
		selectionBox_.set("disabled",isDisabled);
		toggleControlsForNone_(isDisabled || (selectionBox_.value === SELEX_NONE));
	};
	
	////////////////////////////////////////
	// getOverlayModules_
	///////////////////////////////////////
	//
	// Given an overlay name, returns the complete module checkbox and radio
	// button set. Defaults to changing the current selection box value
	// unless otherwise specified
	//
	function getOverlayModules_(overlayName,noSet) {
		if(!selectionBox_) {
			return null;
		}
				
		if(!overlayName) {
			overlayName = selectionBox_.get("value");
		}
		
		if(selectionBox_.get("value") !== overlayName && !noSet) {
			selectionBox_.set("value",overlayName);
		}
		var overlayItem = selectionBox_.store.query({name: overlayName})[0];
		
		var moduleSet = checkBoxPanes_[overlayItem.id];
		if(!moduleSet) {
			return null;
		}
		
		var mods = moduleSet.getChildren();
		if(mods.length <= 0) {
			return null;
		}
		return mods;
	};
	
	
	return {
		
		// There are two uses for disable: disabling when there *isn't* a valid overlay, 
		// and disabling even when there is. In the former case, we need to switch 
		// everything to a null state; in the later, we leave it untouched but disable it. 
		// buildSelect_ will have no effect if the overlay is already in a valid state for
		// this model, but if it is not it will set it to a proper setting first, which in 
		// the case of a model with no valid overlays means it will blank everything out 
		// and set the selectionBox_ state to SELEX_NONE.
		//
		// Args may be provided if, for example, this disabling is part of a path movement
		disable: function(args) {
			domStyle.set(disablingOverlay_,"display","block");
			buildSelect_(args);
			toggleControls_(true);
			enabled_ = false;
		},
		
		// Hides the disabling overlay and enables all valid controls. This does
		// not set any values, only turns the controls on!
		enable: function() {
			domStyle.set(disablingOverlay_,"display","none");
			toggleControls_(false);
			enabled_ = true;
		},
		
		// Builds the various components of the overlay if needed and sets the
		// selection box to the last valid value, or a default value of SELEX_NONE
		// if no last valid values is found
		load: function(params) {
		
			if(!mainPane_) {
				mainPane_ = new ContentPane({
					id: "overlay_pane",
					region: "center"
				});
			}
			
			!modulesPane_ && buildModules_();		
			buildSelect_(params);
			!buttonsPane_ && buildButtons_();
			!sliderPane_ && buildSlider_(params);
						
			if(!disablingOverlay_) {
				disablingOverlay_ = domConstruct.create("div",
					{
						id: "overlay_pane_disabling",
						style: "display: none;",
						"class": "DisablingOverlay"
					},mainPane_.domNode,"first"
				);
			} else {
				domStyle.set(disablingOverlay_,"display","none");
			}
			
		    enabled_ = true;
		    loaded_ = true;
		    
		    toggleControlsForNone_(selectionBox_.value === SELEX_NONE);

		    return mainPane_;
		},
		
		// Destroys the controls via destroyRecursive and nulls out all references
		remove: function() {

			// CheckBox Panes might not be on mainPane_ at the time we're removing, so have
			// to be destroyed manually.
			DojoArray.forEach(Object.keys(checkBoxPanes_),function(pane){
				checkBoxPanes_[pane].destroyRecursive();
			});
			checkBoxPanes_ = {}
			
			// Destroy recursive will mark the objects for destruction by Dojo but we have to do
			// the references ourselves!			
			slider_ = null,sliderNodeId = null,sliderRuler = null,sliderValues = null,sliderPane_ = null;
			selectionBox_ = null,selectData_ = {},selectPane_ = null;
			modulesPane_ = null;
			buttonsPane_ = null;
			disablingOverlay_ = null;
			
			// All other widgets are children of mainPane_ so will get destroyed here
			mainPane_.destroyRecursive();
			mainPane_ = null;
			
			enabled_ = false;
			loaded_ = false;
		},
		
		// Is this module enabled? (Overlay pane is available for user interaction)
		isEnabled: function() {
			return enabled_;
		},
		
		// Is this module loaded? (Modules instantiated and loaded with data)
		isLoaded: function() {
			return loaded_;
		},
		
		// Get the preferred height
		prefHeight: function() {
			return PREFERRED_HEIGHT;
		},
		
		// Resize the mainPane_
		resize: function(newSize) {
			if(!newSize) {
				newSize = {h: PREFERRED_HEIGHT};
			}
			mainPane_.resize(newSize);
		},
		
		// Set the value of the selection box
		setValue: function(args) {
			selectionBox_.set("value",args.val ? args.val : SELEX_NONE);
		},
		
		setProperty: function(key,val) {
			selectionBox_ && selectionBox_.set(key,val);
		},
		
		applyCurrentOverlay: function() {
			require(["controllers/ActionCollection"],function(ActionCollection){
				ActionCollection[OVERLAY_ACTION](buildOverlayObject_());
			});
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
			var overlaySetAsync = new Deferred();
			
			if(!overlay.name) {
				var selItem = selectionBox_.store.query({id: overlay.id})[0];
				if(!selItem) {
					return;
				}
				overlay.name = selItem.name;
			}
			
			var mods = getOverlayModules_(overlay.name);
			
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
				if(module.controlType !== OPACITY_BTN) {
					module.set("checked",!!enabledMap[module.name],false);
					
					var opacity = dijit.byId(module.id+OPACITY_SFX);
					
					// An opacity button cannot be enabled for use if the module is disabled,
					// or the slider is below 50%
					opacity && opacity.set("disabled",!module.get("checked") || (slider_.value <= 0.5));
					
					if(opacity) {
						opacity.set("checked",(enabledMap[module.name] && enabledMap[module.name].show),false);
						if(revealedMap && revealedMap[module.name] && (!enabledMap[module.name] || enabledMap[module.name].show === undefined)) {
							opacity.set("checked",true,false);
						}
					}
				}
			});
			updateZoomBtnStatus_();
			
			require(["controllers/ActionCollection"],function(ActionCollection){
				ActionCollection[OVERLAY_ACTION](buildOverlayObject_()).then(function(){
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
		// new overlay and module states based on the current state, where-as setOverlay
		// overrides the state with whatever is supplied.
		//
		toggleModules: function(args) {
			var overlaySetAsync = new Deferred();
			
			var modules = {};
			DojoArray.forEach(args.modules,function(mod){
				modules[mod] = 1;
			});
						
			var mods = getOverlayModules_(args.overlay);
			
			DojoArray.forEach(mods,function(module){
				if(module.controlType !== OPACITY_BTN) {
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
					opacity && opacity.set("disabled",!module.get("checked") || (slider_.value <= 0.5));
					
					if(opacity && args.reveal !== "NO_CHANGE") {
						if(modules[module.name]) {
							opacity.set("checked",(args.reveal === "TOGGLE" ? !opacity.get("checked") : args.reveal),false);	
						} else if(args.reveal_other !== "NO_CHANGE"){
							opacity.set("checked",(args.reveal === "INVERSE" ? !opacity.get("checked") : args.reveal),false);
						}
					}
				}
				updateZoomBtnStatus_();
			});

			require(["controllers/ActionCollection"],function(ActionCollection){
				ActionCollection[OVERLAY_ACTION](buildOverlayObject_()).then(function(){
					overlaySetAsync.resolve();
				});
			});
			
			return overlaySetAsync.promise;
		},
		
		// Set the value of the intensity slider (this will trigger any watch callbacks!)
		setIntensity: function(val) {
			slider_ && slider_.set("value",val);
		},
		
		// Delayed startups go here
		start: function() {
			if(!slider_) {
				startSlider_();
			}
			toggleControlsForNone_(selectionBox_.value === SELEX_NONE);
		}
	};	
});
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

define([
    "dojo/_base/declare",
    "dijit/Toolbar",
    "dijit/form/Button",
    "dijit/form/ToggleButton",
    "dijit/ToolbarSeparator",
    "dojo/_base/array",
    "dojo/Deferred",
    "dojo/store/Memory",
    "dijit/form/ComboBox",
    "dojo/request",
    "dojo/on",
    "models/conditions/ActionConditions",
    "controllers/StatesController",
    "controllers/ActionCollection",
    "static/XhrUris",
    "static/IconMap",
    "app"
],function(
	declare,
	Toolbar,
	Button,
	ToggleButton,
	ToolbarSeparator,
	DojoArray,
	Deferred,
	Memory,
	ComboBox,
	request,
	on,
	Conditions,
	StatesController,
	ActionCollection,
	XhrUris,
	IconSet,
	appMain
) {
	
	return declare([],{
		
		placeHolders_: null,
		
	    updatePlaceHolders: function(comboFills) {
	    	for(var i in comboFills) {
	    		if(comboFills.hasOwnProperty(i)) {
	    			if(this.placeHolders_[i]) {
	    				if(comboFills[i].items_ && comboFills[i].items_.length > 0) {
	    					this.placeHolders_[i].set("disabled",false);
	    					var items = [];
	    					
	    					DojoArray.forEach(comboFills[i].items_,function(item){
	    						items.push({label: item.name, id: item.name, key: item.key, keyType: item.keyType, uri: item.actionArgAsURLArgs});
	    					});
	    						    					
	    					var dataStore = new Memory({
	    						data: items
	    					});
	    					
	    					this.placeHolders_[i].set("value",StatesController.getState(this.placeHolders_[i].name,ActionCollection.GET_CURRENT_TAB()) || comboFills[i].items_[0].name,false);
	    					this.placeHolders_[i].set("store",dataStore);
	    				} else {
	    					this.placeHolders_[i].set("disabled",true);
	    				}		    				
	    			}
	    		}
	    	}
	    },
		
		// Constructor for a BioTaprstry Toolbar
		constructor: function() {
						
			/////////////////// PRIVATE MEMBERS /////////////////// 
			
			var myToolbarContents = null;
			
			var myToolbar = new Toolbar({
				id: "toolbar_widget"
			});

			// Our accessibility key for the Toolbar is t
        	myToolbar.own(
    			on(window, "keypress", function(e){
    				require(["dialogs"],function(BTDialogs){
    					if(!BTDialogs.checkForRegisteredModals()) {
	                		var keyPressed = String.fromCharCode(e.charCode || e.keyCode || e.which);
	                		if(keyPressed == "t") {
	                			myToolbar.focus();
	            				e.preventDefault();
	            				e.stopPropagation();
	                		}
    					}
    				});
    			})
        	);	
        					
        	this.placeHolders_ = {};
        	
			// Any time these conditions change, update our bar
			
			DojoArray.forEach(["SHOW_PATH","DO_GAGGLE","SHOW_OVERLAY"],function(item) {
				myToolbar.own(Conditions.watch(item,function(name,oldVal,newVal){
					rebuildToolbar_();
				}));					
			});
			
			function rebuildToolbar_() {
				// first, empty the toolbar of all of its buttons
				if(myToolbar.hasChildren()) {
					DojoArray.forEach(myToolbar.getChildren(),function(btn){
						myToolbar.removeChild(btn);
					});
				}
				
				// Now go through our button collection, adding those
				// whose conditions are met
				
				DojoArray.forEach(myToolbarContents,function(tbItem){
					if(tbItem.condition) {
						if(Conditions.get(tbItem.condition)) {
							myToolbar.addChild(tbItem);
						}
					} else {
						myToolbar.addChild(tbItem);
					}
				});	
			};
			
			// Split up the incoming icon name into 3 components:
			// 1: The icon name
			// 2: The icon size
			// 3: (optional) The statename for the icon (eg. Selected, Unselected)
			//
			// The iconClass CSS for a button is as follows:
			// icon-size-CSS-class icon-set-and-size-CSS-class specific-icon-CSS-class
			//
			// eg. BioTapestryIcon32 GeneralIcons32 GeneralIcons32Save
			//
			// The size class determines the icon's display area, the set determines the
			// sprite sheet to use, and the specific icon class defines how far over to
			// shift the sheet so the right icon displays. See BioTapestryIcons.css
			function buildIconClass_(item) {
				var iconClassString;
				if(item.icon) {
					var actionIconArray = /([A-Za-z]+)([0-9]+)([A-Za-z]+)?\./g.exec(item.icon);
					var actionIcon = actionIconArray[1] + (actionIconArray[3] || "");
					var iconSet = IconSet[actionIcon];
					var iconSize = actionIconArray[2];
					iconClassString = "BioTapestryIcons" + iconSize + " " 
						+ iconSet + iconSize + " " 
						+ iconSet + iconSize + actionIcon;
				}
				return iconClassString;
			};
			
			
			// Update the enabled/disabled/clicked status of the toolbar's buttons
			function updateButtonStates_(states) {
				require(["controllers/StatesController"],function(StatesController){
					StatesController.updateItemStates(myToolbarContents,states);					
				});
			};
																		
			////////////////// PRIVILEGED MEMBERS //////////////////
			
			this.loadButtons = function() {
				var loadAsync = new Deferred();
				var self=this;
				
				request(XhrUris.toolbar).then(function(data){
					var buttonSet = JSON.parse(data).actions_;
					
					if(myToolbarContents) {
						DojoArray.forEach(myToolbarContents,function(btn){
							btn.destroyRecursive();
						});
					}
					
					myToolbarContents = new Array();
					
					DojoArray.forEach(buttonSet,function(item) {
						var toolbarItem;
						
						// If this button has an icon, generate an icon CSS class string for it.
						var iconClassString = buildIconClass_(item);
						
						switch(item.type) {
							case "SEPARATOR":
								toolbarItem = new ToolbarSeparator();	
								break;
							case "ACTION":
								toolbarItem = new Button({
									showLabel: false,
									label: item.desc,
									name: item.name,
									onClick: (
										ActionCollection[item.keyType + "_" + item.key] || 
					    				function(e){console.debug("No Action available for onClick of " + item.desc + ": " + item.keyType + "_" + item.key);}
					    			),
									typeAndKey: item.keyType + "_" + item.key
								});
								break;
							case "MENU_PLACEHOLDER":
								toolbarItem = new ComboBox({
									id: item.tag,
									name: item.tag,
									store: new Memory({
										data: []
									}),
									searchAttr: "label",
									condition: item.condition,
									typeAndKey: null,
									onChange: function(e) {
										var thisItem = this.item ? this.item : this.store.query({id: e})[0];
										if(thisItem) {
											ActionCollection[thisItem.keyType + "_" + thisItem.key]({value: e, item: thisItem, tag: item.tag});	
										} else  {
											console.warn("Could not find combo box item " + e + " for combo box " + item.tag + "!");	
										}
									}
								});	
								toolbarItem.textbox.readOnly = true;
								self.placeHolders_[item.tag] = toolbarItem;
								break;
							case "CHECKBOX_ACTION": 
								toolbarItem = new ToggleButton({
									showLabel: false,
									checked: false,
									onChange: (
										ActionCollection[item.keyType + "_" + item.key] || 
								    	function(val){console.warn("No Action available for onClick of " + item.desc + ": " + item.keyType + "_" + item.key);}
								    ),
									label: item.desc,
									name: item.name,
									desc: item.desc,
									typeAndKey: item.keyType + "_" + item.key
								});
								break;
						}
						
						if(toolbarItem) {
							if(iconClassString) {
								toolbarItem.set("iconClass",iconClassString);
							} else {
								toolbarItem.set("showLabel",true);
							}
							if(item.condition) {
								toolbarItem.set("condition",item.condition);
							}
							myToolbarContents.push(toolbarItem);
														
							require(["controllers/StatesController"],function(StatesController){
								if(toolbarItem.typeAndKey && StatesController.stateIsLocal(toolbarItem.typeAndKey)) {
									myToolbar.own(
										StatesController.setStateWatch(toolbarItem.typeAndKey,function(){
											updateButtonStates_();
										})
									);
								}
							});
						}
					});
					
					// Inject the Bindings toolbar button
					myToolbarContents.push(new Button({
						showLabel: false,
						label: "Bindings",
						name: "Keyboard and Mouse Bindings",
						id: "keymap_btn",
						iconClass: "BioTapestryIcons24 BioTapIcons724 BioTapIcons724Keybinds",
						onClick: ActionCollection.CLIENT_KEYMAP,
						typeAndKey: "CLIENT_KEYMAP"
					}));

					
					if(myToolbarContents) {
						rebuildToolbar_();
						myToolbar.startup();
					}
					
					loadAsync.resolve(myToolbarContents);	
				});
				
				return loadAsync.promise;
			};			
			

			this.getToolbar = function() {
				return myToolbar;
			};
			
			this.updateToolbarState = function(flowStates,conditionalStates) {
				updateButtonStates_(flowStates);
				Conditions.applyStates(conditionalStates);
			};	
		}
	});
});
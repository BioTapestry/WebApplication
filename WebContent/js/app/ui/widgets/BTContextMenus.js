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
    "dijit/focus",
    "dijit/Menu",
    "dijit/MenuItem",
    "dijit/CheckedMenuItem",
    "dijit/PopupMenuItem",
    "dijit/MenuSeparator",
    "dojo/_base/array",
    "controllers/ActionCollection",
    "controllers/XhrController",
    "models/conditions/ActionConditions",
    "static/XhrUris",
    "models/ClientState",
    "app/utils"
],function(
	focusUtil,
	Menu, 
	MenuItem,
	CheckedMenuItem,
	PopupMenuItem,
	MenuSeparator,
	DojoArray,
	ActionCollection,
	XhrController,
	ActionConditions,
	XhrUris,
	ClientState,
	utils
) {
		
	var modelToStatesMap = {};
	
	var HIT_TO_NODE_TYPE = {
		"gene":"GENE",
		"linkage":"LINK",
		"tablet":"NODE",
		"intercell":"NODE",
		"slash":"NODE",
		"box":"NODE",
		"bare":"NODE",
		" ":"LINK_POINT", 
		"note": "NOTE", 
		"group": "REGION", 
		" ": "OVERLAY", 
		"net_module": "MODULE", 
		" ": "MODULE_LINK", 
		" ": "MODULE_LINK_POINT"
	};
	
	var availableContextMenus_ = {
			
	};
	
	
	//List of context menu references (each context menu exists only once) 
	var contextMenuList_ = {
		canvas: null,
		modeltree: null
	};
	
	// Tracker boolean for an active context menu, so we can manage problems with
	// menus not closing in Linux and OSX
	var contextMenuIsActive_ = false;
	
    function _updateMenuItemStates(states,thisMenu) {
    	if(contextMenuList_[thisMenu]) {
	    	require(["controllers/StatesController"],function(StatesController){
				StatesController.updateItemStates(contextMenuList_[thisMenu].getChildren(),states);					
			});
    	}
    };
    
/////////////////////////////////////////////////////
// Module Interface
////////////////////////////////////////////////////
	
	return {
			
		buildContextMenu: function(thisMenu,params,menuItems,destroyOnBuild) {
			if(contextMenuList_[thisMenu] && destroyOnBuild){
				this.destroyContextMenu(thisMenu);
			}
			contextMenuList_[thisMenu] = new Menu(params);
			DojoArray.forEach(menuItems,function(item){
				contextMenuList_[thisMenu].addChild(item);
			});
			
			require(["dojo/on"],function(on){
				contextMenuList_[thisMenu].own(on(contextMenuList_[thisMenu],"blur",function(){
					contextMenuIsActive_ = false;
				}));
				
				contextMenuList_[thisMenu].own(on(contextMenuList_[thisMenu],"focus",function(){
					contextMenuIsActive_ = true;					
				}));
			
				
				// OSX and Linux encounter problems with not focusing the context menu once it's open, which
				// in turn renders it unable to be closed via blurring. For non-Windows operating systems,
				// we attach a series of 3 events to make sure the context menu will close as expected.
				//
				// This is, oddly, not a problem on context menus outside of the Model Tree, so may be somehow
				// related to eventing on dijit.Tree.
				
				if(navigator.platform.indexOf("Win") < 0 && thisMenu === "modeltree") {
					require(["dijit/popup"],function(popup){
						contextMenuList_[thisMenu].own(on(contextMenuList_[thisMenu],"keypress",function(e) {
							if(e.keyCode === 27 && contextMenuList_[thisMenu].isFocusable() && contextMenuIsActive_) {
								popup.close(contextMenuList_[thisMenu]);
								contextMenuIsActive_ = false;
							}					
						}));
						
						contextMenuList_[thisMenu].own(on(window,"keydown",function(e) {
							if(e.keyCode === 27 && contextMenuList_[thisMenu].isFocusable() && contextMenuIsActive_) {
								popup.close(contextMenuList_[thisMenu]);
								contextMenuIsActive_ = false;
							}					
						}));
						
						contextMenuList_[thisMenu].own(on(window,"click",function(e) {
							if(contextMenuIsActive_ && contextMenuList_[thisMenu].isFocusable()) {
								popup.close(contextMenuList_[thisMenu]);
								contextMenuIsActive_ = false;
							}					
						}));
					});
				}
			});		
			
			return contextMenuList_[thisMenu];
			
		},
		
		// Destroy a specified context menu and all of its contents
		destroyContextMenu: function(thisMenu) {
			if(contextMenuList_[thisMenu]) {
				require(["dijit/popup"],function(popup){
					popup.close(contextMenuList_[thisMenu]);
				});
				contextMenuList_[thisMenu].destroyRecursive();
				contextMenuList_[thisMenu] = null;
			}
		},
		
		// Retrieve a context menu from the private object
		getContextMenu: function(thisMenu) {
			return contextMenuList_[thisMenu];
		},
		
		
		///////////////////////////////////
		// addMenuItems
		///////////////////////////////////
		//
		// Add an array of menu items to the specified context menu. 
		// This will create new menu items for each member of menuItems.
		//
		// @param thisMenu String or numeric ID key to the context menu
		// @param menuItems Js object Array of parameter sets for Dijit.MenuItems
		// @returns {Array} of handles to the dijit.MenuItems added to the context menu
		//
		addMenuItems: function(thisMenu,menuItems) {
			var stateItems = [];
			var menuItemHandles = [];
			DojoArray.forEach(menuItems,function(item){
				menuItemHandles.push(this.addSingleItem(thisMenu,item));
				if(item.key.indexOf("TOGGLE") >= 0) {
					stateItems.push(item);
				}
			});
			
			if(stateItems.length > 0) {
				require(["controllers/StatesController"],function(StatesController){
					DojoArray.forEach(stateItems,function(thisState){
						if(StatesController.stateIsLocal(item.keyTyp+"_"+item.key)) {
							StatesController.setState(item.keyType+"_"+(item.key.substring(0,item.key.indexOf("_TOGGLE"))),item.isChecked);
						}
					});
				});
			}
			return menuItemHandles;
		},
		
		////////////////////////////////
		// addSingleItem
		////////////////////////////////
		//
		// Add a single item to a context menu and return a reference to it
		// @param thisMenu String or numeric ID key to the context menu
		// @param menuItem Js object matching the parameter set for a Dijit.MenuItem
		// @returns {MenuItem} A reference to the Dijit.MenuItem which was made
		// and added to the context menu
		//
		addSingleItem: function(thisMenu,menuItem) {
			var thisItem = new MenuItem(menuItem);
			contextMenuList_[thisMenu].addChild(thisItem);
			return thisItem;
		},
		
		//////////////////////////////////
		// removeSingleItem
		//////////////////////////////////
		//
		// Removes the specified menu item from the specified context menu. 
		// Attempts to move focus off that item if it is the focus, but
		// will error if there is nothing else to focus. (A menu with focus
		// must have a child to be the focus.)
		//
		//
		removeSingleItem: function(thisMenu,thisItem) {
			try {
				if(contextMenuList_[thisMenu].focusedChild === thisItem) {
					var allMenuItems = contextMenuList_[thisMenu].getChildren();
					var n = -1;
					if(allMenuItems.length > 1) {
						if(allMenuItems[0] === thisItem) {
							n = 1;	
						} else if(allMenuItems[allMenuItems.length-1] === thisItem) {
							n = allMenuItems.length-2;
						} else {
							n = 0;
						}
						contextMenuList_[thisMenu].focusChild(contextMenuList_[thisMenu].getChildren()[n]);
					} else {
						// Removing the last child is equivalent to destroying the widget, without
						// actually destroying it. If the menu is active (i.e. rendered) this will generate
						// an error, so we'll refuse to remove it.
						throw new Error("Can't remove the last child in a menu; you should just destroy the menu.");
					}
				}
						
				contextMenuList_[thisMenu].removeChild(thisItem);
				thisItem.destroyRecursive();
				thisItem = null;
			} catch(e) {
				console.error(e);
				console.error("The item may not have been removed from menu " + thisMenu);
			}
		},
		
	   // Build a popup-menu with n-deep flyout menus from JSON data 
	   buildMenuFromJson: function(menuData,menuParent,nodeId,ActionSource) {
		   if(menuData.condition && !(ActionConditions.get(menuData.condition))) {
			   return;
		   }
	    	
        	var menuLabel = menuData.name || menuData.desc || menuData.tag || (menuData.key ? menuData.key+'' : false) || "<unnamed>";
    		if(menuData.mnem) {
    			var pos = menuLabel.indexOf(menuData.mnem);
    			if(pos < 0) {
    				pos = menuLabel.indexOf(menuData.mnem.toLowerCase());
    			}
    			if(pos >= 0) {
    				menuLabel = 
    					menuLabel.substring(0,pos) + "{" + menuLabel.substring(pos,pos+1) + "}" + menuLabel.substring(pos+1);
    			} else {
    				console.warn("[WARNING] Could not find " + menuData.mnem + " in " + menuLabel);
    			}
    		}
    		
    		switch(menuData.type) {
    			case "MENU":
    			case "MENU_PLACEHOLDER":
    		    	var menuDisabled = menuData.type === "MENU_PLACEHOLDER" ? true : false;

    				var subMenu = new Menu({
    					popupDelay: 5,
    					hitObj: menuParent.hitObj
    				},menuLabel + "_submenu_id_cnvctxt");	
    				
    				var subMenuParentItem = new PopupMenuItem({
    	    			label: menuLabel.replace(">","&gt;").replace("<","&lt;"),
    	    			id: menuLabel + "_submenu_cnvctxt_" + menuData.key + "_" + utils.makeId(),
    	    			disabled: menuDisabled,
    	    			popup: subMenu
    				});
    				
    				menuParent.addChild(subMenuParentItem);
    				
    				var self=this;
    				
    		    	// Handle the contents
    				if(menuData.items_ && menuData.items_.length > 0) {
	    		    	DojoArray.forEach(menuData.items_,function(item){
	    		    		self.buildMenuFromJson(item,subMenu,nodeId,ActionSource);
	    		    	});
    				} else {
    					subMenuParentItem.set("disabled",true);
    				}
    		    	break;
    		    	
    			case "SEPARATOR":
    				menuParent.addChild(new MenuSeparator());
    				break;
    				
    			case "ACTION":
    			case "CUSTOM_ACTION":
    				var actionArgs;
    				if(menuData.actionArg) {
    					actionArgs = {
    						id: nodeId,
    						uri: menuData.actionArgAsURLArgs
    					}
    				} else {
    					actionArgs = nodeId;
    				}
    				
    		    	menuParent.addChild(
    		    		new MenuItem({
    		    			disabled: ((!menuData.enabled && !menuData.isEnabled) ? true : false),
    		    			label: menuLabel.replace(">","&gt;").replace("<","&lt;"),
    		    			id: menuLabel + "_menuitem_cnvctxt_" + menuData.key+ "_" + utils.makeId(),
    		    			onClick: (ActionSource[menuData.keyType + "_" + menuData.key] ? 
    		    					ActionSource[menuData.keyType + "_" + menuData.key](actionArgs) : 
					    		function(e){console.warn("[WARNING] No Action available for onClick of " + menuLabel + " [" + menuData.keyType + "_" + menuData.key + "]");}),
				    		typeAndKey: menuData.keyType + "_" + menuData.key
    		    		})
    		    	);
    		    	break;
    			case "CHECKBOX_ACTION":
    				if(menuData.key.indexOf("TOGGLE") >= 0) {
    					var stateName = menuData.keyType+"_"+(menuData.key.substring(0,menuData.key.indexOf("_TOGGLE")));
    					require(["controllers/StatesController"],function(StatesController){
    						if(StatesController.stateIsLocal(stateName)) {
    							StatesController.setState(stateName,menuData.isChecked);
    						}
    					});    					
    				}
    		    	menuParent.addChild(
			    		new CheckedMenuItem({
			    			disabled: ((!menuData.enabled && !menuData.isEnabled) ? true : false),
			    			label: menuLabel.replace(">","&gt;").replace("<","&lt;"),
			    			id: menuLabel + "_chkbx_cnvctxt_" + menuData.key + "_" + utils.makeId(),
			    			onChange: (ActionSource[menuData.keyType + "_" + menuData.key] ? 
			    					ActionSource[menuData.keyType + "_" + menuData.key](nodeId) : 
							    function(e){console.warn("[WARNING] No Action available for onChange of " + menuLabel + " [" + menuData.keyType + "_" + menuData.key + "]");}),
						    checked: (menuData.isChecked ? menuData.isChecked : false),
						    typeAndKey: menuData.keyType + "_" + menuData.key
			    		})
			    	);
    				break;
    		}
	    },	
		
	    //////////////////////////////////////////
	    // buildCanvasHitContextMenu
	    /////////////////////////////////////////
	    // 
	    // Build a context menu for a drawn item on the canvas. This will ask
	    // for the appropriate context menu definition based on the node type and
	    // ID. 
	    //
		buildCanvasHitContextMenu: function(hit,event,overlay) {
			var nodeType = HIT_TO_NODE_TYPE[hit.getType()];
			if(!availableContextMenus_[nodeType]) {
				return;
			}
			var self=this;
			this.buildContextMenu(
				"canvas",
				{targetNodeIds: ["grn"], id: "canvas_context_menu_id", hitObj: hit},
				[],
				true
			);
						
			var loaderItem = this.addSingleItem("canvas",{label: "Loading..."});
			var args = null;
			if(nodeType.indexOf("MODULE") >= 0) {
				args = {
					method:"POST",
					headers:{"Content-Type":"application/json"},
					data: JSON.stringify(ClientState.getNewStateObject({currOverlay: overlay.id,enabledMods:overlay.enabled_modules}))
				};
				
			}
			XhrController.xhrRequest(XhrUris.popup(nodeType,hit,(args !== null)),args).then(function(data){
				if(!data) {
					self.addSingleItem("canvas",{label: "No menu to return!"});
				} else {
					DojoArray.forEach(data.items_,function(item) {
						self.buildMenuFromJson(item,contextMenuList_["canvas"],hit.id,ActionCollection);
					});				
				}
				self.removeSingleItem("canvas",loaderItem);
				contextMenuList_["canvas"].startup();
				
				// If the context menu is already on the DOM when startup runs, the size and placement 
				// will not be correct. Check to see if the domNode has a parent and if so,
				// double-check the sizes and move is if needed.
				if(contextMenuList_["canvas"].domNode.parentNode) {
				    require(["dojo/dom-style","dojo/dom-geometry"],function(domStyle,domGeometry){
						var contextPlace = domGeometry.position(contextMenuList_["canvas"].id);
						var grnPlace = domGeometry.position("grn");
						var newLeft,newTop,newHeight;
						if((contextPlace.w + contextPlace.x) > (grnPlace.x + grnPlace.w)) {
							newLeft = event.clientX-contextPlace.w;
						}
						if((contextPlace.h + contextPlace.y) > (grnPlace.h + grnPlace.y)){
							newTop = ((event.clientY-contextPlace.h) >= 5) ? event.clientY-contextPlace.h : 5;
						}
						
						if(domGeometry.position("app_container").h < (contextPlace.h + (newTop ? newTop : 0))) {
							newHeight = domGeometry.position("app_container").h-(newTop ? newTop+10 : 15);
						}
						
						if(newLeft || newTop) {
							var newPlace = {};
							if(newLeft) {
								newPlace.left = newLeft + "px";
							}
							if(newTop) {
								newPlace.top = newTop + "px";
							}
							domStyle.set(contextMenuList_["canvas"].domNode.parentNode,newPlace);
						}

						if(newHeight) {
							domStyle.set(
								contextMenuList_["canvas"].domNode.parentNode,{
									height: newHeight + "px",
									overflowY: "scroll",
									borderTopWidth: domStyle.get(contextMenuList_["canvas"].domNode,"border-top-width") + "px",
									borderTopStyle: domStyle.get(contextMenuList_["canvas"].domNode,"border-top-style"),
									borderTopColor: domStyle.get(contextMenuList_["canvas"].domNode,"border-top-color"),
									borderBottomWidth: domStyle.get(contextMenuList_["canvas"].domNode,"border-bottom-width") + "px",
									borderBottomStyle: domStyle.get(contextMenuList_["canvas"].domNode,"border-bottom-style"),
									borderBottomColor: domStyle.get(contextMenuList_["canvas"].domNode,"border-bottom-color")
								}
							);
						}
				    });
				}
			},function(err){
				if(err.status === "NEW_SESSION") {
					require(["dijit/popup","controllers/ActionCollection"],function(popup,ActionCollection){
						popup.close(contextMenuList_["canvas"]);
						contextMenuIsActive_ = false;
						ActionCollection.CLIENT_WARN_RESTART_SESSION();
					});					
				}
			});	
		},
		
		
		///////////////////////////////////////
		// buildModelTreeContextMenu
		///////////////////////////////////////
		// 
		// ModelTree context menus are all identical in content; only action status (enabled/disabled)
		// varies, and that is set when the context menu is loaded.
		//
		buildModelTreeContextMenu: function(treeNode) {
			var self=this;
			this.buildContextMenu(
				"modeltree",
				{
					targetNodeIds: ["ModelTree"],
					id: "modeltree_context_menu_id",
					selector: ".dijitTreeNode",
					onOpen: function(e) {
						var self=this;
						require(["dijit","put-selector/put"],function(dijit,put){
							_updateMenuItemStates(
								modelToStatesMap[
					                 dijit.byNode(self.currentTarget).item.ID
				                 ],
								"modeltree");
							
							contextMenuIsActive_ = true;
							put(self.currentTarget.firstChild,".dijitTreeContextClick");
						});
					},
					onClose: function(e) {
						var self=this;
						require(["dijit","put-selector/put"],function(dijit,put){
							put(self.currentTarget.firstChild,"!.dijitTreeContextClick");
						});						
					}
				},
				[],
				false
			);
					
			require(["controllers/EditorActions"],function(EditorActions){
				XhrController.xhrRequest(XhrUris.modelTreeContext(treeNode)).then(function(data){
					DojoArray.forEach(data.items_,function(item) {
						self.buildMenuFromJson(item,contextMenuList_["modeltree"],treeNode,EditorActions);
					});
				},function(err){
					if(err.status === "NEW_SESSION") {
						require(["dijit/popup","controllers/ActionCollection"],function(popup,ActionCollection){
							popup.close(contextMenuList_["modeltree"]);
							contextMenuIsActive_ = false;
							ActionCollection.CLIENT_WARN_RESTART_SESSION();
						});					
					}
				});
				
				contextMenuList_["modeltree"].startup();
			});
		},
		
		//////////////////////////////
		// contextIsOpen
		//////////////////////////////
		//
		// Given a context menu type thisMenu, return it's open status
		//
		// @param thisMenu String representing the type of context menu (ModelTree, Canvas)
		//@returns {Boolean} if this menu exists and is active, return true, else false
		//
		contextIsOpen: function(thisMenu) {
			return contextMenuList_[thisMenu] && contextMenuIsActive_;
		},
		
		updateMenuItemStates: function(states,thisMenu) {
			_updateMenuItemStates(states,thisMenu);
		},
		
		loadModelMenuStates: function(menuStatesByModel) {
			for(var i in menuStatesByModel) {
				if(menuStatesByModel.hasOwnProperty(i)) {
					var nodeKey = JSON.parse(i);
					modelToStatesMap[nodeKey.id] = menuStatesByModel[i];
				}
			}
		},
		
		setAvailableContextMenus: function(availableMenus){
			DojoArray.forEach(availableMenus,function(menu){
				availableContextMenus_[menu] = true;
			});
		} 
	};

});
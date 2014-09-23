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
    "dijit/Menu",
    "dijit/MenuBar",
    "dijit/MenuItem",
    "dijit/CheckedMenuItem",
    "dijit/PopupMenuItem",
    "dijit/PopupMenuBarItem",
    "dijit/DropDownMenu",
    "dijit/MenuSeparator",
    "dojo/Deferred",
    "dojo/_base/array",
    "dojo/on",
    "dijit/focus",
    "dojo/dom",
    "dijit/form/Form",
    "dojo/dom-construct",
    "controllers/ActionCollection",
    "static/XhrUris",
    "app/utils"
],function(
	declare,
	Menu, 
	MenuBar,
	MenuItem,
	CheckedMenuItem,
	PopupMenuItem,
	PopupMenuBarItem,
	DropDownMenu,
	MenuSeparator,
	Deferred,
	DojoArray,
	on,
	focusUtil,
	dom,
	Form,
	domConstruct,
	ActionCollection,
	XhrUris,
	utils
) {

	// A MenuBar with n-deep submenus. The menu bar builds itself off of JSON
	// returned from a URI provided in the constructor.

	return declare([], {
		constructor: function(jsonUri) {
			
		    ////////////// PRIVATE MEMBERS //////////////
			
			var jsonDefinitionUri_ = jsonUri;
			
			var menuItems = new Array();
			var placeHolderMenus = {};
			
			////////// MIXINS //////////
			//
			// If you wanted the menu to be more 'web'-like, i.e. open on hover, these mixins
			// plus some overriding of onMouseLeave (has to check to not close the parent
			// in cases of n-deep submenus) would do the trick.

			_OpenFastMixin = declare(null, {
		        popupDelay: 5
			});

			_ActivateOnMouseoverMixin = declare(null, {
				onItemHover: function(item){
					if(!this.isActive){
						this._markActive();
		            }
		            this.inherited(arguments);
				}
		    });		
		    
		    ActiveMenuBar = declare([MenuBar, _ActivateOnMouseoverMixin, _OpenFastMixin], {});	
		    
		    ActiveDropDownMenu = declare([DropDownMenu, _OpenFastMixin],{});
		    
		    // The Menu Bar
		    var hMenu = new MenuBar({
				popupDelay: 5,
				id: "horizontal_menu_widget"
			});	
		    
		    
		    function makeWidgetId(label,suffix) {
		    	return label.replace(/\s+/g,"_").replace(/[^A-Za-z_0-9]/g,"") + "_" + utils.makeId() + suffix;
		    };
		    
		    
		    ////////////////////////////
		    // buildMenu
		    ////////////////////////////
		    //
		    // Build a Menu from an object containing information
		    // 
		    // @param menuData An object of the menu's structure and contents
		    // @param menuParent If this is a submenu, a reference to its parent
		    // @param isFlyout If this is a submenu, is it a flyout
		    //
		    function buildMenu(menuData,menuParent,isFlyout) {
		    	
		    	var menuItem = null;
		    	
		    	try {
			    	// Set up the menu label and corresponding accesskey/mnemonic
		        	var menuLabel = menuData.name || menuData.desc || menuData.tag || (menuData.key ? menuData.key+'' : false) || "UNKOWN";
		    		if(menuData.mnem) {
		    			var pos = menuLabel.indexOf(menuData.mnem);
		    			if(pos < 0) {
		    				pos = menuLabel.indexOf(menuData.mnem.toLowerCase());
		    			}
		    			if(pos >= 0) {
		    				menuLabel = 
		    					menuLabel.substring(0,pos) + "{" + menuLabel.substring(pos,pos+1) + "}" + menuLabel.substring(pos+1);
		    			} else {
		    				console.error("Could not find " + menuData.mnem + " in " + menuLabel);
		    			}
		    		}

		    		switch(menuData.type) {
		    			case "MENU":
		    			case "MENU_PLACEHOLDER":
		    		    	var menuDisabled = menuData.type === "MENU_PLACEHOLDER" ? true : false;
	
				        	var subMenu, MenuItemClass, SubMenuClass;
				        	
					    	if(isFlyout) {
				    			SubMenuClass = Menu;
				    			MenuItemClass = PopupMenuItem;
					    	} else {
					    		SubMenuClass = DropDownMenu;
				    			MenuItemClass = PopupMenuBarItem;
					    	}
					    	
					    	// If these are defined, we're building a flyout or a submenu
					    	// Otherwise, it's an innermenu, and we'll go straight to parsing
					    	// contents
					    	if(SubMenuClass && MenuItemClass) {

								subMenu = new SubMenuClass({
									popupDelay: 5
								},makeWidgetId(menuLabel,"_submenu_id"));	
								
								var subMenuParentItem = new MenuItemClass({
					    			label: menuLabel,
					    			id: makeWidgetId(menuLabel,"_submenu_label_id"),
					    			disabled: menuDisabled,
					    			popup: subMenu
								}); 
								
								menuParent.addChild(subMenuParentItem); 
								
								if(menuData.type === "MENU_PLACEHOLDER") {
									placeHolderMenus[menuLabel] = {
										parentMenuItem: subMenuParentItem,
										submenu: subMenu
									};
								}
								
								if(menuData.items_ && menuData.items_.length > 0) {
							    	// Handle the contents
							    	DojoArray.forEach(menuData.items_,function(item){
							    		buildMenu(item,subMenu,true);
							    	});	
								} else {
									subMenuParentItem.set("disabled",true);
								}
					    	}
					    	break;
					    
		    			case "SEPARATOR":
		    				menuParent.addChild(new MenuSeparator());
		    				break;
		    				
		    			case "ACTION":
		    			case "CUSTOM_ACTION":
				    		menuItem = new MenuItem({
				    			label: menuLabel,
				    			id: makeWidgetId(menuLabel,"_label_id"),
				    			onClick: (ActionCollection[menuData.keyType + "_" + menuData.key] ||  
				    				function(e){console.debug("No Action available for onClick of " + menuLabel + "[" + menuData.keyType + "_" + menuData.key + "]");}
				    			),
				    			typeAndKey: menuData.keyType + "_" + menuData.key
				    		});
				    		
					    	menuParent.addChild(menuItem);
		    				break;
		    			case "CHECKBOX_ACTION":
		    				menuItem = new CheckedMenuItem({
				    			label: menuLabel,
				    			id: makeWidgetId(menuLabel,"_label_id"),
				    			onChange: (ActionCollection[menuData.keyType + "_" + menuData.key] ||
				    				function(e){console.debug("No Action available for onChange of " + menuLabel + "[" + menuData.keyType + "_" + menuData.key + "]");
			    					if(focusUtil.curNode.id.indexOf("submenu_label_id") >= 0 
			    							|| focusUtil.curNode.id.indexOf("horizontal_menu_widget") >= 0) {
				    						focusUtil.curNode && focusUtil.curNode.blur();
				    					}}
				    			),
				    			typeAndKey: menuData.keyType + "_" + menuData.key,
				    			checked: (menuData.isChecked ? menuData.isChecked : false)
				    		});
					    	menuParent.addChild(menuItem);
					    	break;
		    		}
		    		if(menuItem !== null) {
		    			menuItems.push(menuItem);
		    			
						require(["controllers/StatesController"],function(StatesController){
							if(menuItem.typeAndKey && StatesController.stateIsLocal(menuItem.typeAndKey)) {
								hMenu.own(
									StatesController.setStateWatch(menuItem.typeAndKey,function(){
										updateMenuItemStates_();
									})
								);
							}
						});		    			
		    		}
		    	} catch (e) {
		    		console.debug("Error building the FileMenu: " + e.message);
		    	}
		    };
		    
		    function updatePlaceholderMenus_(menuFills) {
		    	for(var i in menuFills) {
		    		if(menuFills.hasOwnProperty(i)) {
		    			if(menuFills[i].name) {
		    				placeHolderMenus[i].parentMenuItem.set("label",menuFills[i].name);
		    				if(menuFills[i].items_ && menuFills[i].items_.length > 0) {
		    					placeHolderMenus[i].parentMenuItem.set("disabled",false);
			    				DojoArray.forEach(placeHolderMenus[i].submenu.getChildren(),function(child){
			    					placeHolderMenus[i].submenu.removeChild(child);
			    					// If indexOf is negative, splice acts on the back of the array,
			    					// which is not what we want.
			    					if(menuItems.indexOf(child) >= 0) {
			    						menuItems.splice(menuItems.indexOf(child),1);
			    					}
			    					child.destroyRecursive();
						    	});		    				
						    	DojoArray.forEach(menuFills[i].items_,function(item){
						    		buildMenu(item,placeHolderMenus[i].submenu,true);
						    	});	
		    				} else {
		    					placeHolderMenus[i].parentMenuItem.set("disabled",true);
		    				}		    				
		    			}
		    		}
		    	}
		    };
		    
		    
		    function updateMenuItemStates_(states) {
		    	require(["controllers/StatesController"],function(StatesController){
					StatesController.updateItemStates(menuItems,states);					
				});	    	
		    };
		    
		    
		    /**
		     * Perform an asynchronous loading of the menu
		     * 
		     */
		    function loadHorizontalMenu() {
		    	var loadAsync = new Deferred();

				require(["dojo/request"], function(request){
				
					request(jsonDefinitionUri_).then(function(data){
						
						// Having " in a string for JSON parsing is sometimes
						// frowned on by parsers; replace them with ' to prevent
						// obscure JSON parsing problems
						var menuData = JSON.parse(data.replace(/\\"/g,"\'"));
												
						DojoArray.forEach(menuData.menus_,function(item){
							buildMenu(item,hMenu,false);
						});
						
						// Our accessibility key for the File Menu is m
		            	hMenu.own(
	            			on(window, "keypress", function(e){
	            				require(["dialogs"],function(BTDialogs){
	            					if(!BTDialogs.checkForRegisteredModals()) {
					            		var keyPressed = String.fromCharCode(e.charCode || e.keyCode || e.which);
					            		if(keyPressed == "m") {
					            			hMenu.focus();
				            				e.preventDefault();
				            				e.stopPropagation();
					            		}	            						
	            					}             					
	            				});
	            			})
		            	);	
		            	
		            	// MenuBar doesn't completely behave in a desktop-like manner due to how focusing on
		            	// the DOM works. So this helps make it slightly more Desktop-like.
		            	
		            	hMenu.own(
	            			on(hMenu, "keypress", function(e){
			            		var keyPressed = String.fromCharCode(e.charCode || e.keyCode || e.which);
			            		if(keyPressed == "m") {
			            			// There's a problem with the menubar not actually being blurred
			            			// once an action's been used in one of its submenus. So we're going
			            			// to instead force defocusing and then reacquire. Unfortunately
			            			// this will always land back on the first MenuBar child, but it's
			            			// better than an invisible focus.
			            			if(hMenu.focusedChild === hMenu.getChildren()[0]) {
			            				hMenu.focusNext();
			            			}
			            			hMenu.focus();
		            				e.preventDefault();
		            				e.stopPropagation();
			            		}
	            			})
		            	);		            	

						hMenu.startup();
						
						loadAsync.resolve(hMenu);
						
					}, function(err){
						loadAsync.reject("FileMenu request errored: " + err);
					}, function(evt){
						// Progress would go here
					});
				});		    	
		    	
		    	return loadAsync.promise;
		    };
		    	
		    var artboardContextMenu = null;
		    
		    ////////////// PRIVILEGED MEMBERS //////////////
		    
		    ///////////////////////////////
		    // getFileMenu
		    ///////////////////////////////
		    //
		    // Begin loading the menu bar and return a promise. Resolve it immediately
		    // if it's done loading/already loaded.
		    // 
			this.getFileMenu = function() {
				if(hMenu.getChildren().length > 0) {
					var loadAsync = new Deferred();
					loadAsync.resolve(hMenu);
					return loadAsync.promise;
				} else {
					return loadHorizontalMenu();
				}
			};
			
			/////////////////////////
			// update methods
			/////////////////////////
			//
			//
			this.updateMenuItemStates = function(states) {
				updateMenuItemStates_(states);
			};
			this.updatePlaceHolderMenus = function(menuFills) {
				updatePlaceholderMenus_(menuFills);
			};
		}
	});
});
/*
**    Copyright (C) 2003-2016 Institute for Systems Biology 
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
    // Primary widget set
	"widgets/BTToolbar",
	"widgets/BTMenuBar",
	"widgets/LowerLeftComponents",
	"widgets/ModelTree",
	"widgets/BTModelTab",
	"views/GrnModelMessages",
	// Startup modules
	"controllers/XhrController",
	"controllers/StorageManager",
	"static/XhrUris",
	"static/ErrorMessages",
	"static/BTConst",
	"app/utils",
	// Dojo dependencies
	"dijit/layout/BorderContainer", 
	"dijit/layout/ContentPane", 
	"widgets/BTTabContainer",
	"dojo/Deferred",
	"dijit/Tooltip",
	"dojo/on",
    "dojo/dom",
    "dojo/dom-style",
    "dojo/_base/array",
    "dojo/query",
    "dojo/_base/declare",
    "dojo/dom-construct",
	"dojo/domReady!"
],function(
    // Primary widget set
	BTToolbar,
	BTMenuBar,
	LowerLeftComponents,
	ModelTree,
	BTModelTab,
	GrnModelMsgs,
	// Startup modules
	XhrController,
	StorageManager,
	XhrUris,
	ErrMsgs,
	BTConst,
	utils,
	// Dojo Dependencies
	BorderContainer,
	ContentPane,
	TabContainer,
	Deferred,
	Tooltip,
	on,
	dom,
	domStyle,
	DojoArray,
	query,
	declare,
	domConstruct
){
		
	var location = window.location.href.match(/pathing|expdata|perturb/g);

	// Do NOT load this module if we are within one of the subpaths
	if(location && location.length > 0) {
		return null;
	}

	var MIN_SIZE_LEFT_CONTAINER = 270;
		
	// The current highest order tab, numbered from 0
	var tabIndex = 0;
		
	// Default to viewer mode unless the server tells us otherwise
	var clientMode_ = BTConst.CLIENTMODE_VIEWER;
	var availableMenus_ = {
		appMenus: null
	};
		
	var _bioTapestryToolbar = new BTToolbar();
	
	// This is only present in editor mode
	var _bioTapestryMenuBar;
	
	// This will be the primary container of our application.
	var applicationPane = new BorderContainer({
		id: BTConst.APP_CONTAINER_ID
	});
	
	var tabPane = new TabContainer({
		region: "center",
		id: BTConst.TAB_CONTAINER_ID
	});
	
	function _tabIdToIndex(id){
		var theseTabs = tabPane.getChildren();
		for(var i=0; i<theseTabs.length; i++) {
			if(theseTabs[i].tabId === id) {
				return i;
			}
		}
		return -1;
	};
	
	tabPane.own(tabPane.watch("selectedChildWidget",function(name,oldPane,newPane){
		require(["views","controllers/ActionCollection","controllers/ArtboardController","controllers/StatesController","dijit"],
			function(BTViews,ActionCollection,ArtboardController,StatesController,dijit){
			
			ActionCollection.SET_CANVAS_CONTAINER_NODE_ID(newPane.cnvContainerNodeId_);
			ActionCollection.SET_CURRENT_TAB(newPane.tabId);
			newPane.load().then(function(){
				if(StatesController.getState("ON_PATH",newPane.tabId)) {
					var pathCombo = dijit.byId(StatesController.getState("ON_PATH",newPane.tabId));
					pathCombo.set("value", StatesController.getState("PATH_COMBO",newPane.tabId) || "No Path");
				}
				var myAbC = ArtboardController.getArtboardController(newPane.cnvContainerNodeId_);
				// Because this swap may have happened to initialize the DOM nodes of a new tab, check for a
				// valid ArtboardController before trying to do anything
				myAbC && myAbC.updateStatesForSelection(null,true);
				myAbC && myAbC.updateZoomStates();				
			});
		});
	}));
			
	
	//////////////////////////////////
	// Top region pane setup
	/////////////////////////////////
	
	var topPane = new ContentPane({
		region: "top",
		id: BTConst.TOP_PANE_ID
	});
	
	require(["dojo/text!./customizations/Title.html"],function(TitleContent){
		topPane.set("innerHTML","<div id=\"header_pane\"><span>" + TitleContent + "</span></div>");
		// Strip any tags from the title customization file for use in the doc title
		document.title=TitleContent.replace(/<[^<]+>/ig,"");
	});
	
	
	require(["dojo/aspect"],function(aspect){
	    aspect.after(applicationPane,"resize",function(){
	    	if(dom.byId(BTConst.TOP_PANE_ID)) {
	    		domStyle.set(dom.byId(BTConst.HEADER_PANE_ID),"width",domStyle.get(dom.byId(BTConst.TOP_PANE_ID),"width"));	
	    	}
	    });		
	});
	
	//////////////////////
	//buildUpperLayout
	/////////////////////
	//
	// This will be conditional on the client mode, so it is run just before load time
	//
	function buildUpperLayout() {
		if(availableMenus_.appMenus && availableMenus_.appMenus.MenuBar) {
			_bioTapestryMenuBar = new BTMenuBar(XhrUris.menubar);
			return _bioTapestryMenuBar.getFileMenu().then(function(fileMenu){
		        topPane.addChild(fileMenu);
		    }).then(function() {
		    	if(availableMenus_.appMenus && availableMenus_.appMenus.ToolBar) {
			    	_bioTapestryToolbar.loadButtons().then(function() {
			            topPane.addChild(_bioTapestryToolbar.getToolbar());
			            applicationPane.resize();
			        }); 
		    	} else {
		    		applicationPane.resize();
		    	}
		    }); 
		} else {
			if(availableMenus_.appMenus && availableMenus_.appMenus.ToolBar) {
				return _bioTapestryToolbar.loadButtons().then(function() {
		            topPane.addChild(_bioTapestryToolbar.getToolbar());
		            applicationPane.resize();
		        });
			} else {
				var resolved = new Deferred();
				resolved.resolve();
				return resolved.promise;
			}
		}
	};
	
	var tabLoadingText = null;
	
	/////////////////////////////
	// showTabLoadingText
	//////////////////////////////
	//
	// Since tab loading is async, we want to show a loading screen
	// any time it's taking a while
	//
	function showTabLoadingText() {
		if(!tabLoadingText) {			
			tabLoadingText = domConstruct.create("div",{
				id: "TabLoadingText",
				innerHTML: "<span>Loading tabs</span>",
				style: "display: inline-block;"
			},query(".dijitTabContainerTop-tabs")[0],"last");
		} else {
			domStyle.set("tabLoadingScreen","display","inline-block");
		}
		
	};
	
	/////////////////////////////
	// clearTabLoadingText
	//////////////////////////////
	//
	//
	function clearTabLoadingText() {
		tabLoadingText && domStyle.set("TabLoadingText","display","none");
	};

	var _bioTapestryModelTree;
    var _buildTabContainer = new Deferred();
    var firstTab;
    var _firstTabConstruction = new Deferred();
        
	//////////////////////////////////
	// Bottom region pane setup
	/////////////////////////////////
    
    var footer_wrapper = new BorderContainer({
    	region: "bottom",
    	id: BTConst.FOOTER_WRAPPER_ID,
    	splitter: true,
    	minSize: 50
    });
    
    var ftr = new ContentPane({
    	region: "center",
    	id: BTConst.FOOTER_PANE_ID
    }); 
    
    footer_wrapper.addChild(ftr);
    
    ftr.own(GrnModelMsgs.setMessageWatch(
		function(name,oldval,newval) {
			ftr.set("content",newval);
			applicationPane.resize();
		}
    ));

    applicationPane.addChild(topPane);
    applicationPane.addChild(tabPane);
    applicationPane.addChild(footer_wrapper);
    
	var loadAsync = null;
	
	///////////////////////
	// refreshTab
	///////////////////////
	//
	//
	function refreshTab(currTab,isCurrTab) {

		loadAsync = new Deferred();
				
		// The refresh call may hit when a tab never even completed loading (due to
		// a session restart). If that's the case, just load the tab.
		if(!currTab.isLoaded()) {
			currTab.load(true).then(function(){
				require(["controllers/ArtboardController"],function(ArtboardController){
					var myAbC = ArtboardController.getArtboardController(currTab.cnvContainerNodeId_);
					// Because this swap may have happened to initialize the DOM nodes of a new tab, check for a
					// valid ArtboardController before trying to do anything
					myAbC && myAbC.updateStatesForSelection(null,true);
					myAbC && myAbC.updateZoomStates();	
					loadAsync.resolve();
				});
			});
			return loadAsync.promise; 
		}
		
		currTab.resizeLeftContainer({w: MIN_SIZE_LEFT_CONTAINER});
				
		currTab.refresh(isCurrTab).then(function(){
			loadAsync.resolve();
		});
		
		return loadAsync.promise;
	};
	
    ////////////////// INTERFACE //////////////////

	return {
		
		//////////////////////
		// sessionRestart
		////////////////////
		//
		// Always restart the current tab, then, restart the rest
		sessionRestart: function() {
			
			require(["controllers/XhrController"],function(XhrController){
				XhrController.xhrRequest(XhrUris.init).then(function(response){
					if(response.result !== BTConst.RESULT_SESSION_READY) {
						loadAsync.reject(ErrMsgs.sessionNotReady);
						throw new Error(ErrMsgs.sessionNotReady);
					}
			
					var currTab = tabPane.get("selectedChildWidget");
					refreshTab(currTab,true);
					// Any tabs which were previously loaded will now need to be refreshed
					// We explicitly only refresh loaded tabs, because the refresh method
					// will load a tab which has not been previously loaded (to handle 
					// loads which halted due to a session restart)
					DojoArray.forEach(tabPane.getChildren(),function(tab){
						if(tab.isLoaded() && tab.index !== currTab.index) {
							refreshTab(tab,false);
						}
					});
				});
			});
		},
		
		////////////////////
		// loadNewModel
		///////////////////
		//
		// Load a new model into the client. 
		//
		loadNewModel: function(params) {
			
			var self=this;
			var currTab = tabPane.getChildren()[0];
			tabPane.set("selectedChildWidget",currTab);
			this.resizeLeftContainer({w: MIN_SIZE_LEFT_CONTAINER},0);
			loadAsync = new Deferred();
			require([
		         "controllers/GrnModelController"
		         ,"controllers/ArtboardController"
		         ,"controllers/ActionCollection"
		         ,"views/BioTapestryCanvas"
	         ],
			function(GrnModelController,ArtboardController,ActionCollection,BTCanvas){

				DojoArray.forEach(tabPane.getChildren(),function(tab,index){
					// Delete any extra tabs
					if(index > (params.tabs.length-1)) {
						tabPane.removeChild(tab);
						GrnModelController.removeController(tab.tabId);
						ArtboardController.removeController(tab.cnvContainerNodeId_);
						LowerLeftComponents.remove(tab.tabId);
						BTCanvas.removeBtCanvas(tab.cnvContainerNodeId_);
						tab.destroyRecursive();
					} else {
					    XhrController.xhrRequest(XhrUris.modeltree(tab.tabId)).then(function(data) {
					    	params.tabs[index].data = data;
							tab.reload(index == 0,params.tabs[index]);
					    });
					}
				});
					
				// Any tabs in excess of the previous set will need to be made now.
				tabIndex = (tabPane.getChildren().length-1);
				
				// We load up all of the tabs, *then* add them to the container,
				// so we can be certain they'll go in order (the container does a simple
				// domNode insertion so you can't insert 4 after 6, for example).
				var tabsBuilt = {};
				var addAllTabs = function() {
					var tabIdx = Object.keys(tabsBuilt);
					// This will fail until we've seen all of the tabs loaded in
					if((tabIdx.length+tabPane.getChildren().length) === params.tabs.length) {
    					tabIdx.sort(function(a,b){return a-b;});
						DojoArray.forEach(tabIdx,function(idx){
							tabPane.addChild(tabsBuilt[idx]);
							var tabList = tabPane.tablist.getChildren();
							tabList[tabList.length-1].tabId = tabsBuilt[idx].tabId;
						});	
					}
				};
				
				DojoArray.forEach(params.tabs,function(incTab,index){
					if(index > tabIndex) {
						self.makeNewTab(incTab).then(function(tab){
							tabsBuilt[index] = tab;
							addAllTabs();
						});
					}
				});

			});
			return loadAsync.promise;
		},
		
		//////////////////////////////
		// makeNewTab
		/////////////////////////////
		//
		//
		makeNewTab: function(params) {
			var asyncAddTab = new Deferred();
					        
		    XhrController.xhrRequest(XhrUris.modeltree(params.dbID)).then(function(data) {
		    	
		    	declare.safeMixin(params,{
					id: BTConst.TAB_BC_ID_BASE+params.dbID,
					cnvContainerNodeId: BTConst.CANVAS_CONTAINER_NODE_ID_BASE+"_"+params.dbID,
					data: data,
					closable: (clientMode_ === BTConst.CLIENTMODE_EDITOR)
				});
				
				var newTabContainer = new BTModelTab(params);
				
				if(clientMode_ === BTConst.CLIENTMODE_EDITOR) {
			        require(["widgets/BTContextMenus"],function(BTContextMenus){
			        	BTContextMenus.addTreeToModelTreeContext(newTabContainer.getModelTree().id);
			        });
				}
			
				asyncAddTab.resolve(newTabContainer);
		    });
		    
		    return asyncAddTab.promise;
		},
		
		//////////////////////////////
		// addNewTab
		/////////////////////////////
		//
		//
		addNewTab: function(params) {
			this.makeNewTab(params).then(function(tab){
				tabPane.addChild(tab);
				var tabList = tabPane.tablist.getChildren();
				tabList[tabList.length-1].tabId = tab.tabId;
				params && params.select & params.selectChild(tab);
			});
		},
		
		//////////////////////////////
		// loadBioTapestry
		////////////////////////////
		//
		//
		//
		loadBioTapestry: function(clientSettings) {
			
			var self=this;
			// Parse out the client's settings (viewer/editor, available menu types)
			clientMode_ = clientSettings.clientMode.toUpperCase();
			
			DojoArray.forEach(clientSettings.supportedMenus.menuTypes,function(menu) {
				if(!availableMenus_.appMenus) {
					availableMenus_.appMenus = {};
				}
				availableMenus_.appMenus[menu] = true;
			});
			
			var firstTabId = clientSettings.tabs[0].dbID;
			var firstSelTabId = clientSettings.tabs[clientSettings.currentTab].dbID;
			
			// Set up the first tab and load it into the container; we'll switch
			// to the actual 'current' selected tab after everything else is done
			XhrController.xhrRequest(XhrUris.modeltree(firstTabId)).then(function(data) {
				
				declare.safeMixin(clientSettings.tabs[0],{
					id: BTConst.TAB_BC_ID_BASE+firstTabId,
					cnvContainerNodeId_: BTConst.CANVAS_CONTAINER_NODE_ID_BASE+"_"+firstTabId,
					data: data,
					closable: (clientMode_ === BTConst.CLIENTMODE_EDITOR),					
				});
				
				firstTab = new BTModelTab(clientSettings.tabs[0]);
				
				tabPane.addChild(firstTab);
				
				var tabList = tabPane.tablist.getChildren();
				
				tabList[tabList.length-1].tabId = firstTab.tabId
						
				_bioTapestryModelTree = firstTab.getModelTree();
				
				_buildTabContainer.resolve();
				_firstTabConstruction.resolve();
		        
			});

			
			// Set up context menus
	        require(["widgets/BTContextMenus"],function(BTContextMenus){
	        	BTContextMenus.setAvailableContextMenus(clientSettings.supportedMenus.popupTypes);
	        });
			
			
			if(availableMenus_.appMenus.TabMenu) {
				_buildTabContainer.then(function() {
					require(["widgets/BTContextMenus"],function(BTContextMenus){
						BTContextMenus.buildTabContextMenu(tabPane.id);
					});
		        });
			}
			
			// Prevent this from being called more than once
			if(!loadAsync) {
				loadAsync = new Deferred();
				
				try {

			        document.body.appendChild(applicationPane.domNode);
			        applicationPane.startup();
			        		        
			        buildUpperLayout().then(function(){

			            // After the applicationPane has started, we'll have some of our
			            // necessary DOM elements, so we can attach things to them.
			        	require([
		        	         "controllers/ActionCollection","controllers/StatesController","controllers/ArtboardController"
	        	         ],function(
		        			ActionCollection,StatesController,ArtboardController
	        			){		
			        		_firstTabConstruction.promise.then(function(){
				        		firstTab.load().then(function(){
				        			// Bootstrap our ActionCollection
				        			ActionCollection.SET_CANVAS_CONTAINER_NODE_ID(firstTab.cnvContainerNodeId_);
				        			ActionCollection.SET_CURRENT_TAB(firstTab.tabId);
				        			ActionCollection.SET_CLIENT_MODE(clientMode_);
				        			firstTab.set("closable",(clientMode_ === BTConst.CLIENTMODE_EDITOR));
				        			var tabsAdded = new Deferred();
				        			_bioTapestryModelTree.getResizeDeferred().then(function(){
					        			// If this is a multi-tab model file, we load any other tabs after the first one once the initial load
					        			// is completed using makeNewTab
				        				
				        				// We will need to aggregate all of the tree IDs for making the context menu, if there is one
			        					var treeIds = [firstTab.getModelTree().id];
			        					
					        			if(clientSettings.tabs.length > 1) {
					        				
				        					var slowLoad = setTimeout(function(){showTabLoadingText();},1000);
					        				
					        				// We load up all of the tabs, *then* add them to the container,
					        				// so we can be certain they'll go in order (the container does a simple
					        				// domNode insertion so you can't insert 4 after 6, for example).
					        				var tabsBuilt = {};
					        				var addAllTabs = function() {
					        					clearTimeout(slowLoad);
					        					clearTabLoadingText();
					        					var tabIdx = Object.keys(tabsBuilt);
					        					// This will fail until we've seen all of the tabs loaded in
					        					if(tabIdx.length === clientSettings.tabs.length - 1) {
						        					tabIdx.sort(function(a,b){return a-b;});
					        						DojoArray.forEach(tabIdx,function(idx){
					        							tabPane.addChild(tabsBuilt[idx]);
					        							var tabList = tabPane.tablist.getChildren();
					        							tabList[tabList.length-1].tabId = tabsBuilt[idx].tabId;
					        							treeIds.push(tabsBuilt[idx].getModelTree().id);
					        						});
					        						if(availableMenus_.appMenus.ModelTreeMenu) {
				        						        require(["widgets/BTContextMenus"],function(BTContextMenus){
				        						        	BTContextMenus.buildModelTreeContextMenu(treeIds,firstTab.getModelTree().getRoot());
				        						        	tabsAdded.resolve();
				        						        });
					        						} else {
					        							tabsAdded.resolve();
					        						}
					        					}
					        				};
					        				DojoArray.forEach(clientSettings.tabs,function(tabInfo,index){
					        					// Skip the 0-indexed tab since we'll have already done that one
					        					if(index != 0) {
					        						self.makeNewTab(tabInfo).then(function(tab){
					        							tabsBuilt[index] = tab;
					        							addAllTabs();
					        						});
					        					}
					        				});
					        			} else {
					        				if(availableMenus_.appMenus.ModelTreeMenu) {
				        				        require(["widgets/BTContextMenus"],function(BTContextMenus){
				        				        	BTContextMenus.buildModelTreeContextMenu(treeIds,firstTab.getModelTree().getRoot());
				        				        });
					        				}
					        			}
				        			}).then(function(){
				        				tabsAdded.promise.then(function(){
				        					// Finally, check to see if we need to swap tabs
								        	if(firstSelTabId !== firstTab.tabId) {
								        		self.selectTab(firstSelTabId);
								        	}
				        				});
				        			});			        			
				        		});			        			
			        		});
			        	});

			            // TODO: Fetch out CurrentState and apply it
			            
			        },function(err){
			        	loadAsync.reject({type: "load", msg: ErrMsgs.loadFailed + err});
			        }).then(function() {
			        	// Force a preloading of the Tooltip DOM node so it doesn't have
			        	// a laggy insertion later.
			        	Tooltip.show("Preloading tooltip...",document.body);
			        	Tooltip.hide(document.body);
			        				        	
			        	// One final resize, to make sure everything is displaying properly
			        	applicationPane.resize();
			        	
			        	loadAsync.resolve();
			        },function(err){
			        	loadAsync.reject({type: "load", msg: ErrMsgs.loadFailed + err});
			        });
				} catch(err) {
					loadAsync.reject({type: "load", msg: ErrMsgs.loadFailed + err});
				}				
			}
	    		
	    	return loadAsync.promise;
		},
		
		/////////////////////////////
		// resizeLeftContainer
		////////////////////////////
		//
		//
		resizeLeftContainer: function(newSize,tabId) {
			var thisTab = (tabId ? tabPane.getChildren()[_tabIdToIndex(tabId)] : tabPane.get("selectedChildWidget")); 
			thisTab.resizeLeftContainer(newSize);			
			applicationPane.layout();
		},
		
		///////////////////////////////
		// resizeLeftLowerContainer
		//////////////////////////////
		//
		//
		resizeLeftLowerContainer: function(newSize,tabId) {
			loadAsync.promise.then(function(){
				var thisTab = (tabId ? tabPane.getChildren()[_tabIdToIndex(tabId)] : tabPane.get("selectedChildWidget")); 
				thisTab.resizeLowerLeftContainer(newSize);	
			});
		},
		
		////////////////////////////
		// resizeApplicationPane
		///////////////////////////
		//
		// 
		resizeApplicationPane: function(newSize) {
			loadAsync.promise.then(function(){
				if(newSize !== undefined && newSize !== null) {
					applicationPane.resize(newSize);
				} else {
					applicationPane.resize();
				}
			});		
		},

		///////////////////////////
		// updateViewStates
		//////////////////////////
		//
		// Given an object containing states and masks, apply them to the menu bar, toolbar, combo box place holders, and model tree context menuss
		// 
		updateViewStates: function(statesAndMasks) {
			require(["controllers/StatesController","widgets/BTContextMenus"],function(StatesController,BTContextMenus){
				StatesController.updateMasks(statesAndMasks.XPlatMaskingStatus);
				var currTab = tabPane.get("selectedChildWidget");
				currTab.set("_statesAndMasks",statesAndMasks);
				var currentTree = currTab.getModelTree();
				currentTree && currentTree.maskTree(statesAndMasks.XPlatMaskingStatus && statesAndMasks.XPlatMaskingStatus.modelTree);
				if(statesAndMasks.XPlatCurrentState) {
					_bioTapestryMenuBar && _bioTapestryMenuBar.updatePlaceHolderMenus(statesAndMasks.XPlatCurrentState.menuFills);
					_bioTapestryMenuBar && _bioTapestryMenuBar.updateMenuItemStates(statesAndMasks.XPlatCurrentState.flowEnabledStates);
					_bioTapestryToolbar.updateToolbarState(statesAndMasks.XPlatCurrentState.flowEnabledStates,statesAndMasks.XPlatCurrentState.conditionalStates);
					_bioTapestryToolbar.updatePlaceHolders(statesAndMasks.XPlatCurrentState.comboFills);
					BTContextMenus.loadModelMenuStates(statesAndMasks.XPlatCurrentState.modelTreeState);
					BTContextMenus.updateMenuItemStates(statesAndMasks.XPlatCurrentState.flowEnabledStates,"tabContainer");
				}
			});
		},
				
		////////////////////////////////////
		// TabController public interface
		////////////////////////////////////
		//
		//
		setTabTitle: function(title,tabId) {
			var thisTab = (tabId ? tabPane.getChildren()[_tabIdToIndex(tabId)] : tabPane.get("selectedChildWidget"));
			title = title && title.length > 0 ? title : "Model "+(thisTab.get("tabId")+1);
			thisTab.set("title",title);
		},
		setTabTooltip: function(tooltip,tabId) {
			var thisTab = (tabId ? tabPane.getChildren()[_tabIdToIndex(tabId)] : tabPane.get("selectedChildWidget"));
			tooltip = tooltip && tooltip.length > 0 ? tooltip : thisTab.get("title");
			thisTab.set("tooltip",tooltip);
		},
		selectTab: function(tabId) {
			if(tabId === null || tabId === undefined) {
				return null;
			}
			var thisTab = tabPane.getChildren()[_tabIdToIndex(tabId)];
			thisTab && tabPane.selectChild(thisTab);
		},
		getCurrentTab: function() {
			return tabPane.get("selectedChildWidget");
		},
		getCurrentIndex: function() {
			return _tabIdToIndex(this.getCurrentTab().get("tabId"));
		},
		getCurrentTabId: function() {
			return this.getCurrentTab().get("tabId");
		},
		getTabWidget: function(tabId) {
			return (tabId ? tabPane.getChildren()[_tabIdToIndex(tabId)] : tabPane.get("selectedChildWidget"));
		},
		closeTab: function(tabId,allButThisTab,fromBtn) {
			var myTabs = tabPane.getChildren();
			if(!fromBtn) {
				if(allButThisTab) {
					DojoArray.forEach(myTabs,function(tab){
						tabPane.removeChild(tab);
					});
				} else {
					tabPane.removeChild(myTabs[_tabIdToIndex(tabId)]);
				}
			}
			tabIndex = (myTabs.length-1);
		},
		tabClosed: function(index) {
			//TODO: anything views/main needs to clean up?
		},
		
		/////////////////////////////////////////
		// ModelTree public interface
		///////////////////////////////////////
		//
		//
		selectOnTree: function(modelId,tabId) {
			var thisTab = (tabId ? tabPane.getChildren()[_tabIdToIndex(tabId)] : tabPane.get("selectedChildWidget"));
			thisTab.getModelTree().selectNodeOnTree(modelId);
		},
		getTreeRoot: function(tabId) {
			var thisTab = (tabId ? tabPane.getChildren()[_tabIdToIndex(tabId)] : tabPane.get("selectedChildWidget"));
			return thisTab.getModelTree().getRoot();
		},
		refreshModelTree: function(tabId) {
			var refreshAsync = new Deferred();
			var thisTab = (tabId ? tabPane.getChildren()[_tabIdToIndex(tabId)] : tabPane.get("selectedChildWidget"));
			XhrController.xhrRequest(XhrUris.modeltree(thisTab.get("tabId"))).then(function(data) {
				thisTab.getModelTree().refresh(data);
				refreshAsync.resolve();
			});
			return refreshAsync.promise;
		},
		getTreeResize: function(tabId) {
			var thisTab = (tabId ? tabPane.getChildren()[_tabIdToIndex(tabId)] : tabPane.get("selectedChildWidget"));  
			return thisTab.getModelTree().getResizeDeferred();
		}
		
    };	
});	
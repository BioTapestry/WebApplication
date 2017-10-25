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
	"widgets/BTToolbar",
	"widgets/BTMenuBar",
	"widgets/LowerLeftComponents",
	"widgets/ModelTree",
	"controllers/XhrController",
	"static/XhrUris",
	"views/GrnModelMessages",
	"app/utils",
	// Dojo Dependencies
	"dijit/layout/BorderContainer", 
	"dijit/layout/ContentPane", 
	"dojo/Deferred",
	"dijit/Tooltip",
	"dojo/on",
    "dojo/dom",
    "dojo/dom-style",
    "dojo/_base/array",
    "dojo/query",
    "dojo/dom-attr",
    "dijit/focus",
	"dojo/domReady!"
],function(
	BTToolbar,
	BTMenuBar,
	LowerLeftComponents,
	ModelTree,
	XhrController,
	XhrUris,
	GrnModelMsgs,
	utils,
	// Dojo Dependencies
	BorderContainer,
	ContentPane,
	Deferred,
	Tooltip,
	on,
	dom,
	domStyle,
	DojoArray,
	query,
	domAttr,
	focus
){
	
	var location = window.location.href.match(/pathing|expdata|perturb/g);

	// Do NOT load this module if we are within one of the subpaths
	if(location && location.length > 0) {
		return null;
	}

	var MIN_SIZE_LEFT_CONTAINER = 270;
	var _leftContainerSize = MIN_SIZE_LEFT_CONTAINER;
	
	var CANVAS_CONTAINER_NODE_ID = "grn";
	var CANVAS_WRAPPER_NODE_ID = "grnWrapper";

	// Default to viewer mode unless the server tells us otherwise
	var _clientMode = "VIEWER";
	var _availableMenus = {
		appMenus: null
	};
		
	// These are present in both editor and viewer mode
	var _bioTapestryToolbar = new BTToolbar();
	var _bioTapestryModelTree = null;
	
	// This is only present in editor mode
	var _bioTapestryMenuBar;
	
	// UI Variables
	var _grn = null, _applicationPane = null, _left = null, _leftUpperComponent = null;
		
	///////////////// Helper Methods /////////////////
	
	// This function constructs the file menu (if there is one), the toolbar, and the top
	// display region. The contents of this segment of the UI are conditional on the client mode, 
	// so it is run just before load time
	function buildUpperLayout() {
		var asyncLoad = new Deferred();
		if(_availableMenus.appMenus && _availableMenus.appMenus.MenuBar) {
			_bioTapestryMenuBar = new BTMenuBar(XhrUris.menubar);
			_bioTapestryMenuBar.getFileMenu().then(function(fileMenu){
		        _topPane.addChild(fileMenu);
		    },function(err){
		    	console.error("[ERROR] Couldn't load the File Menu!");
		    	asyncLoad.reject();
		    }).then(function() {
		    	if(_availableMenus.appMenus && _availableMenus.appMenus.ToolBar) {
			    	_bioTapestryToolbar.loadButtons().then(function() {
			            _topPane.addChild(_bioTapestryToolbar.getToolbar());
			            _applicationPane.resize();
			            asyncLoad.resolve();
			        },function(err){
				    	console.error("[ERROR] Couldn't load the Toolbar!");
				    	asyncLoad.reject();
				    }); 
		    	} else {
		    		_applicationPane.resize();
		    		asyncLoad.resolve();
		    	}
		    }); 
		} else {
			if(_availableMenus.appMenus && _availableMenus.appMenus.ToolBar) {
				_bioTapestryToolbar.loadButtons().then(function() {
		            _topPane.addChild(_bioTapestryToolbar.getToolbar());
		            _applicationPane.resize();
		            asyncLoad.resolve();
		        },function(err){
			    	console.error("[ERROR] Couldn't load the toolbar buttons!");
			    	asyncLoad.reject();
			    });
			} else {
				asyncLoad.resolve();
			}
		}
		return asyncLoad.promise;
	};
	
	// This will request the model tree, which contains all of our GRN model hierarchy
	// information and will be used to populate both the GrnModelController and the 
	// ModelTree
    function loadModelsAndTree() {
    	var asyncLoad = new Deferred();
        XhrController.xhrRequest(XhrUris.modeltree).then(function(data) {
    		
        	_bioTapestryModelTree = new ModelTree({rawTreeData: data});
        	_leftUpperComponent.addChild(_bioTapestryModelTree);
        	
    		require(["controllers/GrnModelController"],function(GrnModelController){
    			GrnModelController.setFullBounds(data.allModelBounds);
    			GrnModelController.set("initialZoomMode_",data.firstZoomMode);
    			GrnModelController.set("navZoomMode_",data.navZoomMode);
    			GrnModelController.buildModels(
    				data.root.childNodes
    				,"root"
    				,{hasImages:data.hasImages,hasOverlays:data.hasOverlays,timeSliderDef: data.timeSliderDef}
    			);
    			asyncLoad.resolve(data);
    		});
        });
        return asyncLoad.promise;
    };
    
	function _resizeLeftContainer(newSize) {
		if(newSize !== undefined && newSize !== null) {
			if(newSize.w < MIN_SIZE_LEFT_CONTAINER) {
				newSize.w = MIN_SIZE_LEFT_CONTAINER;
			}
			_grn.resize({w: _grn.w-(newSize.w-_left.w)});
			_left.resize({w: newSize.w});
			_applicationPane.layout();
		}
	};
    
    ////////////////////////// UI Construction ///////////////////////////
        
	// This will be the primary container of our application.
	_applicationPane = new BorderContainer({
		id: "app_container"
	});
	
	//////////////////////////
	// Top region pane setup
	//////////////////////////
	
	var _topPane = new ContentPane({
		region: "top",
		id: "top_pane"
	});
	
	require(["dojo/text!./customizations/Title.html"],function(TitleContent){
		_topPane.set("innerHTML","<div id=\"header_pane\"><span>" + TitleContent + "</span></div>");
		// Strip any tags in the title file
		document.title=TitleContent.replace(/<[^<]+>/ig,"");
	});
	
	
	require(["dojo/aspect"],function(aspect){
	    aspect.after(_applicationPane,"resize",function(){
	    	if(dom.byId("top_pane")) {
	    		domStyle.set(dom.byId("header_pane"),"width",domStyle.get(dom.byId("top_pane"),"width"));	
	    	}
	    });		
	});
    
    
	//////////////////////////////////
	// Left region pane setup
	/////////////////////////////////

    // Because we want to have a splitter between the upper and lower components
    // of this pane, we'll need to make an outer wrapper that is also a BorderContainer
    _left = new BorderContainer({
        region: "left",
        id: "left_wrapper",
        splitter: true,
    	gutters: false,
        minSize: _leftContainerSize
    });
    
    _leftUpperComponent = new ContentPane({
    	region: "center",
    	id: "left_upper_component"
    });
    
    var _buildModels = loadModelsAndTree();
       
    _left.addChild(_leftUpperComponent);
    
    _left.addChild(LowerLeftComponents.getContainer());

	//////////////////////////////
	// Center region pane setup
	/////////////////////////////
    
    _grn = new ContentPane({
    	region: "center",
    	id: CANVAS_WRAPPER_NODE_ID
    });
    
	//////////////////////////////////
	// Bottom region pane setup
	/////////////////////////////////
    
    var _footerWrapper = new BorderContainer({
    	region: "bottom",
    	id: "footer_wrapper",
    	splitter: true,
    	minSize: 50
    });
    
    var _ftr = new ContentPane({
    	region: "center",
    	id: "footer_pane"
    }); 
    
    _footerWrapper.addChild(_ftr);
    
    _ftr.own(GrnModelMsgs.setMessageWatch(
		function(name,oldval,newval) {
			_ftr.set("content",newval);
			_applicationPane.resize();
		}
    ));

    _applicationPane.addChild(_topPane);
    _applicationPane.addChild(_grn);
    _applicationPane.addChild(_left);
    _applicationPane.addChild(_footerWrapper);
    
    // We need to make sure any click inside the GRN Model area moves focus to it,
    // otherwise we get bizarre behavior and can't use up/down arrow to scroll
    // the model
    domAttr.set(_grn.domNode,"tabindex",0);
    _grn.own(on(_grn,"click",function(e){
    	focus.focus(_grn.domNode);
    }));
    
    // Bind the zoom in and out event for the grnWrapper to -_ and +=
    _grn.own(on(_grn,"keydown",function(e) {
    	require(["controllers/ActionCollection"],function(ActionCollection){
    		if(!e.altKey && !e.ctrlKey) {
    			var code = ((e.keyCode === 0 || e.keyCode === undefined) ? e.charCode : e.keyCode);
		    	if(utils.isPlusEquals(code)) {
		    		ActionCollection.MAIN_ZOOM_IN(e);
		    	} else if(utils.isMinusUs(code)) {
		    		ActionCollection.MAIN_ZOOM_OUT(e);
		    	}
    		}
    	});
    }));   
    
    var _zoomWarnHandle = on(window,"keydown",function(e){
    	require(["controllers/ActionCollection"],function(ActionCollection){
    		if(e.ctrlKey) {
    			var code = ((e.keyCode === 0 || e.keyCode === undefined) ? e.charCode : e.keyCode);
		    	if(utils.isPlusEquals(code) || utils.isMinusUs(code)) {
		    		ActionCollection.MAIN_ZOOM_WARN(e);
		    		_zoomWarnHandle.remove();
		    	}    			
    		}
    	});
    });
    
	var _loadAsync = null;
      
    ////////////////// MODULE INTERFACE //////////////////

	return {
		///////////////////
		// sessionRestart
		//////////////////
		//
		// 
		sessionRestart: function() {
			_leftContainerSize = MIN_SIZE_LEFT_CONTAINER;
			_resizeLeftContainer({w: _leftContainerSize});
			_loadAsync = new Deferred();
			require(["controllers/XhrController"],function(XhrController){
				XhrController.xhrRequest(XhrUris.init).then(function(response){
					if(!response.result === "SESSION_READY") {
						_loadAsync.reject("[ERROR] Session did not return ready!");
						throw new Error("[ERROR] Session did not return ready!");
					}
					require([
				        "controllers/GrnModelController",
				        "controllers/ArtboardController",
				        "controllers/ActionCollection",
				        "views/BioTapestryCanvas"
			        ],
						function(GrnModelController,ArtboardController,ActionCollection,BtCanvas){
						BtCanvas.toggleWatchEvents(CANVAS_CONTAINER_NODE_ID);
						var currentModelId = GrnModelController.get("currentModel_");
						var currentModelState = null;
						GrnModelController.getCurrentModel().then(function(model){
							currentModelState = model.get("state_");
						}).then(function() {
							GrnModelController.reloadController(true).then(function(){
								_buildModels = loadModelsAndTree();
								_buildModels.then(function(data){
									_bioTapestryModelTree.refresh(data);
									ArtboardController.reloadArtboardController(CANVAS_CONTAINER_NODE_ID);
									GrnModelController.set("currentModel_",currentModelId,currentModelState);
									GrnModelController.getCurrentModel().then(function(){
										BtCanvas.toggleWatchEvents(CANVAS_CONTAINER_NODE_ID);
										GrnModelController.set("currentModel_",currentModelId,currentModelState);
										BtCanvas.canvasReady(CANVAS_CONTAINER_NODE_ID).then(function(){
											ActionCollection["MAIN_ZOOM_TO_CURRENT_MODEL"]({});
										});
									}); 
									_bioTapestryModelTree.selectNodeOnTree(currentModelId);
									_loadAsync.resolve();
								});
							});
						});
					});
				});				
			});
			return _loadAsync.promise;
		},
		
		///////////////////
		// loadNewModel
		//////////////////
		//
		//
		loadNewModel: function() {
			_leftContainerSize = MIN_SIZE_LEFT_CONTAINER;
			_resizeLeftContainer({w: _leftContainerSize});
			_loadAsync = new Deferred();
			require([
		         ,"controllers/GrnModelController"
		         ,"controllers/ArtboardController"
		         ,"controllers/ActionCollection"
		         ,"views/BioTapestryCanvas"
	         ],
			function(GrnModelController,ArtboardController,ActionCollection,BTCanvas){
				BTCanvas.removeResizingAspect(CANVAS_CONTAINER_NODE_ID);
				BTCanvas.toggleWatchEvents(CANVAS_CONTAINER_NODE_ID);
				GrnModelController.reloadController().then(function(){
					_buildModels = loadModelsAndTree();
					_buildModels.then(function(data){
						_bioTapestryModelTree.refresh(data);
						ArtboardController.reloadArtboardController(CANVAS_CONTAINER_NODE_ID);
						GrnModelController.setModel("default_").then(function(){
							GrnModelController.getCurrentModel().then(function(model){
								BTCanvas.toggleWatchEvents(CANVAS_CONTAINER_NODE_ID);
								GrnModelController.set("currentModel_",GrnModelController.get("currentModel_"));
								BTCanvas.canvasReady(CANVAS_CONTAINER_NODE_ID).then(function(){
									ActionCollection["MAIN_ZOOM_TO_CURRENT_MODEL"]({});
									BTCanvas.makeResizingAspect(CANVAS_CONTAINER_NODE_ID);
									_loadAsync.resolve();
								});
							});							
						});
					});					
				});
			});
			return _loadAsync.promise;
		},
		
		/////////////////////
		// loadBioTapestry
		////////////////////
		//
		//
		loadBioTapestry: function(clientSettings) {
			
			// Parse out the client's settings (viewer/editor, available menu types)
			_clientMode = clientSettings.clientMode.toUpperCase();
			DojoArray.forEach(clientSettings.supportedMenus.menuTypes,function(menu) {
				if(!_availableMenus.appMenus) {
					_availableMenus.appMenus = {};
				}
				_availableMenus.appMenus[menu] = true;
			});
			
	        require(["widgets/BTContextMenus"],function(BTContextMenus){
	        	BTContextMenus.setAvailableContextMenus(clientSettings.supportedMenus.popupTypes);
	        });
			
			if(_availableMenus.appMenus.ModelTreeMenu) {
				_buildModels.then(function(){
			        require(["widgets/BTContextMenus"],function(BTContextMenus){
			        	BTContextMenus.buildModelTreeContextMenu(_bioTapestryModelTree.getRoot());
			        });
			    });
			}
			
			// Prevent this from being called more than once
			if(!_loadAsync) {
				_loadAsync = new Deferred();
				
				try {

			        document.body.appendChild(_applicationPane.domNode);
			        _applicationPane.startup();
			        		        
			        buildUpperLayout().then(function(){
			        	_buildModels.then(function(){
				            // After the applicationPane has started, we'll have some of our
				            // necessary DOM elements, so we can attach things to them.
				        	require([
			        	         "controllers/ActionCollection"
			        	         ,"controllers/StatesController"
			        	         ,"controllers/ArtboardController"
			        	         ,"controllers/GrnModelController"
		        	         ],function(
			        			ActionCollection,StatesController,ArtboardController,GrnModelController
		        			){
				        		ActionCollection.SET_CANVAS_CONTAINER_NODE_ID(CANVAS_CONTAINER_NODE_ID);
				        		GrnModelController.set("cnvContainerNodeId_",CANVAS_CONTAINER_NODE_ID);
				        		var grnArtboardController = ArtboardController.makeArtboardController({
				        			cnvWrapperDomNodeId: CANVAS_WRAPPER_NODE_ID,
				        			cnvContainerDomNodeId: CANVAS_CONTAINER_NODE_ID,
				        			floatingArtboard:false,
				        			delayedLoad: false,
				        			networkModelController: "controllers/GrnModelController"
			        			});
				        		grnArtboardController.attachArtboard({
		        					zoomStates: {inState: "MAIN"+StatesController.zoomIn,outState: "MAIN"+StatesController.zoomOut},
		        					id: "btCanvas_" + utils.makeId(),
		        					attachLeftClickEvent: true,
		        					attachRightClickEvent: true,
		        					attachTooltipEvent: true,
		        					attachDragSelectionEvent: true,
		        					attachNoteEvent: true,
		        					drawWorkspace: true,
		        					primaryCanvas: true
		        				}).then(function(btArtboard){
				        			_applicationPane.own(btArtboard);
				        		});
				        	});			        		
			        	});
			            // TODO: Fetch out CurrentState and apply it
			        },function(err){
			        	_loadAsync.reject({type: "load", msg: "[ERROR] While performing async load of the interface: " + err});
			        }).then(function() {
			        	// Force a preloading of the Tooltip DOM node so it doesn't have
			        	// a laggy insertion later.
			        	Tooltip.show("Preloading tooltip...",document.body);
			        	Tooltip.hide(document.body);
			        	
			        	// One final resize, to make sure everything is displaying properly
			        	_applicationPane.resize();
			        	
			        	_loadAsync.resolve();
			        },function(err){
			        	_loadAsync.reject({type: "load", msg: "[ERROR] While performing async load of the interface: " + err});
			        });
				} catch(err) {
					_loadAsync.reject({type: "load", msg: "[ERROR] While performing async load of the interface: " + err});
				}				
			}
	    		
	    	return _loadAsync.promise;
		},
		
		resizeLeftContainer: function(newSize) {
			_resizeLeftContainer(newSize);
		},
		
		resizeLeftLowerContainer: function(newSize) {
			_loadAsync.promise.then(function(){
				LowerLeftComponents.resize(newSize);	
			});
		},
		
		resizeApplicationPane: function(newSize) {
			_loadAsync.promise.then(function(){
				if(newSize !== undefined && newSize !== null) {
					_applicationPane.resize(newSize);
				} else {
					_applicationPane.resize();
				}
			});		
		},
		
		selectOnTree: function(modelId) {
			_bioTapestryModelTree && _bioTapestryModelTree.selectNodeOnTree(modelId);
		},
		
		getTreeResize: function() {
			return _bioTapestryModelTree.getResizeDeferred();
		},
		
		getTreeRoot: function() {
			return _bioTapestryModelTree.getRoot();
		},

		updateViewStates: function(statesAndMasks) {
			require(["controllers/StatesController","widgets/BTContextMenus"],function(StatesController,BTContextMenus){
				StatesController.updateMasks(statesAndMasks.XPlatMaskingStatus);
				_bioTapestryModelTree && _bioTapestryModelTree.maskTree(statesAndMasks.XPlatMaskingStatus && statesAndMasks.XPlatMaskingStatus.modelTree);
				if(statesAndMasks.XPlatCurrentState) {
					_bioTapestryMenuBar && _bioTapestryMenuBar.updatePlaceHolderMenus(statesAndMasks.XPlatCurrentState.menuFills);
					_bioTapestryMenuBar && _bioTapestryMenuBar.updateMenuItemStates(statesAndMasks.XPlatCurrentState.flowEnabledStates);
					_bioTapestryToolbar.updateToolbarState(statesAndMasks.XPlatCurrentState.flowEnabledStates,statesAndMasks.XPlatCurrentState.conditionalStates);
					_bioTapestryToolbar.updatePlaceHolders(statesAndMasks.XPlatCurrentState.comboFills);
					BTContextMenus.loadModelMenuStates(statesAndMasks.XPlatCurrentState.modelTreeState);
				}
			});
		},
		
		getAppCanvasContainerNodeId: function() {
			return CANVAS_CONTAINER_NODE_ID;
		},
		
		getAppCanvasWrapperNodeId: function() {
			return CANVAS_WRAPPER_NODE_ID;
		}
    };	
});	
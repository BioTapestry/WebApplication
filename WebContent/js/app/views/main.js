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
	"widgets/BTToolbar",
	"widgets/BTMenuBar",
	"widgets/LowerLeftComponents",
	"widgets/ModelTree",
	"static/XhrUris",
	"views/GrnModelMessages",
	"app/utils",
	"dijit/layout/BorderContainer", 
	"dijit/layout/ContentPane", 
	"dojo/Deferred",
	"dijit/Tooltip",
	"dojo/on",
    "dojo/dom",
    "dojo/dom-style",
    "dojo/_base/array",
    "dojo/query",
	"dojo/domReady!"
],function(
	BTToolbar,
	BTMenuBar,
	LowerLeftComponents,
	ModelTree,
	XhrUris,
	GrnModelMsgs,
	utils,
	BorderContainer,
	ContentPane,
	Deferred,
	Tooltip,
	on,
	dom,
	domStyle,
	DojoArray,
	query
){
	
	var location = window.location.href.match(/pathing|expdata|perturb/g);

	// Do NOT load this module if we are within one of the subpaths
	if(location && location.length > 0) {
		return null;
	}

	var MIN_SIZE_LEFT_CONTAINER = 270;
	var leftContainerSize = MIN_SIZE_LEFT_CONTAINER;
	
	var CANVAS_CONTAINER_NODE_ID = "grn";
	var CANVAS_WRAPPER_NODE_ID = "grnWrapper";
	
	// Default to viewer mode unless the server tells us otherwise
	var clientMode_ = "VIEWER";
	var availableMenus_ = {
		appMenus: null
	};
		
	// These are present in both editor and viewer mode
	var bioTapestryToolbar_ = new BTToolbar();
	var bioTapestryModelTree_ = new ModelTree();
	
	// This is only preset in editor mode
	var bioTapestryMenuBar_;
	
	// This will be the primary container of our application.
	var applicationPane = new BorderContainer({
		id: "app_container"
	});
	
	//////////////////////////////////
	// Top region pane setup
	/////////////////////////////////
	
	var topPane = new ContentPane({
		region: "top",
		id: "top_pane"
	});
	
	require(["dojo/text!./customizations/Title.html"],function(TitleContent){
		topPane.set("innerHTML","<div id=\"header_pane\"><span>" + TitleContent + "</span></div>");
		// Strip any tags in the title file
		document.title=TitleContent.replace(/<[^<]+>/ig,"");
	});
	
	
	require(["dojo/aspect"],function(aspect){
	    aspect.after(applicationPane,"resize",function(){
	    	if(dom.byId("top_pane")) {
	    		domStyle.set(dom.byId("header_pane"),"width",domStyle.get(dom.byId("top_pane"),"width"));	
	    	}
	    });		
	});
	
	// This will be conditional on the client mode, so it is run just before load time
	function buildUpperLayout() {
		if(availableMenus_.appMenus && availableMenus_.appMenus.MenuBar) {
			bioTapestryMenuBar_ = new BTMenuBar(XhrUris.menubar);
			return bioTapestryMenuBar_.getFileMenu().then(function(fileMenu){
		        topPane.addChild(fileMenu);
		    }).then(function() {
		    	if(availableMenus_.appMenus && availableMenus_.appMenus.ToolBar) {
			    	bioTapestryToolbar_.loadButtons().then(function() {
			            topPane.addChild(bioTapestryToolbar_.getToolbar());
			            applicationPane.resize();
			        }); 
		    	} else {
		    		applicationPane.resize();
		    	}
		    }); 
		} else {
			if(availableMenus_.appMenus && availableMenus_.appMenus.ToolBar) {
				return bioTapestryToolbar_.loadButtons().then(function() {
		            topPane.addChild(bioTapestryToolbar_.getToolbar());
		            applicationPane.resize();
		        });
			} else {
				var resolved = new Deferred();
				resolved.resolve();
				return resolved.promise;
			}
		}
	};
	

    
	//////////////////////////////////
	// Left region pane setup
	/////////////////////////////////
    //
    // Because we want to have a splitter between the upper and lower components
    // of this pane, we'll need to make an outer wrapper that is also a BorderContainer
    //
    var left = new BorderContainer({
        region: "left",
        id: "left_wrapper",
        splitter: true,
    	gutters: false,
        minSize: leftContainerSize
    });
    
    var leftUpperComponent = new ContentPane({
    	region: "center",
    	id: "left_upper_component"
    });
        
    var buildModelTree_ = bioTapestryModelTree_.getModelHierarchyTree().then(function(modelTree){
    	leftUpperComponent.addChild(modelTree);
        // Squelch all default context menuing on the DIV container for the 
        // ModelTree
    	modelTree.own(
        	on(leftUpperComponent,"contextmenu",function(e){
        		e.preventDefault();      		
        	})
        );
        
        bioTapestryModelTree_.setTreeWidget();
        
        modelTree.startup();
        
    });
   
    left.addChild(leftUpperComponent);
    
    left.addChild(LowerLeftComponents.getContainer());

	//////////////////////////////////
	// Center region pane setup
	/////////////////////////////////
    var grn = new ContentPane({
    	region: "center",
    	id: CANVAS_WRAPPER_NODE_ID
    });
    
	//////////////////////////////////
	// Bottom region pane setup
	/////////////////////////////////
    
    var footer_wrapper = new BorderContainer({
    	region: "bottom",
    	id: "footer_wrapper",
    	splitter: true,
    	minSize: 50
    });
    
    var ftr = new ContentPane({
    	region: "center",
    	id: "footer_pane"
    }); 
    
    footer_wrapper.addChild(ftr);
    
    ftr.own(GrnModelMsgs.setMessageWatch(
		function(name,oldval,newval) {
			ftr.set("content",newval);
			applicationPane.resize();
		}
    ));

    applicationPane.addChild(topPane);
    applicationPane.addChild(grn);
    applicationPane.addChild(left);
    applicationPane.addChild(footer_wrapper);
    
	var loadAsync = null;
	
	function _resizeLeftContainer(newSize) {
		if(newSize !== undefined && newSize !== null) {
			if(newSize.w < MIN_SIZE_LEFT_CONTAINER) {
				newSize.w = MIN_SIZE_LEFT_CONTAINER;
			}
			grn.resize({w: grn.w-(newSize.w-left.w)});
			left.resize({w: newSize.w});
			applicationPane.layout();
		}
	};
      
    ////////////////// INTERFACE //////////////////

	return {
		sessionRestart: function() {
			leftContainerSize = MIN_SIZE_LEFT_CONTAINER;
			_resizeLeftContainer({w: leftContainerSize});
			loadAsync = new Deferred();
			require(["controllers/XhrController"],function(XhrController){
				XhrController.xhrRequest(XhrUris.init).then(function(response){
					if(!response.result === "SESSION_READY") {
						loadAsync.reject("Session did not return ready!");
						throw new Error("Session did not return ready!");
					}
					require([
				        "controllers/ModelTreeController",
				        "controllers/GrnModelController",
				        "controllers/ArtboardController",
				        "controllers/ActionCollection",
				        "views/BioTapestryCanvas"
			        ],
						function(ModelTreeController,GrnModelController,ArtboardController,ActionCollection,BtCanvas){
						BtCanvas.toggleWatchEvents(CANVAS_CONTAINER_NODE_ID);
						var currentModelId = GrnModelController.get("currentModel_");
						var currentModelState = null;
						GrnModelController.getCurrentModel().then(function(model){
							currentModelState = model.get("state_");
						}).then(function() {
							GrnModelController.reloadController(true).then(function(){
								ModelTreeController.refreshTree().then(function(){
									ArtboardController.reloadArtboardController(CANVAS_CONTAINER_NODE_ID,true);
									GrnModelController.set("currentModel_",currentModelId,currentModelState);
									GrnModelController.getCurrentModel().then(function(){
										GrnModelController.setCachedInRenderer(currentModelId,true);
										BtCanvas.toggleWatchEvents(CANVAS_CONTAINER_NODE_ID);
										ActionCollection["MAIN_ZOOM_TO_CURRENT_MODEL"]({});	
									}); 
									ModelTreeController.selectNodeOnTree(currentModelId);
									loadAsync.resolve();
								});							
							})}
						);
					});
				});				
			});
			return loadAsync.promise;
		},
		
		loadNewModel: function() {
			leftContainerSize = MIN_SIZE_LEFT_CONTAINER;
			_resizeLeftContainer({w: leftContainerSize});
			loadAsync = new Deferred();
			require([
		         "controllers/ModelTreeController"
		         ,"controllers/GrnModelController"
		         ,"controllers/ArtboardController"
		         ,"controllers/ActionCollection"
		         ,"views/BioTapestryCanvas"
	         ],
			function(ModelTreeController,GrnModelController,ArtboardController,ActionCollection,BTCanvas){
				BTCanvas.removeResizingAspect(CANVAS_CONTAINER_NODE_ID);
				BTCanvas.toggleWatchEvents(CANVAS_CONTAINER_NODE_ID);
				GrnModelController.reloadController().then(function(){
					ModelTreeController.refreshTree().then(function(){
						ArtboardController.reloadArtboardController(CANVAS_CONTAINER_NODE_ID);
						BTCanvas.toggleWatchEvents(CANVAS_CONTAINER_NODE_ID);
						GrnModelController.set("currentModel_","default_");
						GrnModelController.getCurrentModel().then(function(){
							ActionCollection["MAIN_ZOOM_TO_CURRENT_MODEL"]({});
							BTCanvas.makeResizingAspect(CANVAS_CONTAINER_NODE_ID);
							loadAsync.resolve();
						});
					});					
				});
			});
			return loadAsync.promise;
		},
		
		loadBioTapestry: function(clientSettings) {
			
			// Parse out the client's settings (viewer/editor, available menu types)
			clientMode_ = clientSettings.clientMode.toUpperCase();
			DojoArray.forEach(clientSettings.supportedMenus.menuTypes,function(menu) {
				if(!availableMenus_.appMenus) {
					availableMenus_.appMenus = {};
				}
				availableMenus_.appMenus[menu] = true;
			});
			
	        require(["widgets/BTContextMenus"],function(BTContextMenus){
	        	BTContextMenus.setAvailableContextMenus(clientSettings.supportedMenus.popupTypes);
	        });
			
			if(availableMenus_.appMenus.ModelTreeMenu) {
				buildModelTree_.then(function(){
			        require(["widgets/BTContextMenus","controllers/ModelTreeController"],function(BTContextMenus,ModelTreeController){
			        	BTContextMenus.buildModelTreeContextMenu(ModelTreeController.getTreeRoot());
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
			        		grnArtboardController.attachArtboard(
		        				{
		        					zoomStates: {inState: "MAIN"+StatesController.zoomIn,outState: "MAIN"+StatesController.zoomOut},
		        					id: "btCanvas_" + utils.makeId(),
		        					attachLeftClickEvent: true,
		        					attachRightClickEvent: true,
		        					attachTooltipEvent: true,
		        					attachDragSelectionEvent: true,
		        					attachNoteEvent: true,
		        					drawWorkspace: true,
		        					primaryCanvas: true
		        				}
		        			).then(function(btArtboard){
			        			applicationPane.own(btArtboard);
			        		});
			        	});

			            // TODO: Fetch out CurrentState and apply it
			            
			        },function(err){
			        	loadAsync.reject({type: "load", msg: "[ERROR] While performing async load of the interface: " + err});
			        }).then(function() {
			        	// Force a preloading of the Tooltip DOM node so it doesn't have
			        	// a laggy insertion later.
			        	Tooltip.show("Preloading tooltip...",document.body);
			        	Tooltip.hide(document.body);
			        	
			        	// One final resize, to make sure everything is displaying properly
			        	applicationPane.resize();
			        	
			        	loadAsync.resolve();
			        },function(err){
			        	loadAsync.reject({type: "load", msg: "[ERROR] While performing async load of the interface: " + err});
			        });
				} catch(err) {
					loadAsync.reject({type: "load", msg: "[ERROR] While performing async load of the interface: " + err});
				}				
			}
	    		
	    	return loadAsync.promise;
		},
		
		resizeLeftContainer: function(newSize) {
			_resizeLeftContainer(newSize);
		},
		
		resizeLeftLowerContainer: function(newSize) {
			loadAsync.promise.then(function(){
				LowerLeftComponents.resize(newSize);	
			});
		},
		
		resizeApplicationPane: function(newSize) {
			loadAsync.promise.then(function(){
				if(newSize !== undefined && newSize !== null) {
					applicationPane.resize(newSize);
				} else {
					applicationPane.resize();
				}
			});		
		},

		updateViewStates: function(statesAndMasks) {
			require(["controllers/StatesController","widgets/BTContextMenus"],function(StatesController,BTContextMenus){
				StatesController.updateMasks(statesAndMasks.XPlatMaskingStatus);
				bioTapestryModelTree_ && bioTapestryModelTree_.maskTree(statesAndMasks.XPlatMaskingStatus && statesAndMasks.XPlatMaskingStatus.modelTree);
				if(statesAndMasks.XPlatCurrentState) {
					bioTapestryMenuBar_ && bioTapestryMenuBar_.updatePlaceHolderMenus(statesAndMasks.XPlatCurrentState.menuFills);
					bioTapestryMenuBar_ && bioTapestryMenuBar_.updateMenuItemStates(statesAndMasks.XPlatCurrentState.flowEnabledStates);
					bioTapestryToolbar_.updateToolbarState(statesAndMasks.XPlatCurrentState.flowEnabledStates,statesAndMasks.XPlatCurrentState.conditionalStates);
					bioTapestryToolbar_.updatePlaceHolders(statesAndMasks.XPlatCurrentState.comboFills);
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
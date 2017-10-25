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
	"app/utils",
	// Dojo dependencies
	"dijit",
	"dijit/layout/BorderContainer", 
	"dijit/layout/ContentPane",
	"dojo/dom-construct",
	"dojo/dom-style",
	"dojo/dom",
	"dojo/on",
	"dojo/Deferred",
    "dojo/_base/declare",
    "dojo/dom-attr",
    "dojo/_base/fx",
    "dijit/focus",
    "./ModelTree",
    "./LowerLeftComponents",
    "app/utils",
	"dojo/domReady!"
],function(
	utils,
	// Dojo Dependencies
	dijit,
	BorderContainer,
	ContentPane,
	domConstruct,
	domStyle,
	dom,
	on,
	Deferred,
	declare,
	domAttr,
	fx,
	focus,
	ModelTree,
	LowerLeftComponents,
	utils
){
	
	// Consts
	
	var MIN_SIZE_LEFT_CONTAINER = 270;
	var MIN_TREE_PANE_HEIGHT = 200;
	
	var CANVAS_WRAPPER_NODE_ID_BASE = "grnWrapper";
	
	// There is more than one type of Network Controller (PathingModelController, GrnModelController) so we must define
	// the type a BTModelTab is designed to work with.
	var BTMT_NETWORK_CONTROLLER = "controllers/GrnModelController";	
	
	// Two helper classes which our Tab will hold, and which will be parents to
	// other widgets: 
	
	/////////////////////
	// TreeContentPane
	/////////////////////
	//
	//
	var TreeContentPane = declare([ContentPane],{
		region: "top",
    	"class": "LeftUpperComponent",
    	minSize: MIN_TREE_PANE_HEIGHT,
    	_lowerLeftComp: null,
    	// Our TreeContentPane has an enforced minimum size, and in addition will
    	// always take up any available space after that up to the LowerLeftComponent's
    	// needs.
		resize: function(newSize) {
			if(!newSize) {
				newSize = {h: MIN_TREE_PANE_HEIGHT};
			} else if(!newSize.h || newSize.h < MIN_TREE_PANE_HEIGHT) {
				newSize.h = MIN_TREE_PANE_HEIGHT;
			}
			
			var llcReqHeight = (this._lowerLeftComp ? this._lowerLeftComp._totalReqHeight : 0);
			
			newSize.h = Math.max((this.getParent().domNode.clientHeight - llcReqHeight),newSize.h);
			
			this.inherited(arguments);
		}
	});
	
	//////////////////////////
	// LeftWrapper
	//////////////////////////
	//
	//
	var LeftWrapper = declare([BorderContainer],{
        region: "left",
        "class": "LeftWrapper",
        splitter: true,
    	gutters: false,
        minSize: MIN_SIZE_LEFT_CONTAINER
	});
	
	
	/////////////////////////////////
	// BTModelTab
	////////////////////////////////
	//
	// Extended dijit.layout.BorderContainer which adds functionality specific to behavior as a BioTapestry Model-displaying tab,
	// including:
	//
	//    1. A resize method to correctly maintain minimum size limits
	// 	  2. Delayed loading to conserve memory (if the tab is never focused it doesn't load its artboard or model tree)
	//
	// Contains children member widgets ModelTree and LowerLeftComponents. LLC may be empty if none of the LLC children widgets 
	// are active (TimeSlider, ModelAnnotationImage, and Overlay). Loading a BTModelTab will instantiate its accompanying
	// ModelTree.
	//
	return declare([BorderContainer],{
		// The BioTapestry ID of the tab
		// (this is not the same as the id, which is the widget ID, or the tab's index in the TabPane controller)
		tabId: null,
		_asyncLoader: null,
		_loaded: null,
		_modelTree: null,
		_leftContainer: null,
		_lowerLeftComponents: null,
		_statesAndMasks: null,
		_downloadingScreen: null,
		_asyncTabBuilder: null,
		
		// The ID to use for attaching our artboards
		cnvContainerNodeId_: null,
		
		// The ID of our GRN 'wrapper', a ContentPane which holds the Canvas container
		grnWrapperNodeId_: null,
		
		//////////////////////
		// showDownloading
		//////////////////////
		//
		// Unlike the loadingScreen, downloadingScreen is centered on the workspace and
		// has an opaque, white background (in case no model is loaded at all). 
		//
		showDownloading: function(hide,textUpdate,withTimer) {
			var self=this;
			var slowTimer;
			
			// If the downloadingScreen element hasn't been made before, make it now and register
			// an async event to place it on the DOM after the wrapper node is generated
			if(!this._downloadingScreen) {
				this._downloadingScreen = {
					domElem: domConstruct.create(
						"div",{
							id: "ModelDownloading",
							innerHTML: "<p id=\"ModelDownloadPara\"><span class=\"ModelDownloadText\">Downloading model...</span></p>"
						}
					),
					timeStamp: 0
				};
				domStyle.set(this._downloadingScreen.domElem,"display","none");
				this._asyncTabBuilder.promise.then(function(){
					domConstruct.place(self._downloadingScreen.domElem,dom.byId(self.grnWrapperNodeId_),"first");
				});
			// Otherwise, check for a previous 'updated text' block and destroy it if it exists
			} else {
				dom.byId("AddedText") && domConstruct.destroy("AddedText");
			}
			
			// If we're adding a text update, do that now
			if(textUpdate) {
				domConstruct.create(
					"span",{innerHTML: textUpdate, id: "AddedText", "class": "ModelDownloadText"},"ModelDownloadPara","last"
				);
			}
			
			if(hide) {
				// Don't hide it if it doesn't actually need to be hidden
				if(domStyle.get("ModelDownloading","display") !== "none") {
					if(slowTimer) {
						clearInterval(slowTimer);
					}
					this._downloadingScreen.timeStamp = 0;
					slowTimer = null;
					setTimeout(function() {
				    	fx.fadeOut({
				    		node: self._downloadingScreen.domElem,
				            onEnd: function(node){
				            	domStyle.set(node, 'display', 'none');
				            }
			            }).play();
					},1000);
				}
			} else {
				// Don't try to show it if it's already being shown
				if(domStyle.get("ModelDownloading","display") === "none") {
					// If this is the first time it's being shown, set the timeStamp
					this._downloadingScreen.timeStamp = Date.now();
					domStyle.set(this._downloadingScreen.domElem,{opacity: 1, display:"block",width:this.grnWrapperNodeId_.width + "px",height:this.grnWrapperNodeId_.height + "px"});
				}	
			}
			
			if(withTimer) {
				if(!dom.byId("LoadScreenTimer")) {
					var loadScreenTimer = domConstruct.create("span",{
						id: "LoadScreenTimer", "class":"ModelDownloadText", 
						innerHTML: "Elapsed time: " + Math.round((Date.now()-this._downloadingScreen.timeStamp)/1000) + " s"
					},"ModelDownloadPara","last");
					slowTimer = setInterval(function(){
						loadScreenTimer.innerHTML = "Elapsed time: " + Math.round((Date.now()-self._downloadingScreen.timeStamp)/1000) + " s";
					},1000);
				}
			} else {
				domConstruct.destroy("LoadScreenTimer");
			}
		},
		
		///////////////////
		// getModelTree
		/////////////////
		//
		//
		getModelTree: function() {
			return this._modelTree;
		},
		
		/////////////////
		// isLoaded
		////////////////
		//
		//
		isLoaded: function() {
			return this._loaded;
		},
		
		//////////////////////////
		// resizeLeftContainer
		////////////////////////
		//
		// 
		resizeLeftContainer: function(newSize) {
			if(newSize !== undefined && newSize !== null) {
				if(newSize.w < MIN_SIZE_LEFT_CONTAINER) {
					newSize.w = MIN_SIZE_LEFT_CONTAINER;
				}
				var grn = dijit.byId(CANVAS_WRAPPER_NODE_ID_BASE+"_"+this.tabId);
				grn.resize({w: grn.w-(newSize.w-this._leftContainer.w)});
				
				dijit.byId("leftwrapper_"+this.tabId).resize({w: newSize.w});
				
			}	
		},
		
		//////////////////////////////
		// resizeLowerLeftContainer
		/////////////////////////////
		//
		//
		resizeLowerLeftContainer: function(newSize) {
			this._lowerLeftComponents.resize(newSize);	
		},
		
		////////////////
		// postCreate
		////////////////
		//
		//
		postCreate: function(params) {			
			this.inherited(arguments);
			
			var self=this;
			
	    	this._modelTree = new ModelTree({tabId: this.tabId, rawTreeData: this._data});
			
		    this._leftContainer = new LeftWrapper({id: "leftwrapper_"+this.tabId});
		    
		    var newLeftUpper = new TreeContentPane();
		    
	    	newLeftUpper.addChild(this._modelTree);
	    	
	        // Squelch all default context menuing on the DIV container for the ModelTree
	    	this._modelTree.own(
	        	on(newLeftUpper,"contextmenu",function(e){
	        		e.preventDefault();      		
	        	})
	        );
	        
	    	this._modelTree.startup();
	    	
	    	this._leftContainer.addChild(newLeftUpper);
		    
	    	this._lowerLeftComponents = (LowerLeftComponents.makeNewLowerLeftComponents(this.tabId));
	    	
	    	newLeftUpper._lowerLeftComp = this._lowerLeftComponents; 
	    	
	    	this._leftContainer.addChild(this._lowerLeftComponents);

		    var grn = new ContentPane({
		    	region: "center",
		    	id: CANVAS_WRAPPER_NODE_ID_BASE+"_"+this.tabId,
		    	"class": "GrnWrapper"
		    });
		    
		    this.addChild(this._leftContainer);
		    this.addChild(grn);
		    
		    // We need to make sure any click inside the GRN Model area moves focus to it,
		    // otherwise we get bizarre behavior and can't use up/down arrow to scroll
		    // the model
		    domAttr.set(grn.domNode,"tabindex",0);
		    grn.own(on(grn,"click",function(e){
		    	focus.focus(grn.domNode);
		    }));
		    
		    // Bind the zoom in and out event for the grnWrapper to -_ and +=
		    grn.own(on(grn,"keydown",function(e) {
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
		    
		    var zoomWarnHandle = on(window,"keydown",function(e){
		    	require(["controllers/ActionCollection"],function(ActionCollection){
		    		if(e.ctrlKey) {
		    			var code = ((e.keyCode === 0 || e.keyCode === undefined) ? e.charCode : e.keyCode);
				    	if(utils.isPlusEquals(code) || utils.isMinusUs(code)) {
				    		ActionCollection.MAIN_ZOOM_WARN({zoomType: (utils.isPlusEquals(code) ? "+" : "-")});
				    		zoomWarnHandle.remove();
				    	}    			
		    		}
		    	});
		    });
		    
		    this.grnWrapperNodeId_ = grn.id;
		    
		    this._asyncTabBuilder.resolve();
		},
		
		//////////////
		// onClose
		///////////////
		//
		//
		onClose: function(withConfirm) {
			var conf = true;
			if(withConfirm) {
				conf = confirm("Are you sure you want to close the \"" + this.title +"\" tab?"); 
			}
			if(conf) {
				require(["controllers/ActionCollection"],function(ActionCollection){
					ActionCollection.MAIN_CLOSE_TAB({tabId:this.tabId,fromBtn: true});
				});
			}
			return conf;
		},

		////////////////////
		// reload
		////////////////////
		//
		// Method for reloading a tab. This preserves all of the controllers and UI elements, but 
		// flushes the cached data and reloads it. If this is the current tab, the reload is completed, 
		// but if it is not final loading procedures (tapping the NetworkController to get a new model,
		// re-attaching Canvas event handlers) is deferred until the tab is selected again.
		//
		reload: function(isCurrTab,params) {
			
	    	var self=this;
	    	this._data = params.data;
	    	
	    	this.loadIdData(params);
	    	
	    	// If this was never loaded, we just need to refresh the tree data; a normal load call will take
    		// care of the rest.
	    	if(!this._loaded) {
	    		
	    		this._modelTree.refresh(this._data);
	    			    		
	    		return null;
	    	}
	    	
	    	this._asyncLoader = new Deferred();

			require([
		         BTMT_NETWORK_CONTROLLER,"controllers/ArtboardController","controllers/ActionCollection"
		         ,"views/BioTapestryCanvas","controllers/XhrController","static/XhrUris"
	         ],
			function(NetworkController,ArtboardController,ActionCollection,BtCanvas,XhrController,XhrUris){
			
				var currentModelState = null;
				var myGrnMC = NetworkController.getModelController(self.tabId);
				
				BtCanvas.toggleWatchEvents(self.cnvContainerNodeId_);
				BtCanvas.removeResizingAspect(self.cnvContainerNodeId_);
	 
				myGrnMC.reloadController().then(function(){
					XhrController.xhrRequest(XhrUris.modeltree(self.tabId)).then(function(treeData){
						
						self._data = treeData;
						
						myGrnMC.buildModels(
	    					treeData.root.childNodes
	    					,"root"
	    					,{hasImages:treeData.hasImages,hasOverlays:treeData.hasOverlays,timeSliderDef: treeData.timeSliderDef}
						);
						
						self._modelTree.refresh(treeData);
						
						var myAbC = ArtboardController.getArtboardController(self.cnvContainerNodeId_);
						myAbC.reload();
						myAbC.setFullBounds(treeData.allModelBounds);
						myAbC.set("initialZoomMode_",treeData.firstZoomMode);
						myAbC.set("navZoomMode_",treeData.navZoomMode);
						// This first model set is to move the GrnModelController into a valid state without triggering
						// any associated redraws
						
						var finishReload = function() {
							myGrnMC.setModel("default_").then(function(){
								myGrnMC.getCurrentModel().then(function(model){
									BtCanvas.toggleWatchEvents(self.cnvContainerNodeId_);
									myGrnMC.set("currentModel_",myGrnMC.get("currentModel_"));
									BtCanvas.canvasReady(self.cnvContainerNodeId_).then(function(){
										ActionCollection["MAIN_ZOOM_TO_CURRENT_MODEL"]({});
										BtCanvas.makeResizingAspect(self.cnvContainerNodeId_);
									});
								},function(err){
									console.error("[ERROR] ",err);
									self._asyncLoader.reject(err);
								});								
								
							},function(err){
								console.error("[ERROR] ",err);
								self._asyncLoader.reject(err);
							});								
						};
						
						if(isCurrTab) {							
							finishReload();
						} else {

							// Otherwise, set it up as an on-select which will fire only once and then remove itself
							var onSelect;
							onSelect = self.getParent().watch("selectedChildWidget",function(name,oldPane,newPane){
								if(newPane.tabId === self.tabId) {
									finishReload();
									onSelect.remove();
								}
							});
						}
						self._asyncLoader.resolve();
					});							
				});
			});
			return this._asyncLoader.promise;
		}, // reload
		
		////////////////////
		// refresh
		////////////////////
		//
		// Method for refreshing a loaded tab whose session has expired. This preserves all of the
		// controllers and UI elements, but flushes the cached data and reloads it. If this is the 
		// current tab, the refresh is completed, but if it is not it is deferred until the tab is 
		// selected again. Unlike in a reload, a refresh does clear out the currently displayed 
		// model data.
		//
		refresh: function(isCurrTab) {
			
	    	var self=this;
	    	this._asyncLoader = new Deferred();

			require([
		         BTMT_NETWORK_CONTROLLER,"controllers/ArtboardController","controllers/ActionCollection"
		         ,"views/BioTapestryCanvas","controllers/XhrController","static/XhrUris"
	         ],
			function(NetworkController,ArtboardController,ActionCollection,BtCanvas,XhrController,XhrUris){
			
			var currentModelState = null;
			var myGrnMC = NetworkController.getModelController(self.tabId);
			var overlay = ArtboardController.getArtboardController(self.cnvContainerNodeId_).get("overlay_");
			var currentModelId = myGrnMC.get("currentModel_") || "default_";
			
			BtCanvas.toggleWatchEvents(self.cnvContainerNodeId_);
			BtCanvas.removeResizingAspect(self.cnvContainerNodeId_);
 
			myGrnMC.getCurrentModel().then(function(model){
				currentModelState = (model ? model.get("state_") : null);
			},function(err){
				console.error("[ERROR] In refreshTab:",err);
				self._asyncLoader.reject(err);
			}).then(function() {
				myGrnMC.reloadController(true).then(function(){
					XhrController.xhrRequest(XhrUris.modeltree(self.tabId)).then(function(treeData){
						
						myGrnMC.buildModels(
	    					treeData.root.childNodes
	    					,"root"
	    					,{hasImages:treeData.hasImages,hasOverlays:treeData.hasOverlays,timeSliderDef: treeData.timeSliderDef}
						);
						
						self._modelTree.refresh(treeData);
						
						var myAbC = ArtboardController.getArtboardController(self.cnvContainerNodeId_);
						myAbC.reload(true);
						myAbC.setFullBounds(treeData.allModelBounds);
						myAbC.set("initialZoomMode_",treeData.firstZoomMode);
						myAbC.set("navZoomMode_",treeData.navZoomMode);
						// This first model set is to move the GrnModelController into a valid state without triggering
						// any associated redraws
						myGrnMC.set("currentModel_",currentModelId,currentModelState);
						
						var finishRefresh = function() {
							BtCanvas.toggleWatchEvents(self.cnvContainerNodeId_);
							// Now that everything is ready to go, tap the model setting again to fire off all relevant
							// watch events; this will also apply the old overlay (if there was one)
							myGrnMC.set("currentModel_",currentModelId,currentModelState,overlay);
							BtCanvas.canvasReady(self.cnvContainerNodeId_).then(function(){
								ActionCollection["MAIN_ZOOM_TO_CURRENT_MODEL"]({drawingAreaId: self.cnvContainerNodeId_});
								BtCanvas.makeResizingAspect(self.cnvContainerNodeId_);
							});									
						};
						
						myGrnMC.getCurrentModel().then(function(){
							// If this is a refresh for the current tab, just finish it off
							if(isCurrTab) {
								finishRefresh();
							} else {
								// Otherwise, set it up as an on-select which will fire only once and then remove itself
								var onSelect;
								onSelect = self.getParent().watch("selectedChildWidget",function(name,oldPane,newPane){
									if(newPane.tabId === self.tabId) {
										finishRefresh();
										onSelect.remove();
									}
								});										
							}
							self._modelTree.selectNodeOnTree(currentModelId);
							self._asyncLoader.resolve();
						},function(err){
							console.error("[ERROR] Unable to get the current model:",err);
							self._asyncLoader.reject(err);
						}); 
					});							
				})});	
			});
			return this._asyncLoader.promise;
		}, // refresh
				
		/////////////////////
		// load
		////////////////////
		//
		// Final loading can't be done until the tab is brought up for the first time.
		// This method allows for completion of artboard generation and attachment.
		//
		load: function(isRefresh,isReload){
				    	
	    	var self=this;

	    	var data = this._data;
	    	
	    	// If this is a new load, or an old one which failed, we're
	    	// effectively reloading, so we need to prep _asyncLoader
	    	if(!this._asyncLoader || this._asyncLoader.isRejected()) {
		    	this._asyncLoader = new Deferred();
	    	} else {
	    		if(this._asyncLoader.isResolved()) {
	    			require([BTMT_NETWORK_CONTROLLER,"controllers/StatesController"],function(NetworkController,StatesController){
	    				// Tap the Network Model Controller to instigate a model change, so it will relay that 
	    				// to the server and trigger any relevant state changes
	    				// Make sure to carry forward the past pathing state
	    				var myGrnMC = NetworkController.getModelController(self.tabId);
	    				myGrnMC.set("currentModel_",myGrnMC.get("currentModel_"),null,!!StatesController.getState("ON_PATH",self.tabId_));	
	    			});	
	    		}
	    		return this._asyncLoader.promise;
	    	}
	    	
			require([BTMT_NETWORK_CONTROLLER,"controllers/ArtboardController","controllers/StatesController"],
					function(NetworkController,ArtboardController,StatesController){
				
				var myGrnMC = NetworkController.getModelController(self.tabId);
				
				if(isRefresh || isReload) {
					myGrnMC.reloadController();
					myGrnMC.set("currentModel_","default_");
				}
				
				myGrnMC.buildModels(
					data.root.childNodes
					,"root"
					,{hasImages:data.hasImages,hasOverlays:data.hasOverlays,timeSliderDef: data.timeSliderDef}
				);
				
				myGrnMC.getCurrentModel().then(function(model){
					var abParams = {
						completeModelBounds: data.allModelBounds,
						initialZoomMode: data.firstZoomMode,
						navZoomMode: data.navZoomMode,
	        			cnvWrapperDomNodeId: CANVAS_WRAPPER_NODE_ID_BASE+"_"+self.tabId,
	        			cnvContainerDomNodeId: self.cnvContainerNodeId_,
	        			floatingArtboard:false,
	        			delayedLoad: false,
	        			networkModelController: BTMT_NETWORK_CONTROLLER,
						tabId: self.tabId
	    			};
					
	        		myGrnMC.set("cnvContainerNodeId_",self.cnvContainerNodeId_);
	        		
	        		var grnArtboardController = ArtboardController.makeArtboardController(abParams);
	        		
	        		grnArtboardController.attachArtboard({
						zoomStates: {inState: "MAIN"+StatesController.zoomIn,outState: "MAIN"+StatesController.zoomOut},
						id: "btCanvas_" + utils.makeId(),
						attachLeftClickEvent: true,
						attachRightClickEvent: true,
						attachTooltipEvent: true,
						attachDragSelectionEvent: true,
						attachHoverEvents: true,
						drawWorkspace: true,
						primaryCanvas: true
					}).then(function(btArtboard){
						self.own(btArtboard);
						self._asyncLoader.resolve().then(function(){
							// Never load more than once
					    	self._loaded = true;
						});
	        		});	
				},function(err){
					console.error("[ERROR] Rejecting tab load due to getModelController rejection:",err);
					self._asyncLoader.reject(err);
				});
			});
    		
			return this._asyncLoader.promise;
		}, // load
		
		loadIdData: function(params) {
			this.tabId = params.dbID;
			params.tnd.title = params.tnd.title || ("Model "+this.tabId); 
			this.set("title",params.tnd.title);
			var tooltip = params.tnd.desc || params.tnd.fullTitle || params.tnd.title;
			// Strip all HTML and any escape codes
    		this.set("tooltip", tooltip.replace(/<[^<]+>/ig,"").replace(/&[^&]+;/ig,""));
		},
	
		///////////////////////////
		// constructor
		//////////////////////////
		//
		// Required params:
		// 	data - Object containing the ModelTree's definition
		// 	cnvContainerNodeId - The DOM node ID of DOM element which will house the Canvas; this is 
		// 		will be passed down to Artboard- and ModelControllers to give a unified attachment
		// 		and ID point for the Canvas element attached to this BTModelTab
		//
		constructor: function(params) {
			
			this._asyncTabBuilder = new Deferred();
			this.cnvContainerNodeId_ = params.cnvContainerNodeId;
			this.loadIdData(params);
			this._loaded = params.loaded || false;
			this._data = params.data;
			
			this.inherited(arguments);
		}
	});

});
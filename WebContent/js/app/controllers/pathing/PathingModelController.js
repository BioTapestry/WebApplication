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
    "models/GrnModel",
    "static/XhrUris",
    "controllers/XhrController",
    "controllers/ActionCollection",
    "app/utils",
    "dojo/_base/declare",
    "dojo/Stateful",
    "dojo/Deferred",
    "dojo/_base/array",
    "dojo/_base/lang",
	"dojo/domReady!"
],function(
	GrnModel,
	XhrUris,
	xhrController,
	ActionCollection,
	utils,
	declare,
	Stateful,
	Deferred,
	DojoArray,
	lang
){
	
	// model JSON is cached for 5 minutes
	var BASE_CACHE_EXPIRATION = 300000;
	
	var TITLE_BASE = "Showing Parallel Paths: ";
	
	var NO_PATH_TITLE = "Show Parallel Paths";
		
	var PathingModelController = declare([Stateful],{
		
		cnvContainerDomNodeId_: null,
		_cnvContainerDomNodeId_Getter: function() {
			return this.cnvContainerDomNodeId_;
		},
		_cnvContainerDomNodeId_Setter: function(val) {
			this.cnvContainerDomNodeId_ = val;
		},
		
		postBuildLoadElements_: null,
		_postBuildLoadElements_Getter: function() {
			return this.postBuildLoadElements_;
		},
		_postBuildLoadElements_Setter: function(val) {
			this.postBuildLoadElements_ = val;
		},
		
		// Our Deferred objects, used to register callbacks against data which is
		// loaded asynchronously
		asyncModelLoader_: null,
		
		// Map of all cached GrnModel objects
		PathModels_: null,
		
		// The String label corresponding to the model selected in the ModelTree and 
		// displayed on the drawing area
		currentModel_: null,	
		_currentModel_Getter: function() {
			return this.currentModel_;
		},
		_currentModel_Setter: function(newModel) {
			this.currentModel_ = newModel;
		},
		

		// Until the window has loaded all of the current, specific model's data
		// we can't load a lot of the widgets. Run this event after we have a 
		// model to provide information
		_postBuildLoad: function(pathData) {
			var self=this;
			require(["dijit/registry","dijit","dojo/on","dojo/keys"],function(registry,dijit,on,keys){
				for(var i in self.postBuildLoadElements_) {
					if(self.postBuildLoadElements_.hasOwnProperty(i)) {
						var element = self.postBuildLoadElements_[i];
						switch(element) {
							case "pathList":
								if(pathData.resultsMap[element]) {
									var widget = registry.byId(i);
									var myCurrSelex = Object.keys(widget.selection);	
									var list = new Array();
									DojoArray.forEach(pathData.resultsMap[element],function(entry){
										for(var i in entry.allSegs) {
											if(entry.allSegs.hasOwnProperty(i)) {
												DojoArray.forEach(entry.allSegs[i],function(seg){
													utils.stringToBool(seg);
												});
											}
										}
										list.push(entry);
									});
									widget.refresh();
									widget.renderArray(list);
									if(widget.selectedIndex !== null && widget.selectedIndex !== undefined) {
										if(!widget.isInited) {
											widget.isInited = true;
											on.once(widget.topLevelContainer, "built", self.makeBuiltCallback_(i,function(widgetId){
												var widget = registry.byId(widgetId);
												// We don't want to try to select the row until the display is done loading, which won't wrap up until
												// the pathing model is ready, so register it against the asyncModelLoader_ Deferred
												self.asyncModelLoader_.promise.then(function(){
													require(["dojo/query"],function(query) {
														var selexNode = query(".dgrid-row", widget.domNode)[widget.selectedIndex];
														widget.select(selexNode);
													});
												});
											}));
											
											// Various loading events can steal focus off the grid, and it's difficult to tell when those
											// events will actually complete, or in what order. To get around this, after opening the selectedIndex
											// has 'pseudo' focus. We accomplish this by placing an event on the first down arrow we encounter which will
											// apply focus to the next row, thus achieving actual focus.
											on.once(widget.topLevelContainer, "keypress", self.makeBuiltCallback_(i,function(widgetId,e){
												if(e.charOrCode === keys.DOWN_ARROW) {
													var widget = registry.byId(widgetId);
													// We don't want to try to select the row until the display is done loading, which won't wrap up until
													// the pathing model is ready, so register it against the asyncModelLoader_ Deferred
													self.asyncModelLoader_.promise.then(function(){
														require(["dojo/query"],function(query) {
															var dgridRows = query(".dgrid-row", widget.domNode);
															// If the selectedIndex (initial selection of the widget) doesn't equal the current
															// widget focus, do NOT perform this forced focus; let the widget handle it
															if(dgridRows[widget.selectedIndex] === widget._focusedNode) {
																var selexNode = dgridRows[widget.selectedIndex+1];
																widget.focus(selexNode);															
															}
														});
													});
												}
											}));
										} else {
											require(["dojo/query"],function(query) {
												// On a new grid, it's possible the entry we previously had selected
												// is no longer available. if this is the case, select the first one. If not,
												// select the one we previously had selected.
												var gridRows = query(".dgrid-row", widget.domNode);
												var select = 0;
												if(gridRows.length > myCurrSelex[0]) {
													select = myCurrSelex[0];
												}
												var selexNode = query(".dgrid-row", widget.domNode)[select];
												widget.focus(selexNode);
												widget.select(selexNode);
											});
										}
									}
								}
								break;
							case "maxDepth":
								var widget = registry.byId(i);
								if(pathData.resultsMap.longerOK === widget.get("longerOK")) {
									var depths = {};
									for(var i = 1; i <= pathData.resultsMap[element]; i++) {
										depths[i] = i;
									}
									// if a 'maxPath' i.e. selected value was provided, select it, because the 
									// default selected value might not be the same, and will otherwise be used
									// once building the combo box is done.
									widget.set("selValue",pathData.resultsMap.maxPath);
									widget.parent_.buildValues(depths);
								}
								break;
							case "pathMsg":
								if(pathData.resultsMap.pathMsg) {
									var widget = registry.byId(i);
									widget && widget.set("disabledContent_",pathData.resultsMap.pathMsg);
								}
								break;
							default:
								break;
						}
					}
				}
			});			
		},
		
		// Request the given model from the server
		_fetchModel: function(pathInfo) {
			var loadAsync = new Deferred();
			
			ActionCollection["OTHER_PATH_MODEL_GENERATION"]({
				pathSrc: pathInfo.pathSrc, 
				pathTrg: pathInfo.pathTrg, 
				pathDepth: pathInfo.pathDepth, 
				pathInit: pathInfo.pathInit ? pathInfo.pathInit : false
			}).then(function(response){
				if(response.resultsMap.havePath) {
					loadAsync.resolve(response);	
				} else {
					loadAsync.reject(response);
				}
			});
			
			return loadAsync.promise;
		},
		
		getModel: function(model) {
			var asyncLoader = new Deferred();
			var self=this;

			var modelId = model.modelId_;
			var pathInfo = model.pathInfo;
			if(!this.PathModels_[modelId]) {
				this._fetchModel(pathInfo).then(function(modelData){
					self.loadModel(pathInfo,modelData);
					asyncLoader.resolve(self.PathModels_[modelId]);
				});
			} else {
				asyncLoader.resolve(this.PathModels_[modelId]);
			}

			return asyncLoader.promise;
		},
		
		loadModel: function(pathInfo,pathData) {
			var self=this;
			var modelId = pathInfo.pathSrc+">"+pathInfo.pathTrg+":"+pathInfo.pathDepth;
			if(!this.PathModels_[modelId]) {
				this.PathModels_[modelId] = new GrnModel({
					type_: "path",
					vfgParent_: null,
					modelId_: modelId,
					expiry_: Date.now() + BASE_CACHE_EXPIRATION,
					state_: 0,
					message_: null,
					pathInfo: pathInfo
				});
			}
			
			this.PathModels_[modelId].drawingObjects_[this.PathModels_[modelId].state_] = pathData.resultsMap.pathRenderingMap;
			this.PathModels_[modelId].drawingObjects_[this.PathModels_[modelId].state_].tooltips = pathData.resultsMap.pathTips;
			this.PathModels_[modelId].expiry_ = Date.now() + BASE_CACHE_EXPIRATION;
			
			if(self.postBuildLoadElements_) {
				self._postBuildLoad(pathData);
			}
		},			

		// helper method for registering a callback against a given widget's 'built' event
		makeBuiltCallback_: function(widgetId,callback) {
			return function(e) {
				callback(widgetId,e);
			}
		},
		
		// Get the GrnModel object which is named in currentModel_
		// as a promise from a Deferred(); this allows a request for 
		// the model to not block the UI if the model is still loading
		getCurrentModel: function() {
			return this.asyncModelLoader_.promise;
		},	
		
		// Set up this watcher for the currentModel_ property
		setWatch: function(watchThis,thisWatcher) {
			return this.watch(watchThis,thisWatcher);
		},
		
		// Set the model based on a pathInfo block from the server
		// will also set the currentModel_ property, which will trigger
		// any watch callbacks
		setModel: function(pathInfo) {
			var self=this;
			this.asyncModelLoader_ = new Deferred();
			var modelId = pathInfo.pathSrc+">"+pathInfo.pathTrg+":"+pathInfo.pathDepth;

			// Paths must always be fetched, due to supplying widget fill information
			self._fetchModel(pathInfo).then(function(pathData){
				if(pathData.resultsMap.maxPath !== pathInfo.pathDepth) {
					pathInfo.pathDepth = pathData.resultsMap.maxPath;
					modelId = pathInfo.pathSrc+">"+pathInfo.pathTrg+":"+pathInfo.pathDepth;
				}
				self.loadModel(pathInfo,pathData);
				self.asyncModelLoader_.resolve(self.PathModels_[modelId]);
			},function(err){
				err.modelId = modelId;
				self._postBuildLoad(err);
				self.asyncModelLoader_.reject(err.resultsMap);
			});
			
			this.set("currentModel_",modelId);
			return this.asyncModelLoader_.promise; 
		},
				
		// Parse the model ID given and then determine if it is currently cached by the PathingModelController
		drawingObjIsCached: function(modelId) {
			return !!(this.PathModels_[modelId] && this.PathModels_[modelId].getCached(this.PathModels_[modelId].state));
		},
		
		// If we are invalidating the cache (cacheStatus === false), we also need the Canvas to tell the Renderer to
		// empty its cache for these models.
		//
		// TODO: watch condition from the Renderer to the GrnModel's cache status?
		setCachedInRenderer: function(modelId,cacheStatus) {
			this.PathModels_[modelId] && this.PathModels_[modelId].setCached(this.PathModels_[modelId].state,cacheStatus);
			if(!cacheStatus) {
				require(["views/BioTapestryCanvas"],function(BTCanvas){
					BTCanvas.getBtCanvas("path").flushRendererCache([modelId]);
				});
			}
		},
		
		// Set the title of the window/dialog
		setTitle: function(src,trg) {
			var self=this;
			require(["controllers/pathing/PathingController","views/BioTapestryCanvas"],function(BTPathingController,BTCanvas){
				if(!src && !trg) {
					BTPathingController.SET_TITLE({title: NO_PATH_TITLE});
				} else {
					BTCanvas.getEntityNames(self.cnvContainerDomNodeId_,[src,trg]).then(function(entityNames){
						BTPathingController.SET_TITLE({title: TITLE_BASE + entityNames[src]+" to "+entityNames[trg]});	
					});
				}
			});
		},
		
		/////////////////////////////////////
		// Constructor
		/////////////////////////////////////
		
		constructor: function() {
			this.PathModels_ = {};
		}
	});
	
	// Singleton
	var BioTapPathingModelController = new PathingModelController();
	
	return BioTapPathingModelController;

});
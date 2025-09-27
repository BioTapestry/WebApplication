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
    "./XhrController",
    "dojo/_base/declare",
    "dojo/Stateful",
    "dojo/Deferred",
    "dojo/_base/array",
    "dojo/_base/lang",
    "dojo/debounce",
	"dojo/domReady!"
],function(
	GrnModel,
	XhrUris,
	xhrController,
	declare,
	Stateful,
	Deferred,
	DojoArray,
	lang,
	debounce
){
	
	// model JSON is cached for 5 minutes
	var BASE_CACHE_EXPIRATION = 300000;
	
	var DYNAMIC_PROXY_PREFIX = "{DiP}";
		
	var GrnModelController = declare([Stateful],{
		
		cnvContainerNodeId_: null,
		
		navZoomMode_: null,
		
		initialZoomMode_: null,
		
		completeModelBounds_: null,
		
		sessionReloading_: false,
		
		hasImages_: false,
		hasOverlays_: false,
		
		// Our Deferred objects, used to register callbacks against data which is
		// loaded asynchronously
		asyncModelLoader_: null,
		asyncGrnModelBuilder_: null,
		asyncLowerLeftLoader_: null,
		
		// Map of all cached GrnModel objects
		GrnModels_: null,
		
		// The String label corresponding to the model selected in the ModelTree and 
		// displayed on the drawing area
		currentModel_: null,
		_currentModel_Getter: function() {
			return this.currentModel_;
		},
		// Any time the model is set, a large number of events take place
		_currentModel_Setter: function(modelId,state,overlay,pathSet) {
			// If this change in model is not part of a user path, but we were on
			// one, clear out the path state
			require(["controllers/StatesController","dijit"],function(StatesController,dijit){
				if(!pathSet && StatesController.getState("ON_PATH")) {
					var pathCombo = dijit.byId(StatesController.getState("ON_PATH"));
					pathCombo.set("value", "No Path");
				}
			});
			
			var self=this;
			
			var oldModel = this.currentModel_;
			var isStateChange = (this.GrnModels_[oldModel] && oldModel === modelId && state !== this.GrnModels_[oldModel].state_);
			
			this.asyncModelLoader_ = new Deferred();
			this.asyncLowerLeftLoader_ = new Deferred();
			
			this._setModel(modelId,state,overlay).then(function(confirmation){
				if(self.currentModel_ === "default_" || modelId === "default_") {
					self.currentModel_ = self.splitModelId(confirmation.currModel).modelId;
					if(!self.GrnModels_[self.currentModel_].vfgParent_) {
						self.GrnModels_[self.currentModel_] = self.GrnModels_.default_;
						self.GrnModels_[self.currentModel_].modelId_ = self.currentModel_;	
					}
					delete self.GrnModels_.default_;
					require(["controllers/ModelTreeController"],function(ModelTreeController){ 
						ModelTreeController.selectNodeOnTree(confirmation.currModel);	
					});	
				}
				
				require(["controllers/WindowController"],function(WindowController){
					WindowController.closeWindow("pathing");
				});
				
				if(confirmation.currModel === confirmation.requested) {
					self.currentModel_ = modelId;
				} else if(confirmation.requested !== "default_") {
					throw new Error("[ERROR] Requested model and confirmed model do not match!");
				}
				
				var model = self.GrnModels_[self.currentModel_];

				// If we have an expired model, or don't have it, we need to fetch, build, and load it.
				if(!(model && model.drawingObjects_ &&  model.drawingObjects_[model.state_]
					&& (model.expiry_ > Date.now()))) {
					
					// Explicitly fetch this model's JSON to prevent any confusion
					self._fetchModel(model.getModelId()).then(function(modelData){
						if(model.getModelId() !== modelData.modelID) {
							self.asyncModelLoader_.reject("[ERROR] Model mismatch! Requested " + model.getModelId() + " but got " + modelData.modelID);	
						}
						self.asyncGrnModelBuilder_.promise.then(function(){
							self.loadModel_(self.currentModel_,modelData,confirmation);	
							
							// Model messages impact other elements of the layout, so
							// register their update to trigger *after* the load is complete
							require(["views/GrnModelMessages"],function(GrnMsgs){
								self.asyncModelLoader_.promise.then(function(){
			    					GrnMsgs.removeStickies();
			    					GrnMsgs.popMessage();
									GrnMsgs.setMessage({msg: model.message_, id: model.modelId_},"MODEL");	
								});
							});
							self.asyncModelLoader_.resolve(model);				
						});
						
					},function(err){
						self.asyncModelLoader_.reject(err);
					});
				// Otherwise, we just resolve with it, and set the model message (if there is one)
				} else {
					require(["views/GrnModelMessages"],function(GrnMsgs){
    					GrnMsgs.removeStickies();
    					GrnMsgs.popMessage();
						GrnMsgs.setMessage({msg: model.message_, id:model.modelId_},"MODEL");
					});
					self.asyncModelLoader_.resolve(model);
				}

				// Once the model is loaded, fill in the lower left components (if there are any)
				// TODO: make this its own method?
				self.asyncModelLoader_.promise.then(function(model) {
					require(["widgets/LowerLeftComponents"],function(LowerLeftComponents){
						if(model.type_ === "DYNAMIC_PROXY") {
							if(oldModel !== modelId || self.sessionReloading_) {
								LowerLeftComponents.clear("timeSlider",true);
								
								LowerLeftComponents.load("timeSlider",{
									statemin: model.stateMin_,
									statemax: model.stateMax_,
									statelength: model.states_.length,
									currstate: model.state_,
									model: self.currentModel_
								},true);
							} else {
								self.syncTimeSlider(model.state_);
							}
						} else {
							LowerLeftComponents.disable("timeSlider");
						}
						
						if(model.annotationImages_[model.state_]) {
							LowerLeftComponents.load("modelAnnotImg",{modelId: model.getModelId()});
						} else {
							LowerLeftComponents.disable("modelAnnotImg");
						}	
						
						if(model.overlayDefs_ && model.overlayDefs_.length > 0) {
							// Setting an onPath_ property allows us to flag the path status of this overlay setting 
							LowerLeftComponents.getModule("overlay").setProperty("onPath_",pathSet);
							LowerLeftComponents.load("overlay",{defs: model.overlayDefs_,modelId: model.modelId_, pathSet: pathSet});
							LowerLeftComponents.enable("overlay");
							if(overlay) {
								LowerLeftComponents.getModule("overlay").setOverlay(overlay);
							} else {
								isStateChange && LowerLeftComponents.getModule("overlay").applyCurrentOverlay();
							}
						} else {
							LowerLeftComponents.getModule("overlay") && LowerLeftComponents.getModule("overlay").setProperty("onPath_",pathSet);
							LowerLeftComponents.disable("overlay",{pathSet: pathSet});
						}
						
						if(self.sessionReloading_) {
							self.sessionReloading_ = false;
						}
						self.asyncLowerLeftLoader_.resolve();
					});
				},function(err){
					console.error(err);
				});		
			},function(err){
				if(err.status === "NEW_SESSION") {
					self.asyncModelLoader_ = new Deferred();
					self.asyncModelLoader_.resolve(self.GrnModels_[self.currentModel_]);
					require(["controllers/ActionCollection"],function(ActionCollection){
						ActionCollection.CLIENT_WARN_RESTART_SESSION();
					});
				} else {
					self.asyncModelLoader_.reject(err);
				}
			});
		},
								
		/////////////////////////////////
		// loadModel_
		////////////////////////////////
		//
		// Given a modelID, drawing data object, and the confirmation response from the
		// server, load the drawing object (and model annotation image, if provided)
		// onto the corresponding GrnModel object.
		//
		loadModel_: function(modelId,modelData,confirmation) {
			var self=this;
			var model = this.GrnModels_[modelId];
			
			if(confirmation && confirmation.modelAnnotImage) {
				model.annotationImages_[model.state_] = confirmation.modelAnnotImage;
			}
			
			model.drawingObjects_[model.state_] = modelData;
										
			model.message_ = (modelData.displayText.modelText ? modelData.displayText.modelText : "");
			
			// load any lower component necessities
			
			model.expiry_ = Date.now() + BASE_CACHE_EXPIRATION;			
		},
		
		//////////////////////////////////
		// getSubmodels
		////////////////////////////////
		//
		// Get all of the submodels of the given parent VfG id
		//
		getSubmodels: function(id) {
			var submodels = null;
			for(var i in this.GrnModels_) {
				if(this.GrnModels_.hasOwnProperty(i)) {
					var model = this.GrnModels_[i];
					if(model.vfgParent_ === id) {
						if(!submodels) {
							submodels = [];
						}
						submodels.push(i);
					}
				}
			}
			return submodels;
		},		
		
		//////////////////////////////
		// setFullBounds
		/////////////////////////////
		//
		// Special set moethod for the completeModelBounds_ object which
		// translates server-side coordinate naming conventions to 
		// webclient names
		//
		setFullBounds: function(bounds) {
			this.completeModelBounds_ = {
				center_x: bounds.centerX,
				center_y: bounds.centerY,
				min_x: bounds.minX,
				min_y: bounds.minY,
				max_x: bounds.maxX,
				max_y: bounds.maxY
			};
		},
		
		///////////////////////////////
		// setModelOverlay
		//////////////////////////////
		//
		// Overlay values are set via the Overlay widget, which will then update
		// the ArtboardController with the new value
		//
		setModelOverlay: function(overlayVal) {
			var self=this;
			// Overlays are not relevant to DYNAMIC_PROXY models, so don't bother
			// if this is a DYNAMIC_PROXY
			this.asyncModelLoader_.promise.then(function(){
				if(self.GrnModels_[self.currentModel_].get("type_") !== "DYNAMIC_PROXY") {
					require(["widgets/LowerLeftComponents"],function(LowerLeftComponents){
						self.asyncLowerLeftLoader_.promise.then(function(){
							LowerLeftComponents.setValue("overlay",overlayVal);
						});
					});
				}
			});			
		},
		
		///////////////////////////
		// setModel
		//////////////////////////
		//
		// Set the model and wait on the asyncModelLoader to resolve
		setModel: function(modelId,state,overlay,onPath) {
			this.set("currentModel_",modelId,state,overlay,onPath);
			return this.asyncModelLoader_.promise;
		},
		
		///////////////////////////////////
		// syncTimeSlider
		///////////////////////////////////
		//
		// Synchronize the time slider's displayed value, because we had a state
		// change come from another source
		//
		syncTimeSlider: function(state) {
			var self=this;
			// States are not relevant if a model is not a dynamic instance
			// proxy and will default to 0, so don't try to adjust the 
			// TimeSlider value setting unless we actually need to
			this.asyncModelLoader_.promise.then(function(){
				if(self.GrnModels_[self.currentModel_].get("type_") === "DYNAMIC_PROXY") {
					require(["widgets/LowerLeftComponents"],function(LowerLeftComponents){
						self.asyncLowerLeftLoader_.promise.then(function(){
							if(LowerLeftComponents.getValue("timeSlider") !== state) {
								LowerLeftComponents.setValue("timeSlider",{value:state,withoutOnChange:true});
							}
						});
					});
				}
			});
		},
		
		///////////////////////////////////
		// getModel
		///////////////////////////////////
		//
		// Get a copy of the GrnModel object corresponding to
		// this modelId. If we don't have that model yet, or
		// it has expired, request a copy from the server. Because
		// this can be an asynchronous event, we return a Deferred.promise
		// for registering a callback
		//
		getModel: function(modelId) {
			var asyncLoader = new Deferred();
			var self=this;

			if(!(this.GrnModels_[modelId] && this.GrnModels_[modelId].drawingObjects_ 
				&&  this.GrnModels_[modelId].drawingObjects_[this.GrnModels_[modelId].state_]
				&& (this.GrnModels_[modelId].expiry_ > Date.now()))) {
			
				this._fetchModel(modelId).then(function(modelData){
					self.asyncGrnModelBuilder_.promise.then(function(){
						self.loadModel_(modelId,modelData);
						asyncLoader.resolve(self.GrnModels_[modelId]);
					});
				});
			} else {
				asyncLoader.resolve(this.GrnModels_[modelId]);
			}

			return asyncLoader.promise;
		},
		
		
		/////////////////////////////////////
		// reloadController
		/////////////////////////////////////
		//
		// Flush the controller's state and reload it. If this is a new session (as opposed to a new file),
		// but the file is not changing, retain the current model.
		//
		reloadController: function(isNewSession) {
			
			this.sessionReloading_ = true;
			this.asyncModelLoader_ = null;
			this.asyncGrnModelBuilder_ = null;
			
			var asyncReload = new Deferred();
			
			var self=this;
			
			var models = Object.keys(self.GrnModels_);
			
			// Save out the current model, because we're going to reload that one
			if(isNewSession) {
				models.splice(models.indexOf(self.currentModel_),1);
			}
			
			require(["views/BioTapestryCanvas","widgets/LowerLeftComponents"],function(BTCanvas,LowerLeftComponents){
				if(!isNewSession) {
					LowerLeftComponents.clearAll();
				}
				BTCanvas.getBtCanvas(self.cnvContainerNodeId_).flushRendererCache(models);
				self.GrnModels_ = {
					default_: new GrnModel({modelId_: "default_",state_: 0})
				};
				asyncReload.resolve();
			});	
			
			return asyncReload.promise;
		},
		
		
		// Get the GrnModel object which is named in currentModel_
		// as a promise from a Deferred(); this allows a request for 
		// the model to not block the UI if the model is still loading
		getCurrentModel: function() {
			return this.asyncModelLoader_.promise;
		},	
		
		// Set a watch callback on a property of this GrnModelController
		setWatch: function(thisProp,thisWatcher) {
			return this.watch(thisProp,thisWatcher);
		},
				
		expireAllAndReloadCurrent: function() {
			var self=this;
			for(var i in self.GrnModels_) {
				if(this.GrnModels_.hasOwnProperty(i)) {
					this.GrnModels_[i].expiry_ = 0;
					this.setCachedInRenderer(i, false);
				}
			}	
			require(["controllers/ArtboardController"],function(ArtboardController){				
				ArtboardController.getArtboardController(self.cnvContainerNodeId_).expireCache();
				self.set("currentModel_",self.currentModel_);
			});	
		},
		
		/////////////////////////////////
		// deleteModel
		/////////////////////////////////
		//
		// Delete a GrnModel from the set
		//
		deleteModel: function(modelId) {
			delete this.GrnModels_[modelId];
		},
		
		///////////////////////////////////
		// buildModels
		////////////////////////////////////
		//	
		// Bootstrap the GrnModelController's GrnModels_ object, which is a list of all
		// models available in the Model Tree.
		//
		buildModels: function(modelArray,parentId,networkParams){
						
			var self=this;
			// Only build the model set if this is an initial loading of a model array; after that
			// the model set is managed by the this controller in response to user actions (deleting models,
			// adding models, etc.)
			if(!this.asyncGrnModelBuilder_) {
				this.asyncGrnModelBuilder_ = new Deferred();
				this.asyncLowerLeftLoader_ = new Deferred();
				var hasDynamicProxy = false;
				DojoArray.forEach(modelArray,function(model){
					if(self._buildThisModel(model,parentId)) {
						hasDynamicProxy = true;
					}
				});
				
				if(networkParams) {
					this.hasImages_ = networkParams.hasImages;
					this.hasOverlays_ = networkParams.hasOverlays;
				} else {
					this.hasImages_ = false;
					this.hasOverlays_ = false;
				}

				require(["widgets/LowerLeftComponents"],function(LowerLeftComponents){
					if(self.hasImages_) {
						LowerLeftComponents.load("modelAnnotImg");
						LowerLeftComponents.disable("modelAnnotImg");							
					} else {
						LowerLeftComponents.clear("modelAnnotImg");
					}
					
					if(self.hasOverlays_) {
						LowerLeftComponents.load("overlay");
						LowerLeftComponents.disable("overlay");
					} else {
						LowerLeftComponents.clear("overlay");
					}
					
					if(hasDynamicProxy) {
						LowerLeftComponents.load("timeSlider",{timeSliderDef: networkParams.timeSliderDef});
						LowerLeftComponents.disable("timeSlider");	
					}  else {
						LowerLeftComponents.clear("timeSlider");
					}
					
					self.asyncLowerLeftLoader_.resolve();
					self.asyncGrnModelBuilder_.resolve();
				});
			}
		},		
				
		// Parse the model ID given and then determine if it is currently cached by the GrnModelController
		drawingObjIsCached: function(modelId) {
			var modelAndState = this.splitModelId(modelId);
			return !!(this.GrnModels_[modelAndState.modelId] && this.GrnModels_[modelAndState.modelId].getCached(modelAndState.state));
		},
		
		// If we are invalidating the cache (cacheStatus === false), we also need the Canvas to tell the Renderer to
		// empty its cache for these models.
		// TODO: watch condition from the Renderer to the GrnModel's cache status?
		setCachedInRenderer: function(modelId,cacheStatus) {
			var self=this;
			var modelAndState = this.splitModelId(modelId);
			this.GrnModels_[modelAndState.modelId] && this.GrnModels_[modelAndState.modelId].setCached(modelAndState.state,cacheStatus);
			if(!cacheStatus) {
				require(["views/BioTapestryCanvas"],function(BTCanvas){
					BTCanvas.getBtCanvas(self.cnvContainerNodeId_).flushRendererCache([modelId]);
				});
			}
		},
		
		splitModelId: function(modelId) {
			var mainModelId = modelId, state = 0;
			if(modelId.indexOf(DYNAMIC_PROXY_PREFIX)===0 && (modelId.indexOf(":ALL",modelId.length-":ALL".length) === -1)) {
				mainModelId = modelId.substring(modelId.indexOf("-")+1,modelId.indexOf(":"));
				state = modelId.substring(modelId.indexOf(":")+1);
			}
			return {modelId: mainModelId, state: state};
		},
		
		_setModel: function(modelId,state,overlay) {
			var self=this;
			var loadAsync = new Deferred();
			if(!modelId) {
				modelId = this.currentModel_;
			}
						
			if(this.GrnModels_[modelId]) {
				if(state !== null && state !== undefined) {
					this.GrnModels_[modelId].set("state_",state);
				}
				
				modelId = this.GrnModels_[modelId].getModelId();
			}
			
			require(["controllers/ArtboardController","models/ClientState"],function(ArtboardController,ClientState){
				// In the case of default_, there won't be a model with an overlay to send across, so don't ask for it
				if(modelId !== "default_") {
					var abModel = ArtboardController.getArtboardController(self.cnvContainerNodeId_).getModel(modelId,true);
					if(!overlay) {
						overlay = (abModel ? abModel.get("overlay_") : null);
					}
				}
				var args = {method: "POST"};
				var clientState;
				if(overlay) {
					clientState = {clientstate:true};
					args.data = JSON.stringify(ClientState.getNewStateObject({
						currOverlay: overlay.id,
						enabledMods: overlay.enabled_modules
					}));	
					args.headers = {"Content-Type":"application/json"};
				}
				xhrController.xhrRequest(XhrUris.setModel(modelId,clientState),args).then(function(response){
					if(response.resultsMap.XPlatCurrentState) {
						require(["views"],function(BTViews){
							BTViews.updateViewStates(response.resultsMap);
						});
					}
					loadAsync.resolve(lang.mixin(response.resultsMap,{requested: modelId}));
				},function(err){
					if(err.status === "NEW_SESSION") {
						loadAsync.reject({status: err.status});
					} else {
						loadAsync.reject("Response " + err.staus + ": " + err.errormsg);
					}
				});				
			});
			

			return loadAsync.promise;			
		},
		
		_fetchModel: function(modelId) {
			var loadAsync = new Deferred();

			xhrController.xhrRequest(XhrUris.modelJson(modelId)).then(function(response){
				loadAsync.resolve(response);
			},function(err){
				if(err.status === "NEW_SESSION") {
					require(["controllers/ActionCollection"],function(ActionCollection){
						ActionCollection.CLIENT_WARN_RESTART_SESSION();
					});
				} else {
					loadAsync.reject("Response " + err.staus + ": " + err.errormsg);
				}
			});
			
			return loadAsync.promise;
		},
		
		_buildModelChildren: function(modelArray,parentId,depth) {
			var self=this;
			var hasDynamicProxy = false;
			DojoArray.forEach(modelArray,function(model){
				if(self._buildThisModel(model,parentId,depth)) {
					hasDynamicProxy = true;
				}
			});
			return hasDynamicProxy;
		},
		
		_buildThisModel: function(model,parentId,depth) {
			if(depth === undefined || depth === null) {
				depth = 0;
			}
			this.GrnModels_[model.ID] = new GrnModel({
				type_: model.modelType,
				vfgParent_: parentId,
				modelId_: model.ID,
				expiry_: Date.now() + BASE_CACHE_EXPIRATION,
				state_: 0,
				message_: null,
				overlayDefs_: model.overlayDefs,
				depth_: depth
			});
									
			if(model.modelType === "DYNAMIC_PROXY") {
				this.GrnModels_[model.ID].states_ = model.timeRange.asSortedSet;
				this.GrnModels_[model.ID].state_ = model.timeRange.min;
				this.GrnModels_[model.ID].stateMin_ = model.timeRange.min;
				this.GrnModels_[model.ID].stateMax_ = model.timeRange.max;
			}
			
			var hasDynamicProxy = false;
			
			if(model.children_.length > 0) {
				if(this._buildModelChildren(model.children_,(model.modelType !== "GENOME_INSTANCE" ? parentId : model.ID),depth+1)) {
					hasDynamicProxy = true;
				}
			}
			return (model.modelType === "DYNAMIC_PROXY") || hasDynamicProxy;
		},
		
		/////////////////////////////////////
		// Constructor
		/////////////////////////////////////
		
		constructor: function() {
			
			this.GrnModels_ = {
				default_: new GrnModel({modelId_: "default_",state_: 0})
			};
			
			// Setting the model valyue will trigger the rest of the loading
			// process
			this.set("currentModel_","default_");
		}
	});
	
	// Singleton
	var BioTapGrnModelController = new GrnModelController();

	return BioTapGrnModelController;

});
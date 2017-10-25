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
    "widgets/LowerLeftComponents",
    "./XhrController",
	"static/BTConst",
	"static/TextMessages",
    "dojo/_base/declare",
    "dojo/Stateful",
    "dijit/Destroyable",
    "dojo/Deferred",
    "dojo/_base/array",
    "dojo/_base/lang",
    "dojo/debounce",
	"dojo/domReady!"
],function(
	GrnModel,
	XhrUris,
	LowerLeftComponents,
	xhrController,
	BTConst,
	TxtMsgs,
	declare,
	Stateful,
	Destroyable,
	Deferred,
	DojoArray,
	lang,
	debounce
){
	
	var DEFAULT_TAB_ID = "DB_A";
	
	// model JSON is cached for 5 minutes
	var BASE_CACHE_EXPIRATION = 300000;
	
	var DYNAMIC_PROXY_PREFIX = "{DiP}";
		
	var GrnModelController = declare([Stateful,Destroyable],{
		
		tabId_: null,
		
		cnvContainerNodeId_: null,
				
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
		_currentModel_Setter: function(modelId,state,overlay,pathSet,sliderChange) {
			var self=this;
			// If this change in model is not part of a user path, but we were on
			// one, clear out the path state
			require(["controllers/StatesController","dijit"],function(StatesController,dijit){
				if(!pathSet && StatesController.getState("ON_PATH",self.tabId_)) {
					var pathCombo = dijit.byId(StatesController.getState("ON_PATH",self.tabId_));
					pathCombo.set("value", "No Path");
				}
			});
			
			var oldModel = this.currentModel_;
			var isStateChange = (this.GrnModels_[oldModel] && oldModel === modelId && state !== this.GrnModels_[oldModel].state_);
			
			this.asyncModelLoader_ = new Deferred();
			this.asyncLowerLeftLoader_ = new Deferred();
						
			this._setModel(modelId,state,overlay).then(function(confirmation){

				if(self.currentModel_ === "default_" || modelId === "default_") {
					var modelState = 0;
					// Check to see if this is a Model, or, a Grouping Node.
					if(confirmation.currNode && !confirmation.currModel) {
						self.currentModel_ = confirmation.currNode;
						modelId = confirmation.currNode;

					} else {
						// This ID could be a Dynamic Proxy, which will come back in model-state form and not
						// model tree form. Split it up, just in case.
						var splitId = self.splitModelId(confirmation.currModel);
						self.currentModel_ = splitId.modelId;
						modelId = splitId.modelId;
						modelState = splitId.state;
					}
					
					if(!self.GrnModels_[modelId] || !self.GrnModels_[modelId].vfgParent_) {
						self.GrnModels_[modelId] = self.GrnModels_.default_;
						self.GrnModels_[modelId].modelId_ = self.currentModel_;	
					}
					self.GrnModels_[modelId].state_ = modelState;
					
					delete self.GrnModels_.default_;
					
					require(["views"],function(BTViews){ 
						BTViews.selectOnTree(modelId,self.tabId_);
					});	
				}
				
				// *Any* model change causes the pathing window/dialog to close
				require(["controllers/WindowController"],function(WindowController){
					WindowController.closeWindow("pathing");
				});
				
				if(confirmation.currModel === confirmation.requested || confirmation.currNode === confirmation.requested) {
					self.currentModel_ = modelId;
				} else if(confirmation.requested !== "default_") {
					throw new Error("[ERROR] Requested model and confirmed model do not match! Requested " 
						+ confirmation.requested + " but received "+(confirmation.currModel || confirmation.currNode));
				}
				
				var model = self.GrnModels_[modelId];

				// If we have an expired model, or don't have it, we need to fetch, build, and load it.
				if(!(model && model.drawingObjects_ &&  model.drawingObjects_[model.state_]
					&& (model.expiry_ > Date.now()))) {
					
					self.fetchAndFinish_(modelId,oldModel,model,confirmation,sliderChange,pathSet,overlay,isStateChange);
					
				// Otherwise, we just resolve with it, and set the model message (if there is one)
				} else {
					require(["views/GrnModelMessages"],function(GrnMsgs){
    					GrnMsgs.removeStickies();
    					GrnMsgs.popMessage();
						GrnMsgs.setMessage({msg: model.message_, id:model.modelId_},"MODEL");
					});
					self.asyncModelLoader_.resolve(model);
					
					self.setupLLC_(modelId,oldModel,sliderChange,pathSet,overlay,isStateChange);
				}				
				
			},function(err){  // _setModel.then.err
				if(err.status === "NEW_SESSION") {
					// Lack of a previously resolved asyncModelLoader means we 
					// have gotten a new session in an initial load, probably
					// due to loading a new tab. We need to *reject* so that
					// the tab can be properly initialized in that case
					if(self.asyncModelLoader_ && !self.asyncModelLoader_.isResolved()) {
						self.asyncModelLoader_.reject(self.GrnModels_[self.currentModel_]);	
					}
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
		
		/////////////////////
		// fetchAndFinish_
		/////////////////////
		//
		// Fetch out the model, load it, apply and model messages, and set up the LowerLeftComponents
		//
		fetchAndFinish_: function(modelId,oldModel,model,confirmation,sliderChange,pathSet,overlay,isStateChangeOrReload) {
			var fetch = new Deferred();
			var self=this;
			// Explicitly fetch this model's JSON to prevent any confusion
			self._fetchModel(model.getModelId(),model.nodeType).then(function(modelData){
				if(model.getModelId() !== modelData.modelID && model.getModelId() !== modelData.nodeID) {
					self.asyncModelLoader_.reject("[ERROR] Model mismatch! Requested " + model.getModelId() + " but got " + (modelData.modelID || modelData.nodeID));
					fetch.reject();
				}
				self.asyncGrnModelBuilder_.promise.then(function(){
					self.loadModel_(modelId,modelData,confirmation);	
					
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
					fetch.resolve();
				});
				
			},function(err){
				fetch.reject();
				self.asyncModelLoader_.reject(err);
			});

			self.setupLLC_(modelId,oldModel,sliderChange,pathSet,overlay,isStateChangeOrReload);
			
			return fetch.promise;
			
		},
		
		/////////////////
		// setupLLC_
		/////////////////
		//
		// Set up the LowerLeftComponents
		//
		setupLLC_: function(modelId,oldModel,sliderChange,pathSet,overlay,isStateChangeOrReload) {
			var self=this;
			// Once the model is loaded, fill in the lower left components (if there are any)
			self.asyncModelLoader_.promise.then(function(model) {
				var myLLC = LowerLeftComponents.getLowerLeftComponents(self.tabId_);
				if(model.type_ === "DYNAMIC_PROXY") {
					if(oldModel !== modelId || self.sessionReloading_) {
						
						myLLC.setProp("timeSlider","modelId",modelId,{
							min: model.stateMin_,
							max: model.stateMax_,
							count: model.states_.length,
							value: model.state_,
							withOnChange: false
						});
					} else {
						// If the time slider did not call for this change,
						// we need to sync it up to our current model
						if(!sliderChange) {
							self.syncTimeSlider(model.state_);
						}
					}
				} else {
					myLLC.disable("timeSlider");
				}
				
				if(model.annotationImages_[model.state_]) {
					myLLC.setProp("modelAnnotImg","currImg",model.getModelId());
				} else {
					myLLC.disable("modelAnnotImg");
				}	
				
				// Setting an onPath_ property allows us to flag the path status of this overlay setting 
				myLLC.setProp("overlay","onPath",pathSet);
				
				if(model.overlayDefs_ && model.overlayDefs_.length > 0) {
					myLLC.setProp("overlay","modelId",model.modelId_,{defs: model.overlayDefs_,modelId: model.modelId_, pathSet: pathSet});
					if(overlay) {
						myLLC.setOverlay(overlay);
					} else {
						isStateChangeOrReload && myLLC.applyCurrentOverlay();
					}
				} else {
					myLLC.setProp("overlay","pathSet",pathSet);
					myLLC.disable("overlay");
				}
				
				if(self.sessionReloading_) {
					self.sessionReloading_ = false;
				}
				self.asyncLowerLeftLoader_.resolve();
			},function(err){ // asyncModelBuiler.then.err
				console.error(err);
			});
		},
		
								
		////////////////
		// loadModel_
		////////////////
		//
		// Given a modelID, drawing data object, and the confirmation response from the server, load the drawing 
		// object (and model annotation image, if provided) onto the corresponding GrnModel object.
		//
		loadModel_: function(modelId,modelData,confirmation) {
			var self=this;
			var model = this.GrnModels_[modelId];
			
			if(confirmation && confirmation.modelAnnotImage) {
				model.annotationImages_[model.state_] = confirmation.modelAnnotImage;
			}
			
			model.drawingObjects_[model.state_] = modelData;
			model.message_ = (modelData.displayText.modelText ? modelData.displayText.modelText : "");
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
				
		///////////////////////////////
		// setModelOverlay
		//////////////////////////////
		//
		// Overlay values are set via the Overlay widget, which will then update the ArtboardController with the new value
		//
		setModelOverlay: function(overlayVal) {
			var self=this;
			// Overlays are not relevant to DYNAMIC_PROXY models, so don't bother
			// if this is a DYNAMIC_PROXY
			this.asyncModelLoader_.promise.then(function(){
				if(self.GrnModels_[self.currentModel_].get("type_") !== "DYNAMIC_PROXY") {
					self.asyncLowerLeftLoader_.promise.then(function(){
						LowerLeftComponents.getLowerLeftComponents(self.tabId_).setValue("overlay",overlayVal);
					});
				}
			});			
		},
		
		///////////////////////////
		// setModel
		//////////////////////////
		//
		// Set the model and wait on the asyncModelLoader to resolve
		setModel: function(modelId,state,overlay,onPath,sliderChange) {
			this.set("currentModel_",modelId,state,overlay,onPath,sliderChange);
			return this.asyncModelLoader_.promise;
		},
		
		///////////////////////////////////
		// syncTimeSlider
		///////////////////////////////////
		//
		// Synchronize the time slider's displayed value, because we had a state change come from another source
		//
		syncTimeSlider: function(state) {
			var self=this;
			// States are not relevant if a model is not a dynamic instance
			// proxy and will default to 0, so don't try to adjust the 
			// TimeSlider value setting unless we actually need to
			this.asyncModelLoader_.promise.then(function(){
				if(self.GrnModels_[self.currentModel_].get("type_") === "DYNAMIC_PROXY") {
					self.asyncLowerLeftLoader_.promise.then(function(){
						var myLLC = LowerLeftComponents.getLowerLeftComponents(self.tabId_);
						if(myLLC.getValue("timeSlider") !== state) {
							myLLC.setValue("timeSlider",{value:state,withoutOnChange:true});
						}
					});
				}
			});
		},
		
		///////////////////////////////////
		// getModel
		///////////////////////////////////
		//
		// Get a copy of the GrnModel object corresponding to this modelId. If we don't have that model yet, or
		// it has expired, request a copy from the server. Because this can be an asynchronous event, we return a 
		// Deferred.promise for registering a callback
		//
		getModel: function(modelId) {
			var asyncLoader = new Deferred();
			var self=this;

			if(!(this.GrnModels_[modelId] && this.GrnModels_[modelId].drawingObjects_ 
				&&  this.GrnModels_[modelId].drawingObjects_[this.GrnModels_[modelId].state_]
				&& (this.GrnModels_[modelId].expiry_ > Date.now()))) {
			
				this._fetchModel(modelId,this.GrnModels_[modelId].nodeType).then(function(modelData){
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
			this.asyncModelLoader_ = new Deferred();
			this.asyncGrnModelBuilder_ = new Deferred();
			
			var asyncReload = new Deferred();
			
			var self=this;
			var currModel = self.GrnModels_[self.currentModel_];
								
			self.GrnModels_ = {
				default_: new GrnModel({modelId_: "default_",state_: 0})
			};
			if(!isNewSession) {
				LowerLeftComponents.getLowerLeftComponents(self.tabId_).removeAll();
			} else {
				self.GrnModels_[self.currentModel] = currModel;					
			}

			asyncReload.resolve();
			
			return asyncReload.promise;
		},
		
		////////////////////////////////
		// getCurrentModel
		////////////////////////////////
		//
		// Get the GrnModel object which is referenced by currentModel_ as the result in a promise from a Deferred(); 
		// this prevents a request for the model from blocking if the model is still loading
		//
		getCurrentModel: function() {
			return this.asyncModelLoader_.promise;
		},	
		
		/////////////////////
		// setWatch
		//////////////////
		//
		// Set a watch callback on a property of this GrnModelController
		//
		setWatch: function(thisProp,thisWatcher) {
			return this.watch(thisProp,thisWatcher);
		},
		
		////////////////////////////////
		// expireCache
		////////////////////////////////
		//
		//
		expireCache: function(modelId,kids,branch) {
			var self=this;
			var asyncExpire = new Deferred();
			require(["controllers/ArtboardController"],function(ArtboardController){

				// If we're not doing a whole-tree expiration, expire the current model explicitly
				if(modelId !== "root") {
					self.GrnModels_[modelId] && self.GrnModels_[modelId].set("expiry_",0);
					ArtboardController.getArtboardController(self.cnvContainerNodeId_).expireCache(self.GrnModels_[modelId].getModelId());
				}
				if(branch) {
					for(var i in self.GrnModels_) {
						if(self.GrnModels_.hasOwnProperty(i)) {
							if(self.GrnModels_[i].vfgParent_ === self.GrnModels_[modelId].vfgParent_ 
								|| i === self.GrnModels_[modelId].vfgParent_
								|| modelId === self.GrnModels_[i].vfgParent_) {
								self.GrnModels_[i].set("expiry_",0);
								ArtboardController.getArtboardController(self.cnvContainerNodeId_).expireCache(self.GrnModels_[i].getModelId());
							}
						}
					}
				} else if(kids) {
					var kidSet = {};
					for(var i in self.GrnModels_) {
						if(self.GrnModels_.hasOwnProperty(i)) {
							// If we're expiring everything, just do that
							if(modelId === "root") {
								self.GrnModels_[i].set("expiry_",0);
								ArtboardController.getArtboardController(self.cnvContainerNodeId_).expireCache(self.GrnModels_[i].getModelId());
							} else {
								// Otherwise, map out parent/child relationships and do the expiring below
								if(!kidSet[self.GrnModels_[i].parent_]) {
									kidSet[self.GrnModels_[i].parent_] = [i];
								} else {
									kidSet[self.GrnModels_[i].parent_].push(i);
								}
							}
							
						}
					}

					if(Object.keys(kidSet).length > 0) {
						var expireKids = function(toExpire) {
							DojoArray.forEach(toExpire,function(kid){
								self.GrnModels_[kid].set("expiry_",0);
								ArtboardController.getArtboardController(self.cnvContainerNodeId_).expireCache(self.GrnModels_[kid].getModelId());
								if(kidSet[kid]) {
									expireKids(kidSet[kid]);
								}
							});
						};
						
						if(kidSet[modelId]) {
							expireKids(kidSet[modelId]);
						}
					}
				}
				
				asyncExpire.resolve();
			});
			return asyncExpire.promise;
		},	
		
		///////////////////////////
		// expireAndReloadCurrent
		///////////////////////////
		//
		// Ask for a new version of the current model
		// 
		expireAndReloadCurrent: function(modelId,kids,branch) {
			var fetch = new Deferred();
			var self=this;
			if(!modelId) {
				modelId = self.currentModel_;
			}
			this.expireCache(modelId,kids,branch).then(function(){
				self.fetchAndFinish_(self.currentModel_,null,self.GrnModels_[self.currentModel_],null,null,null,null,true).then(function(){
					fetch.resolve();
				});	
			});
			return fetch.promise;
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
		// Bootstrap the GrnModelController's GrnModels_ object, which is a list of all models available in the Model Tree.
		//
		buildModels: function(modelArray,parentId,networkParams){
						
			var self=this;
			var myLLC = LowerLeftComponents.getLowerLeftComponents(this.tabId_);
			// Only build the model set if this is an initial loading of a model array; after that
			// the model set is managed by this controller in response to user actions (deleting models,
			// adding models, etc.)
			if(!this.asyncGrnModelBuilder_.isResolved()) {
				var hasDynamicProxy = false;
				DojoArray.forEach(modelArray,function(model){
					if(self._buildThisModel(model,parentId,model.ID)) {
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

				if(self.hasImages_) {
					myLLC.load("modelAnnotImg",{tabId: self.tabId_},this.sessionReloading_);
				} else {
					myLLC.remove("modelAnnotImg");
				}
				
				if(self.hasOverlays_) {
					myLLC.load("overlay",{},true);
				} else {
					myLLC.remove("overlay");
				}
				
				// If there is even one dynamic proxy in the model tree's set of models, we will
				// need to load the time slider widget.
				// We disable it initially because the specific model will enable it when needed
				if(hasDynamicProxy) {
					myLLC.load("timeSlider",{timeSliderDef: networkParams.timeSliderDef},this.sessionReloading_);
				}  else {
					myLLC.remove("timeSlider");
				}
				
				self.asyncLowerLeftLoader_.resolve();
				self.asyncGrnModelBuilder_.resolve();
			}
		},
		
		///////////////////////////
		// splitModelId
		//////////////////////////
		//
		// Dynamic Proxy IDs are a combined ID indicating the parent model and current state, and so
		// do not track with the model tree IDs. When we receive one, we have to split it out into
		// the model ID and the state ID
		// 
		splitModelId: function(modelId) {
			var mainModelId = modelId, state = 0;
			if(modelId.indexOf(DYNAMIC_PROXY_PREFIX)===0 && (modelId.indexOf(":ALL",modelId.length-":ALL".length) === -1)) {
				mainModelId = modelId.substring(modelId.indexOf("-")+1,modelId.indexOf(":"));
				state = modelId.substring(modelId.indexOf(":")+1);
			}
			return {modelId: mainModelId, state: state};
		},
		
		////////////////////////////////
		// _setModel
		////////////////////////////////
		//
		// Set the model, and if applicable state and overlay, on the server
		// 
		_setModel: function(modelId,state,overlay) {
			var self=this;
			var loadAsync = new Deferred();
			if(!modelId) {
				modelId = this.currentModel_;
			}
			
			var nodeType = "MODEL";
						
			if(this.GrnModels_[modelId]) {
				if(state !== null && state !== undefined) {
					this.GrnModels_[modelId].set("state_",state);
				}
				nodeType = this.GrnModels_[modelId].get("nodeType") || "MODEL";
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
				var targetArgs = {currentTab:self.tabId_};
				if(overlay) {
					targetArgs.clientstate = true;
					args.data = JSON.stringify(ClientState.getNewStateObject({
						currOverlay: overlay.id,
						enabledMods: overlay.enabled_modules,
						currentTab: self.tabId_
					}));	
					args.headers = {"Content-Type":"application/json"};
				}
				xhrController.xhrRequest(XhrUris.setTreeNode(modelId,targetArgs,nodeType),args).then(function(response){
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
		
		////////////////////////////
		// _fetchModel
		////////////////////////////
		//
		// Retrieve the model represented by modelId from the server
		//
		_fetchModel: function(modelId,nodeType) {
			var loadAsync = new Deferred();
			var self=this;
			
			require(["views"],function(BTViews){
				// Wait one second before popping the 'loading' screen, because it's not needed if
				// there's no real delay
				var slowLoad = setTimeout(function(){
					BTViews.getTabWidget(self.tabId_).showDownloading(false);	
				},1000);
				
				// Set up a timer to warn about a slow load after a set time
				var vSlowLoad = setTimeout(function() {
					BTViews.getTabWidget(self.tabId_).showDownloading(false,TxtMsgs.V_SLOW_LOAD,true);
				},3000);
				
				xhrController.xhrRequest(XhrUris.nodeJson(modelId,self.tabId_,nodeType),{timeout:BTConst.NODE_JSON_TIMEOUT}).then(function(response){
					// On the off chance our loading screen didn't have enough time to fire, clear it out
					clearTimeout(slowLoad);
					clearTimeout(vSlowLoad);
					loadAsync.resolve(response);
					// Update the loading screen and register it to close
					BTViews.getTabWidget(self.tabId_).showDownloading(true,"...model received!");
				},function(err){
					BTViews.getTabWidget(self.tabId_).showDownloading(true);
					if(err.status === "NEW_SESSION") {
						require(["controllers/ActionCollection"],function(ActionCollection){
							ActionCollection.CLIENT_WARN_RESTART_SESSION();
						});
					} else {
						loadAsync.reject("Response " + err.staus + ": " + err.errormsg);
					}
				});
			});
			
			return loadAsync.promise;
		},
		
		/////////////////////////////////////
		// _buildModelChildren
		/////////////////////////////////////
		//
		// For each member of modelArray, run _buildThisModel
		// Return a bool indicating if any of this model's children are DynamicProxies
		// 
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
		
		///////////////////////////
		// _buildThisModel
		//////////////////////////
		//
		// Build the GrnModel object associated with the information supplied in the model object
		// Return a bool indicating if any of this model's children are DynamicProxies
		// 
		_buildThisModel: function(model,vfgParentId,parentId,depth) {
			if(depth === undefined || depth === null) {
				depth = 0;
			}
			model.ID = model.ID || model.name+"_id";
			
			// Do not clobber existing references, just
			// update the data
			var modelData = {
				type_: model.modelType,
				vfgParent_: vfgParentId,
				parent_: parentId || vfgParentId,
				modelId_: model.ID,
				expiry_: Date.now() + BASE_CACHE_EXPIRATION,
				state_: 0,
				message_: null,
				overlayDefs_: model.overlayDefs,
				depth_: depth,
				nodeType: (model.modelType == "GROUPING_ONLY" ? "GROUP_NODE" : "MODEL")
			};
			
			if(!this.GrnModels_[model.ID]) {
				this.GrnModels_[model.ID] = new GrnModel(modelData);				
			} else {
				this.GrnModels_[model.ID].update(modelData);		
			}
									
			if(model.modelType === "DYNAMIC_PROXY") {
				this.GrnModels_[model.ID].states_ = model.timeRange.asSortedSet;
				this.GrnModels_[model.ID].state_ = model.timeRange.min;
				this.GrnModels_[model.ID].stateMin_ = model.timeRange.min;
				this.GrnModels_[model.ID].stateMax_ = model.timeRange.max;
			}
			
			var hasDynamicProxy = false;
			
			if(model.children_.length > 0) {
				if(this._buildModelChildren(
						model.children_
						,((model.modelType !== "GENOME_INSTANCE" && model.modelType !== "DB_GENOME") ? parentId : model.ID)
						,model.ID
						,depth+1)
					) {
					hasDynamicProxy = true;
				}
			}
			return (model.modelType === "DYNAMIC_PROXY") || hasDynamicProxy;
		},
		
		destroyRecursive: function() {
			this.destroy();
		},
		
		/////////////////////////////////////
		// Constructor
		/////////////////////////////////////
		//
		//
		constructor: function(tabId) {
			
			this.tabId_ = (tabId || DEFAULT_TAB_ID);
			this.GrnModels_ = {
				default_: new GrnModel({modelId_: "default_",state_: 0})
			};
			
			this.asyncGrnModelBuilder_ = new Deferred();
			this.asyncLowerLeftLoader_ = new Deferred();
			
			// Setting the model value will trigger the rest of the loading process
			this.set("currentModel_","default_");
		}
	});
	
	
	// Our collection of GrnModelControllers
	// These will be keyed on the tabId for the BTTab and GRN they control
	// There is always a minimum of one, so make one as soon as the controller is instantiated
	var GrnModelControllers = {
		DB_A: new GrnModelController(DEFAULT_TAB_ID)
	};

	return {
		getModelController: function(tabId) {
			if(!GrnModelControllers[tabId]) {
				GrnModelControllers[tabId] = new GrnModelController(tabId);
			}
			return GrnModelControllers[tabId];
		},
		makeNewGrnModelController: function(tabId) {
			if(GrnModelControllers[tabId]) {
				this.removeNewGrnModelController(tabId);
			}
			GrnModelControllers[tabId] = new GrnModelController(tabId);
			return GrnModelControllers[tabId];
		},
		removeController: function(tabId) {
			if(GrnModelControllers[tabId]) {
				GrnModelControllers[tabId].destroyRecursive();
				delete GrnModelControllers[tabId];
			}
		},
		reloadController: function(tabId,sessionRestart) {
			if(GrnModelControllers[tabId]) {
				GrnModelControllers[tabId].reloadController(sessionRestart);
			}
		}
	}
	
});
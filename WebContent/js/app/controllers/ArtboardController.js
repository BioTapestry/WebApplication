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
	"models/ArtboardModel",
	"./HitPriority",
	"dojo/Deferred",
    "dojo/_base/declare",
    "dojo/Stateful",
    "dojo/_base/array",
    "app/utils",
    "dijit/Destroyable",
    "static/BTConst",
	"dojo/domReady!"
],function(
	ArtboardModel,
	HitPriority,
	Deferred,
	declare,
	Stateful,
	DojoArray,
	utils,
	Destroyable,
	BTConst
){
	
	var TOOLTIP_DEFAULT_DELAY = 400;
	
	var NETWORK_CONTROLLER_DEFAULT = "controllers/GrnModelController";
	
	//////////////////////////////////////////
	// ArtboardController
	//////////////////////////////////////////
	//
	// A module for controlling an ArtboardModel and its associated BioTapestryCanvas
	
	var ArtboardController = declare([Stateful,Destroyable],{
		
		navZoomMode_: null,
		
		initialZoomMode_: null,
		
		completeModelBounds_: null,
		
		// The tabId of the GrnModelController this ArtboardController will watch for state changes
		// In the case of a floating artboard this value will remain null
		tabId_: null,
				
		// Currently selected items can be traversed individually, so the set must be
		// maintained (as a copy) in a consistently sorted order, and an index into that
		// set must be available
		selSetKeys_: null,
		selSetTraversalIdx_: null,
		
		// Indicates if the artboard will be attached and completed immediately, or if
		// its load will be delayed (eg. for a user path window)
		delayedLoad_: null,
		
		// The type of network model controller (GrnModelController, PathingModelController) 
		// this Artboard Controller will use
		networkModelController_: null,
		
		// Map of all cached models
		ArtboardModels_: null,
		
		// Deferred for model loading, which is asynchronous
		asyncModelLoader_: null,
		
		// Object listing the states this canvas will change (eg. zooming, selecting)
		canvasStates_: null,
		
		// The DOM node ID of the DIVs containing the canvas and it's wrapper that this controller relates to
		cnvContainerDomNodeId_: null,
		cnvWrapperDomNodeId_: null,

		currentModel_: null,
		_currentModel_Getter: function() {
			return this.currentModel_;
		},
		_currentModel_Setter: function(newModel) {
			this.currentModel_ !== newModel && this.currentModel_ !== "default_" && this.updateStatesForSelection();
			this.currentModel_ = newModel;
			this.ArtboardModels_[this.currentModel_] && this.ArtboardModels_[this.currentModel_].nodeType_ === BTConst.NODETYPE_GROUP && this.updateZoomStates();
		},
		
		overlay_: null,
		_overlay_Getter: function() {
			if(!this.ArtboardModels_[this.currentModel_]) {
				return null;
			}
			return this.ArtboardModels_[this.currentModel_].get("overlay_");
		},
		_overlay_Setter: function(val) {
			var self=this;
			this.ArtboardModels_[this.currentModel_].set("overlay_",val);
			if(this.ArtboardModels_[this.currentModel_].moduleDescs_) {
				require(["views/GrnModelMessages"],function(GrnModelMsgs){
					if(!val.enabled_modules || val.enabled_modules.length !== 1) {
						GrnModelMsgs.setMessage(null,"MODULE");
					} else {
						var moduleDesc = self.ArtboardModels_[self.currentModel_].moduleDescs_[val.id +":"+val.enabled_modules[0].id];
						if(moduleDesc) {
							GrnModelMsgs.setMessage({id: val.enabled_modules[0], msg: moduleDesc},"MODULE");	
						} else {
							GrnModelMsgs.setMessage(null,"MODULE");
						}
					}
				});
			}
		},

		toggledRegions_: null,
		_toggledRegions_Getter: function() {
			return this.ArtboardModels_[this.currentModel_].get("toggledRegions_");
		},
		_toggledRegions_Setter: function(val) {
			this.ArtboardModels_[this.currentModel_].set("toggledRegions_",val);
		},
		
		//////////////////////////////////
		// _loadModel
		/////////////////////////////////
		//
		// Given a model object with all attendant data, loads it into the ArtboardModels collection and
		// sets it as the current model of this ArtboardController.
		//
		_loadModel: function(model) {
			var modelId = model.getModelId();
			var drawingObj = model.getDrawingObject();
			var tooltips = model.getTooltips();
			var notes = model.getNotes();
			var moduleDescs = model.getModuleDescs();
			var asyncLoader = new Deferred();
			if(this.currentModel_ === "default_") {
				this.ArtboardModels_["default_"].set("modelId_",modelId);
				this.ArtboardModels_["default_"].set("drawingObject_",drawingObj);
				this.ArtboardModels_["default_"].set("tooltips_",tooltips);
				this.ArtboardModels_["default_"].set("notes_",notes);
				this.ArtboardModels_["default_"].set("moduleDescs_",moduleDescs);
				this.ArtboardModels_["default_"].set("depth_",model.depth_);
				this.ArtboardModels_["default_"].set("nodeType_",model.nodeType);
				this.ArtboardModels_[modelId] = this.ArtboardModels_["default_"];
				this.ArtboardModels_["default_"].set("asyncModelLoader",asyncLoader);
				delete this.ArtboardModels_.default_;
			} else if((this.currentModel_ !== modelId && !this.ArtboardModels_[modelId]) || 
				(this.ArtboardModels_[modelId] && this.ArtboardModels_[modelId].expiry_ < Date.now())) {
				this.ArtboardModels_[modelId] = new ArtboardModel({
					modelId_: modelId,
					drawingObject_: drawingObj,
					tooltips_: tooltips,
					notes_: notes,
					moduleDescs_: moduleDescs,
					depth_: model.depth_,
					vfgParent_: model.vfgParent_,
					nodeType_: model.nodeType,
					asyncModelLoader: asyncLoader
				});
			}	

			asyncLoader.resolve(this.ArtboardModels_[modelId]);
			this.set("currentModel_",modelId);
			
			this.asyncModelLoader_.resolve(this.ArtboardModels_[modelId]);
		},
		
		////////////////////////////
		// _compareSelections
		///////////////////////////
		//
		// Returns true if there was a selection change, false if not.
		//
		_compareSelections: function(newSelex,oldSelex) {
			if(Object.keys(newSelex).length !== Object.keys(oldSelex).length) {
				return true;
			} 
			for(var i in newSelex) {
				if(newSelex.hasOwnProperty(i)) {
					if(!oldSelex[i]) {
						return true;
					} 
					if(oldSelex[i].getType() === "linkage") {
						if(!(oldSelex[i].segments && newSelex[i].segments)) {
							return true;
						}
						if(oldSelex[i].segments.length !== newSelex[i].segments.length) {
							return true;
						}
						if(_.difference(oldSelex[i].segments,newSelex[i].segments).length > 0) {
							return true;
						}
					}
				}
			}
			return false;
		},

		
		////////////////////////////////
		// _buildSelectionSet
		///////////////////////////////
		//
		// Based on the hits, current selection set, and any special
		// selection modifiers (additive selection, subtractive selection),
		// determine the new selection set
		//
		_buildSelectionSet: function(hits,selectedEntities,isAdd,isSubtract) {
			
			var selectedSet = {};
			var hitsAsMap = {};
			var hitsInCurrSet = 0;
			
			if(hits.length > 0 || isAdd) {
				DojoArray.forEach(hits,function(hit){
					var hitId = hit.id;
					
					var isFound = !!selectedEntities[hitId];
					
					hitsAsMap[hitId] = hit;

					if(isFound) {
						if(hit.getType() === "linkage") {
							// We have to reset isFound because until we've compared all link
							// segments and determined the intersection we can't be certain the
							// link was entirely 'found'
							isFound = false;
							if(selectedEntities[hitId].segments && hit.segments) {
								if(_.intersection(selectedEntities[hitId].segments,hit.segments).length === hit.segments.length) {
									isFound = true;
									hitsInCurrSet++;	
								}								
							} else {
								isFound = true;
							}
						} else {
							hitsInCurrSet++;	
						}
					}
					if((!isFound) || !isSubtract) {
						selectedSet[hitId] = hit;
					}
				});
				
				// If our hitset contains everything already selected and
				// the lengths are the same, then we've simply reselected
				// the same set, and we can return the selectedEntities set
				if(hitsInCurrSet == hits.length && !isSubtract) {
					return selectedEntities;
				}
				
				// ...otherwise, we need to complete the selection set 
				for(var i in selectedEntities) {
					if(selectedEntities.hasOwnProperty(i)) {
						var selectedEntity = selectedEntities[i];
						if(!hitsAsMap[i]) {
							if(isAdd) {
								selectedSet[i] = selectedEntity;
							}
						} else if(selectedEntity.getType() === "linkage") {
							if(isAdd) {
								var selSegsNotInHits = _.difference(selectedEntity.segments,hitsAsMap[i].segments);
								if(selSegsNotInHits.length > 0) {
									if(!selectedSet[i]) {
										selectedSet[i] = _.clone(selectedEntity);
										selectedSet[i].segments = selSegsNotInHits;
									} else {
										selectedSet[i].segments = _.union(selSegsNotInHits,selectedSet[i].segments);	
									}
								}
							}
						}
					}
				}
			}
			return selectedSet;
		},
		
		///////////////////////////////////////////////////////
		// _centerOnSel
		///////////////////////////////////////////////////////
		//
		// 
		_centerOnSel: function(which) {
			var self=this;
			require(["views/BioTapestryCanvas","controllers/StatesController"],function(BTCanvas,StatesController){
				var isFirstCenter = (self.selSetTraversalIdx_ === null);
				if(self.selSetKeys_) {
					switch(which) {
						case "prev":
							if(isFirstCenter || self.selSetTraversalIdx_-1 < 0) {
								self.selSetTraversalIdx_ = (self.selSetKeys_.length-1);
							} else {
								self.selSetTraversalIdx_ = (self.selSetTraversalIdx_-1);
							}							
							break;
						case "next":
							if(isFirstCenter || self.selSetTraversalIdx_+1 > self.selSetKeys_.length-1) {
								self.selSetTraversalIdx_ = 0;
							} else {
								self.selSetTraversalIdx_ = (self.selSetTraversalIdx_+1);
							}
							break;
						default:
							console.error("[ERROR] Case " + which + " in _centerOnSel is not recognized!");
							break;
					}
					
					if(isFirstCenter) {
						BTCanvas.getBtCanvas(self.cnvContainerDomNodeId_).zoomToSelNode(self.selSetKeys_[self.selSetTraversalIdx_]);	
					} else {
						BTCanvas.getBtCanvas(self.cnvContainerDomNodeId_).scrollToSelNode(self.selSetKeys_[self.selSetTraversalIdx_]);	
					}
					StatesController.setState(self.canvasStates_.ZOOM_TO_CURR_SELECTED,(self.selSetTraversalIdx_ !== null));
				}
			});
		},
		
		/////////////////////////////////
		// _updateStatesForSelection
		//////////////////////////////////
		//
		//
		updateStatesForSelection: function(nodes,useCurrent) {
			var self=this;
			if(useCurrent) {
				nodes = this.selSetKeys_;
			}
			require(["controllers/StatesController"],function(StatesController){
				if(nodes && nodes.length > 0) {
					StatesController.setState(self.canvasStates_.SELECT_NONE,true);
					StatesController.setState(self.canvasStates_.ZOOM_TO_ALL_SELECTED,true);
					StatesController.setState(self.canvasStates_.ZOOM_TO_CURR_SELECTED,(self.selSetTraversalIdx_ !== null));
					StatesController.setState(self.canvasStates_.CENTER_ON_PREV,(self.selSetKeys_.length > 1));
					StatesController.setState(self.canvasStates_.CENTER_ON_NEXT,(self.selSetKeys_.length > 1));
				} else {
					StatesController.setState(self.canvasStates_.SELECT_NONE,false);
					StatesController.setState(self.canvasStates_.ZOOM_TO_ALL_SELECTED,false);
					StatesController.setState(self.canvasStates_.ZOOM_TO_CURR_SELECTED,false);
					StatesController.setState(self.canvasStates_.CENTER_ON_PREV,false);
					StatesController.setState(self.canvasStates_.CENTER_ON_NEXT,false);
				}
			});			
		},
		
		///////////////////////
		// updateZoomStates
		//////////////////////
		//
		//
		updateZoomStates: function() {
			var self=this;
			require(["views/BioTapestryCanvas"],function(BTCanvas){
				if(self.currentModel_ && self.ArtboardModels_[self.currentModel_].nodeType_ === BTConst.NODETYPE_GROUP) {
					BTCanvas.getBtCanvas(self.cnvContainerDomNodeId_).disableZooming();	
				} else {
					BTCanvas.getBtCanvas(self.cnvContainerDomNodeId_).updateZoomStates();
				}
			});
		},
		
		///////////////////////////////////////////////
		// _finishLoading
		//////////////////////////////////////////////
		//
		//
		_finishLoading: function(params) {
			var self=this;
			require([this.networkModelController_],function(networkModelController){
				var myNMC = networkModelController.getModelController(self.tabId_);
				if(!params.floatingArtboard) {
					myNMC.getCurrentModel().then(function(currentModel){
						self._loadModel(currentModel);
					},function(err){
						err && self.set("currentModel_",err.modelId);
						self.asyncModelLoader_.reject(err);
					});	
					self.own(myNMC.setWatch("currentModel_",function(name,oldVal,newVal){
						if(!self.asyncModelLoader_ || self.asyncModelLoader_.isFulfilled()) {
							self.asyncModelLoader_ = new Deferred();	
						} 
						// myNMC.getModel(newVal).then(function(currentModel){
						myNMC.getCurrentModel().then(function(currentModel){
							self._loadModel(currentModel);
						},function(err){
							self.set("currentModel_",oldVal);
							self.asyncModelLoader_.reject(err);
						});
					}));
				} else {
					myNMC.getCurrentModel().then(function(currentModel){
						self.setModel(currentModel.vfgParent_ || currentModel);
					},function(err){
						self.asyncModelLoader_.reject(err);
					});
				}
			});
		},
		
		///////////////////////////
		// getTooltip
		//////////////////////////
		//
		// Given an entity (forThis), return the tooltip, if any, held in the current ArtboardModel
		// 
		getTooltip: function(forThis,isForPathing) {
			var tooltip = null;
			var self=this;
			this.asyncModelLoader_.promise.then(function(thisModel){
				require(["views/BioTapestryCanvas"],function(BTCanvas){
					tooltip = thisModel.getTooltip(
						forThis,isForPathing,
						BTCanvas.getBtCanvas(self.cnvContainerDomNodeId_)
					);
				});
			},function(err){
				throw new Error("Couldn't load the model " + self.currentModel_ + ": " + err);
			});	

			return tooltip;
		},
		
		//////////////////////////////////////
		// getNote
		///////////////////////////////////////
		//
		// Given a note entity, get the note text held in the current ArtboardModel
		//
		getNote: function(forThis) {
			var note = null;
			var self=this;
			this.asyncModelLoader_.promise.then(function(thisModel){
				note = thisModel.getNote(forThis);
			},function(err){
				throw new Error("Couldn't load the model " + self.currentModel_ + ": " + err);
			});	

			return note;
		},		
		
		//////////////////////////////////
		// getModel
		//////////////////////////////////
		//
		// Return the current reference of the ArtboardModel with an ID of modelId. If that
		// model has not been loaded the return value will be undefined. If it is in the process
		// of being loaded, the referenced object's contents may change. This method is only to be
		// used when a pending or on-going load is not detrimental
		//
		getModel: function(modelId,strict) {
			// 'strict' means we just want to know if this model exists in the collection
			// at all; we don't want to wait on a pending load.
			if(strict) {
				return (this.ArtboardModels_ ? this.ArtboardModels_[modelId] : null);
			}
			// If this is not a strict get, send back a loader which will
			// resolve with null if the collection and model don't exist yet
			var loader; 
			if(this.ArtboardModels_ && this.ArtboardModels_[modelId]) {
				loader = this.ArtboardModels_[modelId].get("asyncModelLoader");
			} else {
				loader = new Deferred();
				loader.resolve(null);
			}
			return loader.promise;
		},
		
		deselectAllNodes: function() {
			this.selectNodes();
		},
		
		selectAllNodes: function() {
			var self=this;
			require(["views/BioTapestryCanvas"],function(BTCanvas){
				BTCanvas.getBtCanvas(self.cnvContainerDomNodeId_).getAllNodes().then(function(canvasNodes){
					self.selectNodes(canvasNodes);
				});
			});
		},
		
		zoomToCurrSel: function() {
			if(this.selSetKeys_) {
				var self=this;
				require(["views/BioTapestryCanvas"],function(BTCanvas){
					BTCanvas.getBtCanvas(self.cnvContainerDomNodeId_).zoomToSelNode(self.selSetKeys_[self.selSetTraversalIdx_]);
				});
			}
		},		
		
		toggleRegion: function(id) {
			var regionToggles = this.get("toggledRegions_");
			if(!regionToggles) {
				regionToggles = {};
			}
			if(!regionToggles[id]) {
				regionToggles[id] = true;
			} else {
				delete regionToggles[id];
			}		
			this.set("toggledRegions_",regionToggles);
		},
		
		///////////////////////////////////////
		// drawingObjIsCached
		///////////////////////////////////////
		// 
		// Parse the model ID given and then determine if it is currently cached by the GrnModelController
		//
		drawingObjIsCached: function(modelId) {
			return !!(this.ArtboardModels_[modelId] && this.ArtboardModels_[modelId].getCached());
		},
		
		//////////////////////////////////
		// setCachedInRenderer
		///////////////////////////////
		//
		// If we are invalidating the cache (cacheStatus === false), we also need the Canvas to tell the Renderer to
		// empty its cache for these models.
		// TODO: watch condition from the Renderer to the AbModel's cache status?
		// 
		setCachedInRenderer: function(modelId,cacheStatus) {
			var self=this;
			this.ArtboardModels_[modelId] && this.ArtboardModels_[modelId].setCached(cacheStatus);
			if(!cacheStatus) {
				require(["views/BioTapestryCanvas"],function(BTCanvas){
					BTCanvas.getBtCanvas(self.cnvContainerDomNodeId_).flushRendererCache([modelId]);
				});
			}
		},
		
		///////////////////////////////
		// getCurrentModel
		///////////////////////////////
		//
		// Returns the Deferred.promise which can be used to register a callback against the status
		// of fetching the current model
		// 
		getCurrentModel: function() {
			return this.asyncModelLoader_.promise;
		},	
		
		///////////////////////////////////
		// setWatch
		//////////////////////////////////
		//
		// Apply a watch callback on a property of this ArtboardController 
		// 
		setWatch: function(thisProp,thisWatcher) {
			return this.watch(thisProp,thisWatcher);
		},
				
		centerOnNextSel: function() {
			this._centerOnSel("next");
		},
		
		centerOnPrevSel: function() {
			this._centerOnSel("prev");
		},		
		
		selectNodesOnCanvasAndZoom: function(nodes,appendTo,focusCanvas) {
			var self=this;
			require(["views/BioTapestryCanvas"],function(BTCanvas){
				self.selectNodes(nodes,appendTo).then(function(){
					BTCanvas.zoomToSelected(self.cnvContainerDomNodeId_,focusCanvas);
				});
			});
		},
		
		selectNodes: function(nodes,appendTo,focusCanvas) {			
			var self=this;
			var asyncSelector = new Deferred();
			require(["views/BioTapestryCanvas"],function(BTCanvas){
				if(appendTo) {
					var currSel = BTCanvas.getBtCanvas(self.cnvContainerDomNodeId_).getSelectedNodes();
					for(var i in currSel) {
						if(nodes[i] && nodes[i].getType() === "linkage") {
							nodes[i].segments = _.union(nodes[i].segments,currSel[i].segments);
						} else {
							nodes[i] = currSel[i];	
						}
					}
				}
				var newSelSet = nodes ? _.keys(nodes).sort() : null;
				if(newSelSet && self.selSetTraversalIdx_ !== null && nodes[self.selSetKeys_[self.selSetTraversalIdx_]]) {
					self.selSetTraversalIdx_ = newSelSet.indexOf(self.selSetKeys_[self.selSetTraversalIdx_]);
				} else {
					self.selSetTraversalIdx_ = null;
				}
				self.selSetKeys_ = newSelSet;
				BTCanvas.getBtCanvas(self.cnvContainerDomNodeId_).selectNodes(nodes).then(function(){
					self.updateStatesForSelection(nodes ? Object.keys(nodes) : nodes);
					asyncSelector.resolve();
				});
			});	
			return asyncSelector.promise;
		},
		
		/////////////////////////////
		// flushCache
		////////////////////////////
		//
		// Delete a specified model from the ArtboardModels_ collection
		// If no modelId is provided, delete all ArtboardModels_
		//
		flushCache: function(modelId) {
			if(!modelId) {
				for(var i in this.ArtboardModels_) {
					if(this.ArtboardModels_.hasOwnProperty(i)) {
						delete this.ArtboardModels_[i];
					}
				}
			} else {
				delete this.ArtboardModels_[modelId];
			}
		},
		
		///////////////////////////////////
		// expireCache
		//////////////////////////////////
		//
		// Expire an ArtboardModels_ entry, so that the next time it is clicked on, a new
		// model will be generated and data requested from the server.
		expireCache: function(modelId) {
			if(!modelId) {
				for(var i in this.ArtboardModels_) {
					if(this.ArtboardModels_.hasOwnProperty(i)) {
						this.ArtboardModels_[i].set("expiry_",0);
						this.setCachedInRenderer(i,false);
					}
				}
			} else {
				this.ArtboardModels_[modelId] && this.ArtboardModels_[modelId].set("expiry_",0);
				this.setCachedInRenderer(modelId,false);
			}
		},
		
		
		///////////////////////////////////
		// attachArtboard
		//////////////////////////////////
		//
		// Once there is a BTCanvas (view) to associate to this controller, 
		// finalize building this controller
		// 
		attachArtboard: function(params) {
			if(this.delayedLoad) {
				this._finishLoading(params);
			}
			var returnArtboard = new Deferred();
			var self=this;
			require(["views/BioTapestryCanvas"],function(BTCanvas){
				if(!params) {
					params = {
						id: "btCanvas_" + utils.makeId()
					};
				}
				declare.safeMixin(params,{
					wsHeight: 500, 
					wsWidth: 1000, 
					cnvContainerDomNodeId: self.cnvContainerDomNodeId_,
					cnvWrapperDomNodeId: self.cnvWrapperDomNodeId_,
					networkModelController: self.networkModelController_
				});	
				
		    	var btCanvas = BTCanvas.buildBtCanvas(params);
		    	BTCanvas.attachArtboard(self.cnvContainerDomNodeId_);	
		    	
		    	var leftClickEvent = function(e){
		    		self.asyncModelLoader_.promise.then(function(thisModel){
		    			if(e.nodeType === BTConst.NODETYPE_GROUP) {
		    				if(e.modelId) {
		    					require(["controllers/ActionCollection"],function(ActionCollection){
		    						ActionCollection.CLIENT_SET_MODEL(e);
		    					});
		    				}
		    				return;
		    			}
		    			var topHit = (e.hits && e.hits.length > 0) ? HitPriority.getTopPriorityHit(e.hits,null,self.get("toggledRegions_")) : null;
		    			if(topHit && topHit.getType() === "note") {
		    				require(["views/GrnModelMessages"],function(GrnModelMsgs){
		    					GrnModelMsgs.setMessageSticky({msg: self.getNote(topHit.id), id: topHit.id});
		    				});
		    			} else {
		    				require(["views/GrnModelMessages"],function(GrnModelMsgs){
		    					GrnModelMsgs.removeStickies();
		    					GrnModelMsgs.popMessage();
		    				});
			    			if(topHit && topHit.getType() === "group") {
				    			topHit = null;
			    			}
			    			var newSelectionMap = self._buildSelectionSet((topHit ? [topHit] : []),e.selectedNodes,e.shiftKey,e.shiftKey);
			    			if(self._compareSelections(newSelectionMap,e.selectedNodes)) {
			    				self.selectNodes(newSelectionMap);
			    			}
		    			}
		    		});	    			
		    	};	    	
		    	
		    	// Left-click callback
		    	if(!params || params.attachLeftClickEvent) {
			    	btCanvas.attachLeftClickEvent(leftClickEvent,leftClickEvent);
		    	}
		    	
		    	// Hover-on-item ('tooltip') callback
		    	if(!params || params.attachTooltipEvent) {
		    		var callback = (params.attachTooltipEvent.callback ? params.attachTooltipEvent.callback(self) : function(thisNode){
		    			if(!self.getTooltip(thisNode.srctag)) {
		    				return null;
		    			}
		    			return self.getTooltip(thisNode.srctag);
		    		}); 
		    		btCanvas.attachTooltipEvent(
	    				callback,
	    				{padding:{x: 4, y: 4},delay:TOOLTIP_DEFAULT_DELAY, id: params.attachTooltipEvent.fetchField || "srctag"}
    				);
		    	}
		    	
		    	// Hover-on-note message editing event
		    	if(!params || params.attachHoverEvents) {
		    		var noteCallback = function(thisNote) {
		    			return {id: thisNote.id, msg: self.getNote(thisNote.id)};
		    		};
		    		btCanvas.attachHoverEvents(noteCallback);
		    	}
		    	
		    	// Right-click callback
		    	if(!params || params.attachRightClickEvent) {
		    		btCanvas.attachRightClickEvent(function(e){
		    			if(e.nodeType === BTConst.NODETYPE_GROUP) {
		    				console.debug("[STATUS] Clicked at ",e.hits);
		    				return;
		    			}
		    			require(["widgets/BTContextMenus"],function(BTContextMenus) {
		                    // Destroy any previous context menu (it may not be correct)           			
		        			BTContextMenus.destroyContextMenu("canvas");
		        			self.asyncModelLoader_.promise.then(function(thisModel){
		        				var topHit = (e.hits && e.hits.length > 0) ? HitPriority.getTopPriorityHit(e.hits,null,self.get("toggledRegions_")) : null;
		        				if(topHit) {
			        				BTContextMenus.buildCanvasHitContextMenu(topHit,e,self.get("overlay_"),self.cnvContainerDomNodeId_,self.tabId_);
		        				}
		        			});
		    			});
		    		});
		    	}
		    	
		    	// mousedown-drag-mouseup selection event
		    	if(!params || params.attachDragSelectionEvent) {
		    		btCanvas.attachDragSelectEvent(function(e){
		    			if(e.nodeType === BTConst.NODETYPE_GROUP) {
		    				console.debug("[STATUS] Clicked at ",e.hits);
		    				return;
		    			}
			    		self.asyncModelLoader_.promise.then(function(thisModel){
			    			var hitsNoRegions = [];
			    			// Technically speaking, regions are not part of the drag selection event, so we need to strip them
			    			// from the intersection set
			    			DojoArray.forEach(e.hits,function(hit){
			    				if(hit.getType() !== "group") {
			    					hitsNoRegions.push(hit);
			    				}
			    			});
			    			var newSelectionMap = self._buildSelectionSet(hitsNoRegions,e.selectedNodes,e.shiftKey,e.shiftKey);
			    			if(self._compareSelections(newSelectionMap,e.selectedNodes)) {
			    				self.selectNodes(newSelectionMap);
			    			}
			    		});			    			
		    		});	
		    	}
		    	
		    	returnArtboard.resolve(btCanvas);
			});
			
			return returnArtboard.promise;
		},
		
		//////////////////////////////
		// setFullBounds
		/////////////////////////////
		//
		// Special set moethod for the completeModelBounds_ object which translates server-side coordinate naming conventions to 
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
		
		//////////////////////////
		// setModel
		/////////////////////////
		//
		// 
		setModel: function(modelId) {
			if(!this.delayedLoad_) {
				this.asyncModelLoader_ = new Deferred();
			}
			var self=this;
			require([this.networkModelController_],function(networkModelController){
				var myNMC = networkModelController.getModelController(self.tabId_);
				myNMC.getModel(modelId).then(function(model){
					self._loadModel(model);
				});
			});
			return this.asyncModelLoader_.promise;
		},
		
		//////////////////
		// redrawCurrent
		//////////////////
		//
		//
		redrawCurrent: function(){
			var self=this;
			require([this.networkModelController_],function(networkModelController){
				var myNMC = networkModelController.getModelController(self.tabId_);
				myNMC.getCurrentModel().then(function(currentModel){
					self._loadModel(currentModel);
				},function(err){
					err && self.set("currentModel_",err.modelId);
					self.asyncModelLoader_.reject(err);
				});
			});
		},

		
		////////////////////////////////
		// reload
		///////////////////////////////
		//
		//
		reload: function(reserveCurrent) {
			var self=this;
			
			this.selectNodes();
			var currModel;
			
			if(reserveCurrent) {
				currModel = this.ArtboardModels_[this.currentModel_];
				delete this.ArtboardModels_[this.currentModel_];
			}
						
			var models = Object.keys(this.ArtboardModels_);
			
			this.ArtboardModels_ = {
				default_: new ArtboardModel({modelId_: "default_"})
			};
			
			if(currModel) {
				this.ArtboardModels_[this.currentModel_] = currModel;
				delete this.ArtboardModels_["_default"];
				this.setCachedInRenderer(this.currentModel_, true);
			} else {
				this.currentModel_ = "default_";
			}
						
			require(["views/BioTapestryCanvas"],function(BTCanvas){
				BTCanvas.getBtCanvas(self.cnvContainerDomNodeId_).flushRendererCache(models);	
			});
			
			this.asyncModelLoader_ = new Deferred();
			this.asyncModelLoader_.id = "reload";
		},
		
		destroyRecursive: function() {
			var self=this;
			require(["views/BioTapestryCanvas"],function(btCanvas){
				btCanvas.removeBtCanvas(self.cnvContainerDomNodeId_);
			});
			this.destroy();
		},
		
		//////////////////////////////////
		// constructor
		/////////////////////////////////
		//
		// 
		constructor: function(params) {
			this.cnvContainerDomNodeId_ = params.cnvContainerDomNodeId;
			this.cnvWrapperDomNodeId_ = params.cnvWrapperDomNodeId;
			this.canvasStates_ = params.canvasStates;
			this.networkModelController_ = params.networkModelController;
			this.delayedLoad_ = params.delayedLoad ? true : false;
			this.navZoomMode_ = params.navZoomMode;
			this.initialZoomMode_ = params.initialZoomMode;
			!params.floatingArtboard && this.setFullBounds(params.completeModelBounds);
			
			if(params.tabId !== undefined) {
				this.tabId_ = params.tabId;
			}
			
			var self=this;
			this.ArtboardModels_ = {
				default_: new ArtboardModel({modelId_: "default_"})
			};			
			
			this.currentModel_ = "default_";
			
			this.asyncModelLoader_ = new Deferred();
			this.asyncModelLoader_.id = "first";
			
			if(!params.delayedLoad) {
				this._finishLoading(params);
			}
		}
	});
	
	// Our private Map of ArtboardControllers, keyed by the container DOM Node ID for their
	// associated Canvas/Artboard
	var artboardControllers_ = {};
	
	return {
		makeArtboardController: function(params) {
			if(artboardControllers_[params.cnvContainerDomNodeId]) {
				delete artboardControllers_[params.cnvContainerDomNodeId];
			}
			if(!params.canvasStates) {
				params.canvasStates = {
					SELECT_NONE: "MAIN_SELECT_NONE",
					ZOOM_TO_ALL_SELECTED: "MAIN_ZOOM_TO_ALL_SELECTED",
					ZOOM_TO_CURR_SELECTED: "MAIN_ZOOM_TO_CURRENT_SELECTED",
					CENTER_ON_NEXT: "MAIN_CENTER_ON_NEXT_SELECTED",
					CENTER_ON_PREV: "MAIN_CENTER_ON_PREVIOUS_SELECTED"
				};
			}

			if(!params.networkModelController) {
				params.networkModelController = NETWORK_CONTROLLER_DEFAULT;
			}
			
			artboardControllers_[params.cnvContainerDomNodeId] = new ArtboardController(params);
			return artboardControllers_[params.cnvContainerDomNodeId];
		},
		getArtboardController: function(cnvContainerDomNodeId) {
			return artboardControllers_[cnvContainerDomNodeId];
		},
		reloadController: function(cnvContainerDomNodeId,reserveCurrentModel) {
			artboardControllers_[cnvContainerDomNodeId] && artboardControllers_[cnvContainerDomNodeId].reload(reserveCurrentModel);
		},
		removeController: function(cnvContainerDomNodeId) {
			artboardControllers_[cnvContainerDomNodeId] && artboardControllers_[cnvContainerDomNodeId].destroyRecursive();
			delete artboardControllers_[cnvContainerDomNodeId];
		}
	};


});
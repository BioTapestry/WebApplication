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
    "dojo/sniff",
    "dojo/throttle",
    "dojo/debounce",
    "dojo/_base/declare",
    "dijit/Destroyable",
    "dojo/Deferred",
    "dojo/dom",
    "dojo/dom-construct",
    "dojo/dom-style",
    "dojo/_base/array",
    "dojo/mouse",
    "dojo/request",
    "dojo/on",
    "dijit/Tooltip",
    "dijit/registry",
    "dojo/aspect",
    "dojo/keys",
    "widgets/BTContextMenus",
    "controllers/ArtboardController",
    "controllers/ZoomController",
    "./renderer/CanvasRenderer",
    "controllers/HitPriority",
    "app/utils"
],function(
	has,
	throttle,
	debounce,
	declare,
	Destroyable,
	Deferred,
	dom,
	domConstruct,
	domStyle,
	DojoArray,
	mouse,
	request,
	on,
	Tooltip,
	registry,
	aspect,
	keys,
	BTContextMenus,
	ArtboardController,
	ZoomController,
    CanvasRendererFactory,
    HitPriority,
    utils
) {
					
	// A CanvasRenderer object, which will parse a JSON model and render it to a supplied
	// canvas instance. The renderer is currently used as a single instance
	var canvasRenderer = null;
	
	// Amount to scroll by with the mousewheel
	var WHEEL_SCROLL_VALUE = 25;
	
	// Amount to scroll by with the keyboard up/down and left/right keys
	var KB_SCROLL_VALUE = 25;
	
	// Throttle rate of redrawing
	var THROTTLE_RATE = 25;
	// Debounce delay
	var DEBOUNCE_DELAY = 55;
	
	// Minimum movement required to count as a mousemove
	var MIN_MOVEMENT = 3;
	
	// Throttling rate for the tooltip event
	var TOOLTIP_THROTTLE_RATE = 150;
	
	// Throttling rate for the drag-selection event
	var DRAGSEL_MOVE_THROTTLE_RATE = 30;
	
	// Some versions of IE require a scrollbar to be a minimum of 18px in size, so this is our minimum size in that case;
	// otherwise, calculate them specifically.
	var SCROLL_BAR_SIZE = (has("ie") || has("trident")) ? 18 : utils.calcScrollbarSize();
	
	var SCROLL_BAR_SPACE = SCROLL_BAR_SIZE+1;
	
	///////////////////////////////////
	// BioTapestryCanvas
	///////////////////////////////////
	//
	// A module for rendering an ArtboardModel to an HTML5 canvas element
	//
	
	var BioTapestryCanvas = declare([Destroyable],{
		
		// Deferred to register callbacks against the initial load of the 
		// renderer and canvas
		_canvasReady: null,
		
		// Sometimes we need a quick boolean response on whether or not the first
		// model is loaded and drawn (tooltip event, note event); this is for those
		// cases
		// TODO: replace with a function that returns _canvasReady.isResolved()?
		_canvasIsReady: null,
		
		// Deferred for model loading events
		_asyncModelLoader: null,
		
		// Indicates whether or not the workspace will be drawn (white rectangle with a thick
		// dark-gray border behind the model)
		_willDrawWorkspace: true,
		
		// The type of NetworkModelController (GrnModelController, PathingModelController, etc.) 
		// associated with this BTCanvas; a BTCanvas only ever interacts with one kind of 
		// NetworkModelController
		_networkModelController: null,
							
		// The true (unscaled) dimensions of the workspace. They do not change unless someone 
		// sets them to new values (Editor-only function).
		_workspaceDimensions: null,
		
		// _canvas is the currently displayed Canvas element
		// _offCanvas is not currently displayed on the DOM
		_offCanvas: null,
		_canvas: null,
		
		// A DIV that will display over the Canvas element during load events
		_loadingScreen: null,
		
		// The id String of the DOM node parent of the _canvas element. We attach events to this
		// DOM node so we can destroy/swap/create canvases without needing to re-attach events
		_cnvContainerNodeId: null,	
		
		// The id String of the ContentPane/DOM Node that holds the canvas container.
		// This DOM Node contains the scrolling system
		_cnvWrapperNodeId: null,
		
		// The renderer library. There is only one renderer for ALL BTCanvases in a given window
		_canvasRenderer: null,
		
		// The renderer may become invalid at times, for example when its cache is
		// flushed during a reload. This flag can be used to prevent draw events from 
		// being sent to the renderer in such cases. Until a valid model is loaded
		// into the renderer cache via _loadModel() its value will be false.
		_rendererIsValid: null,
		
		// The translation needed to account for zoom and scrolling
		_canvasTranslation: null,
		
		// The current model whose contents define the hitspace, tooltips, and drawing.
		// This reference is loaded from the ArtboardController
		_currentModel: null,
		
		// Our list of event listener handles that watch for changes in the ArtboardController
		// model state, such as overlay changes, region toggles, etc.
		_watchers: null,
		
		// Scroll-specific event listener handles
		_scrollHandlers: null,
		
		// The current zoom level. This is an index into an array of zoom values managed by the Zoom Controller
		_currentZoomLevel: null,
		
		// Due to the ability to set a 'custom' zoom level (almost always the result of needing
		// to zoom to show an entire workspace), we store the actual zoom value as well as 
		// the array position, because we need it to calculate scrollbar repositioning.
		// TODO: More robust ZoomController that won't require storing this value in the BTCanvas
		_currentZoomValue: null,
		
		// There are cases where the zoom navigation settings (no change, zoom to whole model, or whole workspace on 
		// model change etc.) are overridden. Track that state here.
		_overrideNavZoom: false,
		
		// If an action has a click pending, we store that state here to override certain events which might
		// interfer (redraws, tooltips, etc.)
		_actionClickPending: null,
		
		// If this Canvas is not currently enabled (scroll bars should be shut off and clicks should not respond)
		// we set disabled to false. 
		// TODO: make this Stateful and set up the Setter method to pause scroll handlers and clicks and create/show
		// a disabling overlay
		disabled: false,
		
		// The property names of the zoom states this canvas' zoom controller is associated with
		_zoomStates: null,
		
		// We don't want to redraw unless the container actually resized, so we store its
		// last size here for comparison
		_lastWrapperSize: null,	
		
		// Aspect.after handler for resizing any time the Canvas wrapper has resized. We store this
		// reference so we can disable this handler in certain load cases
		_resizingAspect: null,
		
		// Draw events may need to be disabled at times while leaving the rest of th Canvas active
		_drawEventsGo: null,
		
		// Numerous BTCanvases can exist due to dialogs (eg. Draw Gene, Pathing Display), but only one
		// BTCanvas is ever the Primary BTCanvas, and that BTCanvas is the only one with access to 
		// the ModelTree
		_isPrimaryCanvas: null,
		
		// function for removing the resizing aspect
		_removeResizingAspect: function() {
			this._resizingAspect && this._resizingAspect.remove();
		},
		
		// function to make the resizing aspect
		_makeResizingAspect: function() {
			var self=this;
			
			// If it already exists, remove it
			this._resizingAspect && this._resizingAspect.remove();
			
			this._resizingAspect = aspect.after(registry.byId(self._cnvWrapperNodeId),"resize",function(){
            	// If resize was emitted without an actual resize then don't actually redraw, 
            	// because widget.resize is emitted quite frequently without any change in size
            	if(!self._lastWrapperSize || 
        			(self._lastWrapperSize.w !== dom.byId(self._cnvWrapperNodeId).clientWidth
        				|| self._lastWrapperSize.h !== dom.byId(self._cnvWrapperNodeId).clientHeight)
				) {
            		if(!self._lastWrapperSize) {
            			self._lastWrapperSize = {};
            		}
            		
        			// If a user 'zooms in' the browser UI, it can play havoc with the expected scrollbar size in non-IE browsers
        			// Recalculate the needed size any time this is done
        			if(!(has("ie") || has("trident"))) {
            			SCROLL_BAR_SIZE = utils.calcScrollbarSize();
            			SCROLL_BAR_SPACE = SCROLL_BAR_SIZE+1;
            		}
            		
            		self._lastWrapperSize.w = dom.byId(self._cnvWrapperNodeId).clientWidth;
            		self._lastWrapperSize.h = dom.byId(self._cnvWrapperNodeId).clientHeight;
            		if(self._currentModel && self._rendererIsValid) {
            			self._drawCanvas();
        			} else {
        				self._toggleCanvas(); 
        				self._zoom(self._currentZoomLevel);
        				self._swapCanvas();
    				}
            	}
            });
		},
		
		/////////////////////////////
		// _zoom
		////////////////////////////
		//
		// Given old and new zoom values (which may be the same, or in the case of newZoomLevel, omitted)
		// this function will calculate the new translations in effect for the Canvas and virtual scrolling
		// system and apply them to the element in _canvas. **This method does not actually cause a draw
		// event to occur, draw events must be invoked after this method in order to visualize the
		// results**
		_zoom: function(oldZoomLevel,newZoomLevel) {
						
			// A no-zoom-change operation will still trigger display optimization
			// We treat this as newZoomLevel === oldZoomLevel and set it accordingly
			newZoomLevel = (newZoomLevel !== undefined && newZoomLevel !== null ? newZoomLevel : oldZoomLevel);
			
			var zoomLevels = {
				newZoomScale: ZoomController.getZoomValue(newZoomLevel),
				oldZoomScale: this._currentZoomValue
			};
			
			this._currentZoomValue = zoomLevels.newZoomScale;
			
			var grnWrapper = dom.byId(this._cnvWrapperNodeId);
			var grn = dom.byId(this._cnvContainerNodeId);
			
			var scrollh = dom.byId("scrollh_" + this._cnvContainerNodeId);
			var scrollv = dom.byId("scrollv_" + this._cnvContainerNodeId);
			
			var wsOnCnvCtr = {
				x: Math.round(this._canvas.width/2)+scrollh.scrollLeft,
				y: Math.round(this._canvas.height/2)+scrollv.scrollTop
			};
			
			var currScroll = {
				left: scrollh.scrollLeft,
				top: scrollv.scrollTop
			};
			
			// if this zoom call is the result of the canvas DOM node being resized, 
			// that will factor into our translation and scrolling; if not, this
			// value will be 0
			var grnResize = {
				w: ((grnWrapper.clientWidth-SCROLL_BAR_SPACE)-this._canvas.width),
				h: ((grnWrapper.clientHeight-SCROLL_BAR_SPACE)-this._canvas.height)
			};
			
			this._clearCanvas();
			this._canvasRenderer.context_setTransform(1, 0, 0, 1, 0, 0);	
						
			// Adjust the sizes of our virtual scrollbars according to the new scale
			this._adjustScrolling(zoomLevels.newZoomScale);
			
			var grnStyleChange = null;
			
			// Don't set a new container style unless it's truly needed
			if(grnResize.w !== 0) {
				this._canvas.width = grnWrapper.clientWidth-SCROLL_BAR_SPACE;
				grnStyleChange = grnStyleChange || {};
				grnStyleChange.width = (grnWrapper.clientWidth-SCROLL_BAR_SPACE)+"px";
			}
			if(grnResize.h !== 0) {
				this._canvas.height = grnWrapper.clientHeight-SCROLL_BAR_SPACE;
				grnStyleChange = grnStyleChange || {};
				grnStyleChange.height = (grnWrapper.clientHeight-SCROLL_BAR_SPACE)+"px";
			}
			
			if(grnStyleChange) {
				domStyle.set(grn,grnStyleChange);	
			}
			
			// If there's no current model, we're done
			if(!this._currentModel) { return; }

			// Initial translation of the canvas based on the new zoom setting
			this._canvasTranslation = {
				x: -(this._currentModel.drawingObject_.workspace.x*zoomLevels.newZoomScale),
				y: -(this._currentModel.drawingObject_.workspace.y*zoomLevels.newZoomScale)
			};			
			
			// Adjust the translation based on our workspace size relative to the viewport size 
			//
			// If our proposed drawing area (worksapceDimensions times the scaling) is bigger
			// than our actual canvas, we will be translating to that center
			if(this._workspaceDimensions.width*zoomLevels.newZoomScale > this._canvas.width) {
				if(this._scrollHandlers.scrollh === null) {
					this._initScrollH(zoomLevels.newZoomScale);
					currScroll.left=scrollh.scrollLeft;
				} else {
					// Adjust the scrollbars so that whatever was on the canvas center before this event is still
					// under it after
					scrollh.scrollLeft=Math.round(wsOnCnvCtr.x*((zoomLevels.newZoomScale/zoomLevels.oldZoomScale)-1))+currScroll.left-(Math.round(grnResize.w/4));
				}
			} else {
				// disable scrolling and translate to the center of the canvas
				this._disableScrollH();
				this._canvasTranslation.x = Math.round(this._canvas.width/2)
					-((this._currentModel.drawingObject_.workspace.x+(this._currentModel.drawingObject_.workspace.w/2))*zoomLevels.newZoomScale);
			}

			if(this._workspaceDimensions.height*zoomLevels.newZoomScale > this._canvas.height) {
				if(this._scrollHandlers.scrollv === null){
					this._initScrollV(zoomLevels.newZoomScale);
					currScroll.top = scrollv.scrollTop;
				} else {
					// Adjust the scrollbars so that whatever was on the canvas center before this event is still
					// under it after					
					scrollv.scrollTop=Math.round(wsOnCnvCtr.y*((zoomLevels.newZoomScale/zoomLevels.oldZoomScale)-1))+currScroll.top-(Math.round(grnResize.h/4));
				}
			} else {
				// disable scrolling and translate to the center of the canvas				
				this._disableScrollV();
				this._canvasTranslation.y = Math.round(this._canvas.height/2)
					-((this._currentModel.drawingObject_.workspace.y+(this._currentModel.drawingObject_.workspace.h/2))*zoomLevels.newZoomScale);
			}
			
			// The translation that is placed on the renderer must be adjusted by the scrollbars as well			
			this._canvasRenderer.context_translate(
				this._canvasTranslation.x - scrollh.scrollLeft,
				this._canvasTranslation.y - scrollv.scrollTop
			);

			this._canvasRenderer.context_scale(zoomLevels.newZoomScale,zoomLevels.newZoomScale);
		},
		
		// If the loading element does not exist, create it, and then show or hide it depending
		// on the value of the hide variable
		_showLoading: function(hide) {
/*			
			if(!this._loadingScreen) {
				this._loadingScreen = domConstruct.create(
					"div",{
						id: "CanvasLoading",
						width: this._canvas.width + "px",
						height: this._canvas.height + "px",
						innerHTML: "<p>Loading...</p>"
					}
				);
				domStyle.set(this._loadingScreen,"display","none");
				domConstruct.place(this._loadingScreen,dom.byId(this._cnvWrapperNodeId),"first");
			}
			domStyle.set(this._loadingScreen,{"display":(hide ? "none" : "block"),width:this._canvas.width + "px",height:this._canvas.height + "px"});
*/
		},
		
		/////////////////////////////
		// _getEntityNames
		/////////////////////////////
		//
		// The names of any entities are stored in the renderer. Given an array of IDs, this will fetch the
		// name set from the renderer and pull out the names requested. This is a deferred event because
		// the canvas must be done with its initial load in order for this to complete
		//
		_getEntityNames: function(ids) {
			var self=this;
			var loadAsync = new Deferred();
			this._canvasReady.promise.then(function(){
				var names = {};
				var entities = self._canvasRenderer.getAllSelectedMap(self._currentModel.get("modelId_"));
				DojoArray.forEach(ids,function(id){
					names[id] = entities[id].getName();
				});
				loadAsync.resolve(names);
			});
			return loadAsync.promise;
		},
		
		////////////////////////////////////
		// _translateHit
		///////////////////////////////////
		//
		// Hits reported by events will be in window coordinates; we need to translate 
		// them into model world coordinates before we can ask the server or renderer 
		// to do anything with them
		//
		_translateHit: function(hit) {
			var translatedHit = {
				x: hit.x,
				y: hit.y
			};
			
			var scrollh = dom.byId("scrollh_" + this._cnvContainerNodeId);
			var scrollv = dom.byId("scrollv_" + this._cnvContainerNodeId);
			
			// convert to canvas coordinates
			translatedHit.x -= this._canvas.getBoundingClientRect().left;
			translatedHit.y -= this._canvas.getBoundingClientRect().top;
			
			// translate from canvas coordinates to unzoomed world coordinates
			translatedHit.x = (translatedHit.x-(this._canvasTranslation.x-scrollh.scrollLeft))/(ZoomController.getZoomValue(this._currentZoomLevel));
			translatedHit.y = (translatedHit.y-(this._canvasTranslation.y-scrollv.scrollTop))/(ZoomController.getZoomValue(this._currentZoomLevel));
			
			return translatedHit;
		},
	
		/////////////////////////
		// _clearCanvas
		////////////////////////
		//
		// clear out the contents of the _canvas element
		//
		_clearCanvas: function() {
			if(this._canvas) {
				this._canvasRenderer.context_save();
				
				var grnWrapper = dom.byId(this._cnvWrapperNodeId);
				
				this._canvas.width = grnWrapper.clientWidth-SCROLL_BAR_SPACE;
				this._canvas.height = grnWrapper.clientHeight-SCROLL_BAR_SPACE;

				// Use the identity matrix while clearing the canvas
				this._canvasRenderer.context_setTransform(1, 0, 0, 1, 0, 0);
				this._canvasRenderer.context_clearRect(0, 0, this._canvas.width, this._canvas.height);

				// Restore the transform
				this._canvasRenderer.context_restore();
			}	
		},
		
		
		/////////////////////////////////////
		// _drawWorkspace
		////////////////////////////////////
		//
		// Draw the workspace area behind a model.
		//
		_drawWorkspace: function() {
			this._canvasRenderer.ctx.beginPath();
			this._canvasRenderer.ctx.fillStyle = "white";
			this._canvasRenderer.ctx.strokeStyle = "gray";
			this._canvasRenderer.ctx.rect(
				this._currentModel.drawingObject_.center_x-Math.round(this._workspaceDimensions.width/2),
				this._currentModel.drawingObject_.center_y-Math.round(this._workspaceDimensions.height/2),
				this._workspaceDimensions.width,
				this._workspaceDimensions.height
			);
			this._canvasRenderer.ctx.fill();
			this._canvasRenderer.ctx.stroke();
			this._canvasRenderer.ctx.closePath();			
		},
		
		////////////////////////////////
		// _updateOverlay
		////////////////////////////////
		//
		// Update the overlay in the renderer, but only if we have a valid model.
		// 
		_updateOverlay: function() {
			if(this._currentModel) {
				var overlay = this._currentModel.get("overlay_") || {id: null};
				this._canvasRenderer.setOverlayIntensity(overlay.id ? overlay.intensity : 1);
				this._canvasRenderer.toggleOverlay(overlay);
			}
		},
		
		////////////////////////////////
		// _updateRegionToggles
		////////////////////////////////
		//
		// Update any toggled regions in the renderer, but only if we have a valid model.
		// 		
		_updateRegionToggles: function() {
			if(this._currentModel) {
				var toggledRegions = this._currentModel.get("toggledRegions_") || {};
				toggledRegions && this._canvasRenderer.toggleGroupForModelID(this._currentModel.get("modelId_"),Object.keys(toggledRegions));
			}
		},
		

		///////////////
		// _drawModel
		///////////////
		//
		// Primary drawing method. Draws the workspace (white rectangle), sets toggled regions and overlays, 
		// then kicks off the Canvas Renderer draw functions.
		// 
		_drawModel: function() {		
			this._willDrawWorkspace && this._drawWorkspace();
			this._canvasRenderer.renderModelByIDFull(this._currentModel.get("modelId_"));
		},	
		
		///////////////////////////////
		// _redraw
		//////////////////////////////
		//
		// Method invoked for model state changes (active model, active overlay, etc.)
		// 
		_redraw: function(modelId,withSelect,selectedNodes,zoomMode,bounds) {
			var asyncRedraw = new Deferred();
			var self=this;
			var drawWithZoom = function(drawZoomMode){
				if(self._overrideNavZoom) {
					drawZoomMode = "NAV_MAINTAIN_ZOOM";
				}
				switch(drawZoomMode){
					case "NAV_ZOOM_TO_EACH_MODEL":
					case "FIRST_ZOOM_TO_CURRENT_MODEL":
						self.zoomToWholeModel();
						break;
					case "FIRST_ZOOM_TO_ALL_MODELS":
						self.zoomToAllModels(bounds);
						break;
					case "FIRST_ZOOM_TO_WORKSPACE":
						self.zoomToWholeWorkspace();
						break;
					case "NAV_MAINTAIN_ZOOM":
					default:
						self._drawCanvas();
						break;
				}
			};
			this._showLoading();
			if(!modelId) {
	    		self._updateOverlay();
	    		self._updateRegionToggles();
				if(withSelect) {
					self._selectNodes(selectedNodes).then(drawWithZoom(zoomMode));
				} else {
					drawWithZoom(zoomMode);
				}
				asyncRedraw.resolve();
				self._showLoading(true);				
			} else {
				self._loadModel(modelId).then(function(){
		    		self._updateOverlay();
		    		self._updateRegionToggles();
					if(withSelect) {
						self._selectNodes(selectedNodes).then(drawWithZoom(zoomMode));
					} else {
						drawWithZoom(zoomMode);
					}
					asyncRedraw.resolve();
					self._showLoading(true);
				},function(err){
					// Clear out both canvases
					self._clearCanvas();
					self._toggleCanvas();
					self._swapCanvas();
					self._clearCanvas();
					// Reset our scrolling and disable it
					self._adjustScrolling(self._currentZoomValue);
					self._disableScrolling();
					asyncRedraw.resolve();
					// Hide the loading element
					self._showLoading(true);
				});
			}
			return asyncRedraw.promise;
		},
		
		////////////////
		// _loadModel
		////////////////
		//
		// Requests the specified model from the ArtboardController and, if needed, adds it to the 
		// renderer cache and saves a copy of the reference locally. This method is asynchronous
		// because on the ArtboardController end a model may still be loading from the server, in 
		// which case the renderer and canvas have to wait. 
		// 
		// If a modelId is not provided, the current model on the ArtboardController is requested
		//
		_loadModel: function(modelId) {
			var self=this;
			this._asyncModelLoader = new Deferred();
			var loadingModel = (modelId ? 
				ArtboardController.getArtboardController(this._cnvContainerNodeId).getModel(modelId) 
				: ArtboardController.getArtboardController(this._cnvContainerNodeId).getCurrentModel());
			loadingModel.then(function(loadedModel){
				if(!loadedModel) {
					console.warn("[WARNING] No model for " + modelId);
					self._currentModel = null;
					self._asyncModelLoader.reject();
				} else {
					var oldModel = self._currentModel;
					self._currentModel = loadedModel;
					if(oldModel) {
						self._overrideNavZoom = (
							// If we are moving to or from the root, always obey zoom settings
							(oldModel.depth_ > 0 && loadedModel.depth_ > 0) && (	// Otherwise...
								// state change, don't zoom
								loadedModel.get("modelId_") === oldModel.get("modelId_")
								// traversal within a given VfA's children, but we have to add a check for VfA to VfA transition (because their
								// vfgParent_ values will match)
								|| (oldModel.vfgParent_ === loadedModel.vfgParent_ && (oldModel.depth_ > 1 || loadedModel.depth_ > 1))
								|| oldModel.vfgParent_ === loadedModel.get("modelId_")
								|| loadedModel.vfgParent_ === oldModel.get("modelId_"))
							);
					}
					
					self._workspaceDimensions.width = loadedModel.drawingObject_.workspace.w; 
					self._workspaceDimensions.height = loadedModel.drawingObject_.workspace.h;
					
					require([self._networkModelController],function(networkModelController){
						if(!networkModelController.drawingObjIsCached(loadedModel.get("modelId_"))) {
							self._canvasRenderer.addModel(
								loadedModel.get("modelId_"),
								loadedModel.drawingObject_.overlay_data,
								loadedModel.drawingObject_.draw_layer_groups,
								loadedModel.drawingObject_.fonts
							);
							networkModelController.setCachedInRenderer(loadedModel.get("modelId_"),true);
						}
						self._asyncModelLoader.resolve(loadedModel);
						self._rendererIsValid = true;
					});
				}
			},function(err){
				self._asyncModelLoader.reject(err);
			});
			return this._asyncModelLoader.promise;
		},
		
		////////////////////////////////////
		// _adjustScrolling
		////////////////////////////////////
		//
		// Resizes the virutal scrolling system, both the visible scrollbar area and the
		// cnvw and cnvh DIVs which virtualizae the workspace size.
		//
		_adjustScrolling: function(currScale) {
			var grnWrapper = dom.byId(this._cnvWrapperNodeId);
			var scrollh = dom.byId("scrollh_" + this._cnvContainerNodeId);
			var scrollv = dom.byId("scrollv_" + this._cnvContainerNodeId);	
						
			domStyle.set(scrollh,{width: (grnWrapper.clientWidth-SCROLL_BAR_SPACE) + "px",height: SCROLL_BAR_SIZE+"px"});
			domStyle.set(scrollv,{height: (grnWrapper.clientHeight-SCROLL_BAR_SPACE) + "px",width: SCROLL_BAR_SIZE+"px"});
			
			var cnvw = dom.byId("cnvw_" + this._cnvContainerNodeId);
			domStyle.set(cnvw,"width",this._workspaceDimensions.width*currScale + "px");
			
			var cnvh = dom.byId("cnvh_" + this._cnvContainerNodeId);
			domStyle.set(cnvh,"height",this._workspaceDimensions.height*currScale + "px");
		},
		
		////////////////////////////////////
		// _scrollToWorldPoint
		////////////////////////////////////
		//		
		// Given a world coordinate on the model, convert it to scrolling values
		// and adjust our scrolling
		//
		_scrollToWorldPoint: function(point) {
			var scrollh = dom.byId("scrollh_" + this._cnvContainerNodeId);
			var scrollv = dom.byId("scrollv_" + this._cnvContainerNodeId);	
			
			var wsCoords = {
				x: point.x,
				y: point.y
			};
			
			wsCoords.x = (ZoomController.getZoomValue(this._currentZoomLevel) * point.x) + this._canvasTranslation.x;
			wsCoords.y = (ZoomController.getZoomValue(this._currentZoomLevel) * point.y) + this._canvasTranslation.y;
			
			scrollh.scrollLeft = wsCoords.x-(this._canvas.width/2);
			scrollv.scrollTop = wsCoords.y-(this._canvas.height/2);
		},
		
	/////////////////////////////////////////////////////
	// Virtual Scrolling
	/////////////////////////////////////////////////////
			
		// Set up the vertical virtual scroll element.
		_initScrollV: function(zoomScale) {
			var scrollv = dom.byId("scrollv_" + this._cnvContainerNodeId);
			var self=this;
			
			var scrollDraw = function(e) {
        		if(self._rendererIsValid) {
        			self._drawCanvas();
        		}
        	};
			
        	scrollv.scrollTop = Math.round(((this._workspaceDimensions.height*zoomScale)-this._canvas.height)/2);
        	
        	this._scrollHandlers.scrollv=on(scrollv,"scroll",throttle(scrollDraw,THROTTLE_RATE));
        	// To ensure the scroll positions are synced with the canvas, we add a debounce lagging
        	// just behind the throttled redraws, to make sure the draw fires one last time and 
        	// syncs up the canvas translations with the scroll positions
        	this._scrollHandlers.scrollvd=on(scrollv,"scroll",debounce(scrollDraw,DEBOUNCE_DELAY));
        	
        	if(!this._scrollHandlers.dragToScroll) {
        		this._initDragToScroll();
        	}
		},

		// Set up the horizontal virtual scroll element.
		_initScrollH: function(zoomScale) {
			
			var scrollh = dom.byId("scrollh_" + this._cnvContainerNodeId);
			var self=this;
			
			var scrollDraw = function(e) {
        		if(self._rendererIsValid) {
        			self._drawCanvas();
        		}
        	};
			
        	scrollh.scrollLeft = Math.round(((this._workspaceDimensions.width*zoomScale)-this._canvas.width)/2);
        	
        	this._scrollHandlers.scrollh=on(scrollh,"scroll",throttle(scrollDraw,THROTTLE_RATE));
        	// To ensure the scroll positions are synced with the canvas, we add a debounce lagging
        	// just behind the throttled redraws, to make sure the draw fires one last time and 
        	// syncs up the canvas translations with the scroll positions
        	this._scrollHandlers.scrollhd=on(scrollh,"scroll",debounce(scrollDraw,DEBOUNCE_DELAY));
        	
        	if(!this._scrollHandlers.dragToScroll) {
        		this._initDragToScroll();
        	}
		},

		// Disable the horizontal scroll element's event
		_disableScrollH: function() {
			if(this._scrollHandlers.scrollh) {
				this._scrollHandlers.scrollh.remove();
				this._scrollHandlers.scrollhd.remove();
				this._scrollHandlers.scrollh = null;
				this._scrollHandlers.scrollhd = null;
			}
			if(!this._scrollHandlers.scrollv) {
				this._disableDragToScroll();
			}
		},
		
		// Disable the vertical scroll element's event
		_disableScrollV: function() {
			if(this._scrollHandlers.scrollv) {
				this._scrollHandlers.scrollv.remove();
				this._scrollHandlers.scrollvd.remove();
				this._scrollHandlers.scrollv = null;
				this._scrollHandlers.scrollvd = null;
			}
			if(!this._scrollHandlers.scrollh) {
				this._disableDragToScroll();
			}			
		},
		
		// We don't throttle this mousemove event, because it fires the primary scrolling events, 
		// and those are already throttling.
		_initDragToScroll: function() {
			var self=this;
			this._scrollHandlers.dragToScroll = {};
			
			this._scrollHandlers.dragToScroll.move = on(window,"mousemove",function(e){

				var scrollh = dom.byId("scrollh_" + self._cnvContainerNodeId);
				var scrollv = dom.byId("scrollv_" + self._cnvContainerNodeId);				
				if(e.ctrlKey && !e.shiftKey && !e.altKey && self._scrollHandlers.dragToScroll.mouseIsDown) {
					if(self._scrollHandlers.scrollh) {
						scrollh.scrollLeft += (self._scrollHandlers.dragToScroll.mouseStatus.currX-e.clientX);
					}
					if(self._scrollHandlers.scrollv) {
						scrollv.scrollTop += (self._scrollHandlers.dragToScroll.mouseStatus.currY-e.clientY);
					}
					self._scrollHandlers.dragToScroll.mouseStatus.currX = e.clientX;
					self._scrollHandlers.dragToScroll.mouseStatus.currY = e.clientY;
				}
			});
			
			// Only begin dragging on a *left* mousedown
			this._scrollHandlers.dragToScroll.down = on(dom.byId(this._cnvContainerNodeId),"mousedown",function(e){
				if(e.ctrlKey && !e.shiftKey && !e.altKey && mouse.isLeft(e)) {
					self._scrollHandlers.dragToScroll.mouseStatus = {
						currX: e.clientX,
						currY: e.clientY
					};
					self._scrollHandlers.dragToScroll.mouseIsDown = true;
					e.preventDefault();
					e.stopPropagation();
				}
			});
			this._scrollHandlers.dragToScroll.up = on(document.body,"mouseup",function(e){
				if(self._scrollHandlers && self._scrollHandlers.dragToScroll) {
					self._scrollHandlers.dragToScroll.mouseIsDown = false;
				}
			});
			this._scrollHandlers.dragToScroll.leave = on(document.body,"mouseleave",function(e){
				if(self._scrollHandlers && self._scrollHandlers.dragToScroll) {
					self._scrollHandlers.dragToScroll.mouseIsDown = false;
				}
			});
			this._scrollHandlers.dragToScroll.click = on(window,"click",function(e){
				if(self._scrollHandlers && self._scrollHandlers.dragToScroll) {
					self._scrollHandlers.dragToScroll.mouseIsDown = false;
				}
			});
		},
		
		// Disable control-click scroll dragging
		_disableDragToScroll: function() {
			if(this._scrollHandlers.dragToScroll) {
				this._scrollHandlers.dragToScroll.up.remove();
				this._scrollHandlers.dragToScroll.leave.remove();
				this._scrollHandlers.dragToScroll.click.remove();
				this._scrollHandlers.dragToScroll.move.remove();
				this._scrollHandlers.dragToScroll.down.remove();
				delete this._scrollHandlers.dragToScroll;
			}
		},
		
		// Disable both scroll elements' indidvidual events, and the combined dragToScroll event
		_disableScrolling: function() {
			this._disableScrollH();
			this._disableScrollV();
			this._disableDragToScroll();
		},
		
		///////////////////////////////
		// _makeOffCanvas
		//////////////////////////////
		//
		// Build the DOM element for the _offCanvas variable
		_makeOffCanvas: function() {
			if(!this._offCanvas) {
				var grnWrapper = dom.byId(this._cnvWrapperNodeId);
				this._offCanvas = domConstruct.create(
					"canvas",{
						id: this._cnvContainerNodeId + "Canvas2" + "_" + utils.makeId(),
						width: grnWrapper.clientWidth-SCROLL_BAR_SPACE,
						height: grnWrapper.clientHeight-SCROLL_BAR_SPACE
					}
				);
			}
		},
		
		///////////////////////////////
		// _toggleCanvas
		//////////////////////////////
		//
		// Switch the private canvas references
		//
		_toggleCanvas: function(){			
			if(!this._offCanvas) {
				this._makeOffCanvas();
			} else if(this._offCanvas.parentNode) {
				// This means a swap has already been performed, and is waiting on a toggle.
				// We really shouldn't be here, so we'll warn and quit.
				console.warn("[WARNING] Canvases are already swapped!");
				return;
			}
			
			var tmp = this._canvas;
			this._canvas = this._offCanvas;
			this._offCanvas = tmp;
			
			this._canvasRenderer.setElementAndContext(this._canvas);
		},
		
		///////////////////////////////
		// _swapCanvas
		//////////////////////////////
		//
		// Swap the canvas DOM nodes
		//
		_swapCanvas: function() {
			domConstruct.place(this._canvas,this._offCanvas,"replace");	
		},
		
		///////////////////////////////
		// _drawCanvas
		//////////////////////////////
		//
		// Primary draw method. Toggles the canvases, sets the zoom values
		// and adjusts the scroll settings, draws the model, and swaps
		// the canvases
		//		
		_drawCanvas: function(zoomToVal) {
    		this._toggleCanvas();
    		this._zoom(this._currentZoomLevel,zoomToVal);
    		if(zoomToVal !== undefined && zoomToVal !== null) {
    			this._currentZoomLevel = zoomToVal;
			}
			this._drawModel();   
			this._swapCanvas();
		},
		
		/////////////////////////////////////
		// _buildCanvas
		////////////////////////////////////
		//
		// Build the canvas element and its accompanying virtual scrolling system.
		//
		_buildCanvas: function() {
			
			var grnWrapper = dom.byId(this._cnvWrapperNodeId);
			var self=this;
			
			var cnvRow1 = domConstruct.create("div",{id: "cnvRow1_" + this._cnvContainerNodeId, width: (grnWrapper.clientWidth-2)},grnWrapper,"last");
			var cnvRow2 = domConstruct.create("div",{id: "cnvRow2_" + this._cnvContainerNodeId, width: (grnWrapper.clientWidth-SCROLL_BAR_SIZE)},grnWrapper,"last");
						
			var grn = domConstruct.create("div",{
				id: this._cnvContainerNodeId,
				"class":"CanvasContainer"
			},cnvRow1,"first");
						
			// The ModelController for this Canvas will not be aware of the Canvas container ID inherently, so once the DIV is made
			// we need to inform it
			require([this._networkModelController],function(networkModelController){
				networkModelController.set("cnvContainerDomNodeId_",self._cnvContainerNodeId);
			});
			
			this._canvas = domConstruct.create(
				"canvas",{
					id: this._cnvContainerNodeId + "Canvas1" + "_" + utils.makeId(),
					width: grnWrapper.clientWidth-SCROLL_BAR_SPACE,
					height: grnWrapper.clientHeight-SCROLL_BAR_SPACE
				}, 
				grn
			);
			
			// Fun with OSX scrollbars
			//			
			// OSX Lion+ can be set to autohide scrollbars between scroll uses at the system level.
			// Most browsers now abide by this behavior. This presents a problem for our Canvas because 
			// the elements actually generating the scrollbars (hidden DIVs) are not the element being 
			// scrolled (the Canvas). We solve this in Webkit browsers by checking for OSX, and then 
			// applying a special CSS class that disables the normal scrollbars (to prevent them from 
			// showing up when autohide is disabled, or when they would normally) and then skin our own, 
			// which we force to always be visible.
			// 
			// This is a suboptimal solution, since it overrides what is presumably the user's choice to 
			// have scroll bars fade and show, but it is the most consistent one given the virtual nature 
			// our scrolling system.
			//
			// There is currently no solution available for Firefox which does not rely on Js scrollbars, which
			// we avoid using in favor of native browser scrollbars.
			//
			var scrollClass = (has("mac") && has("webkit")) ? "osxScroll" : "";
			
			var scrollh = domConstruct.create(
				"div",{
					id: "scrollh_" + this._cnvContainerNodeId,
					style: "width: " + (grnWrapper.clientWidth-SCROLL_BAR_SIZE) + "px; "
						+ "height: " + SCROLL_BAR_SIZE + "px; float:left; overflow-x: scroll; overflow-y: hidden;",
					"class": scrollClass
				},cnvRow2
			);

			var scrollv = domConstruct.create(
				"div",{
					id: "scrollv_" + this._cnvContainerNodeId,
					style: "height: " + (grnWrapper.clientHeight-SCROLL_BAR_SIZE) + "px; "
						+ "width: " + SCROLL_BAR_SIZE + "px; overflow-x: hidden; overflow-y: scroll;",
					"class": scrollClass
				},
				cnvRow1,"last"
			);
			
			// There may be various click and mousedown events on the canvas itself; when the scroll bars are clicked on,
			// we don't want those to fire.
			this.own(on(scrollv,"mousedown",function(e){e.preventDefault(); e.stopPropagation();}));
			this.own(on(scrollh,"mousedown",function(e){e.preventDefault(); e.stopPropagation();}));
			
			// We need to create a scrollwheel event for our Canvas container
			// since we've shut off native scrolling.
			
			// Safari needs mousewheel; other browsers can use wheel. In addition, Safari's mousewheel returns a negative 
			// numer for mousewheel down and a positive value for mousewheel up, while in other browsers the signs are reversed.
			if(has("safari")) {
				this.own(on(grnWrapper,"mousewheel",function(e){
					var wheelDelt = e.deltaY || e.wheelDelta || e.wheelDeltaY;
					if(self._scrollHandlers.scrollv !== null) {
						scrollv.scrollTop-=(((wheelDelt/Math.abs(wheelDelt))*WHEEL_SCROLL_VALUE));		
					}
				}));
			} else {
				this.own(on(grnWrapper,"wheel",function(e){
					var wheelDelt = e.deltaY || e.wheelDelta || e.wheelDeltaY;
					if(self._scrollHandlers.scrollv !== null) {
						scrollv.scrollTop-=(((wheelDelt/Math.abs(wheelDelt))*-WHEEL_SCROLL_VALUE));					
					}
				}));
			}
			
			// We need to create up/down arrow scroll events for our Canvas container since we've shut off native scrolling.
			this.own(on(grnWrapper,"keydown",function(e){
				var shift = KB_SCROLL_VALUE;
				
				switch(e.keyCode) {
					case keys.LEFT_ARROW:
						// Left shift needs to subtract, not add
						shift *= -1;
					case keys.RIGHT_ARROW:
						if(self._scrollHandlers.scrollh) {
							scrollh.scrollLeft += shift;
						}
						break;
					case keys.UP_ARROW:
						// Up shift needs to subtract, not add
						shift *= -1;
					case keys.DOWN_ARROW:
						if(self._scrollHandlers.scrollv) {
							scrollv.scrollTop += shift;
						}
						break;
					default:
						break;
				}
			}));
			
			domConstruct.create(
				"div",{
					id: "cnvw_" + this._cnvContainerNodeId,
					style: "width: " + this._canvas.width + "px; "
						+ "height: 1px;"
				},scrollh
			);
			
			domConstruct.create(
				"div",{
					id: "cnvh_" + this._cnvContainerNodeId,
					style: "height: " + this._canvas.height + "px; "
						+ "width: 1px;"
				},scrollv
			);
		},
		
		//////////////////////////////
		// _selectNodes
		/////////////////////////////
		//
		// Send an object containing either nodes to select, or an empty object to
		// deselect all nodes, into the renderer. Due to the asynchronous load of models,
		// this method is asynchronous and returns a Deferred.promise for registering
		// callbacks
	    _selectNodes: function(nodesToSelect) {
	    	var self=this;
	    	var asyncSelector = new Deferred();
	    	this._asyncModelLoader.promise.then(function(model){
	    		if(!self._currentModel) {
	    			asyncSelector.reject();
	    		} else {
			    	if(!nodesToSelect) {
			    		nodesToSelect = {};
			    	}
		    		self._canvasRenderer.setSelectedNodeIDMap(self._currentModel.get("modelId_"),nodesToSelect);
		    		asyncSelector.resolve();	
	    		}
	    	},function(err){
	    		console.error("[ERROR] Loader rejected in node selection with error: ",err);
	    	});
	    	return asyncSelector.promise;
	    },
	    
	    _setActionClickPending: function(isPending) {
	    	this._actionClickPending = isPending;
	    },
	    
	    //////////////////////////////
	    // _toggleWatchEvents
	    /////////////////////////////
	    //
	    // Toggle the value of _drawEventsGo
	    _toggleWatchEvents: function() {
	    	this._drawEventsGo = !this._drawEventsGo;
	    },
	    
	    //////////////////////////////////
	    // toggleBoundsDebug
	    /////////////////////////////////
	    //
	    // Method for turning on drawing of hit bounds on rendered objects
	    //
		toggleBoundsDebug: function() {
			if(this._canvasRenderer) {
                this._canvasRenderer.switchBoundsDebug();
                this._drawModel();
			}
		},
	    
	    //////////////////////////////////
	    // flushRendererCache
	    /////////////////////////////////
	    //
	    // Empty the contents of the renderer cache
	    //
		flushRendererCache: function(modelIds) {
			this._rendererIsValid = false;
			var self=this;
			DojoArray.forEach(modelIds,function(modelId){
				self._canvasRenderer.removeModel(modelId);
				if(self._currentModel && (self._currentModel.get("modelId_") === modelId)) {
					self._canvasIsReady = false;
					self._canvasReady = new Deferred();
					self._currentModel = null;
				}
			});
		},
			
		////////////////////////////////
		// redrawModel
		////////////////////////////////
		//
		// Force the model to rerender
		//
		redrawModel: function() {
			this._drawModel();
		},
	    
		///////////////////////////////////////
		// attachLeftClickEvent
		/////////////////////////////////////
		//
		// Attach callbacks to the click event when the left key is used. Can provide 
		// key+leftclick alternate callbacks if desired
		//
	    attachLeftClickEvent: function(leftOnlyCallback,shiftLeftCallback,ctrlLeftCallback,altLeftCallback) {
	    	var self=this;
	    	
            this.own(
    			on(dom.byId(this._cnvContainerNodeId),"click",function(e){
    				if(!(self._actionClickPending === true) && self._currentModel && self._currentModel.drawingObject_) {
	    				if(mouse.isLeft(e) && !e.ctrlKey && !e.shiftKey && !e.altKey) {
	    					leftOnlyCallback && leftOnlyCallback(e);
	    				}
	    				if(mouse.isLeft(e) && !e.ctrlKey && e.shiftKey && !e.altKey) {
	    					shiftLeftCallback && shiftLeftCallback(e);
	    				}
	    				if(mouse.isLeft(e) && e.ctrlKey && !e.shiftKey && !e.altKey) {
	    					ctrlLeftCallback && ctrlLeftCallback(e);
	    				}
	    				if(mouse.isLeft(e) && !e.ctrlKey && !e.shiftKey && e.altKey) {
	    					altLeftCallback && altLeftCallback(e);
	    				}
    				}
    			})
            );
	    },
	    
	    ////////////////////////////////
	    // attachRightClickEvent
	    ///////////////////////////////
	    //
	    // Assign a callback to mousedown events where the right mouse button is
	    // in use, and no keyboard keys are being pressed
	    //
	    attachRightClickEvent: function(callback) {
	    	var self=this;
            this.own(
            	on(dom.byId(this._cnvContainerNodeId),"mousedown",function(e){
            		if(((mouse.isRight(e) || (mouse.isLeft(e) && e.ctrlKey)) && !e.shiftKey && !e.altKey)
        				&& self._currentModel && self._currentModel.drawingObject_) {
            			callback(e);
            		}
            	})
            );   	
	    },
	    	  
	    /////////////////////////////////////
	    // attachNoteEvent
	    /////////////////////////////////////
	    //
	    // Attach a callback to the 'note' event, i.e. mousing over a note object
	    // on the canvas
	    //
	    attachNoteEvent: function(callback) {
	    	var self=this;
	    	require(["views/GrnModelMessages"],function(GrnModelMsgs){
	    		var MIN_MOVE = 2;
		    	var cnvContainerNode = dom.byId(self._cnvContainerNodeId);
		    	var mouseMoveHandler, lastCheck, currentlyShown;
		    		    	
		    	self.own(on(cnvContainerNode,"mouseover",function(e){
		    		mouseMoveHandler = on(cnvContainerNode,"mousemove",function(e){
		    			
		    			if(!lastCheck) {
		    				lastCheck = {x: e.clientX, y: e.clientY};
		    			}
		    			
		    			var diffs = {
		    				x: Math.abs(lastCheck.x-e.clientX),
		    				y: Math.abs(lastCheck.y-e.clientY)
		    			};
		    					    			
				    	if((diffs.x > MIN_MOVE || diffs.y > MIN_MOVE) 
			    			&& (!self._actionClickPending && self._currentModel && self._currentModel.drawingObject_)
			    			&& self._rendererIsValid && self._canvasIsReady) {
					    	var hits = self.intersectByPoint(self._translateHit({x: e.clientX, y: e.clientY},self.cnvContainerDomNodeId_));
					    	var noteHit = (hits && hits.length > 0) ? HitPriority.getTopNoteHit(hits,null,self._currentModel.get("toggledRegions_")) : null;
					    	var showThis = noteHit ? callback(noteHit) : null;
					    	showThis = (showThis && showThis.msg ? showThis : null);
					    	if(showThis) {
					    		if(!currentlyShown) {
						    		currentlyShown = showThis.id;
							    	GrnModelMsgs.pushMessage(showThis);
					    		} else if(currentlyShown !== showThis.id){
					    			GrnModelMsgs.popMessage();
					    			GrnModelMsgs.pushMessage(showThis);
					    		}
					    	} else if(currentlyShown){
					    		GrnModelMsgs.popMessage();
					    		currentlyShown = null;
					    	}
					    	lastCheck = {x: e.clientX, y: e.clientY};
				    	}
		    		});	
		    		
		    		
		    		var blur,mouseout,mouseleave;
		    		
			    	mouseout = on.once(cnvContainerNode,"mouseout",function(e){
			    		if(currentlyShown){
				    		GrnModelMsgs.popMessage();
				    		currentlyShown = null;
				    	}
			    		mouseMoveHandler && mouseMoveHandler.remove();
			    		blur && blur.remove();
			    		mouseleave && mouseleave.remove();
			    	});

			    	blur = on.once(window,"blur",function(e){
			    		if(currentlyShown){
				    		GrnModelMsgs.popMessage();
				    		currentlyShown = null;
				    	}
			    		mouseMoveHandler && mouseMoveHandler.remove();
			    		mouseout && mouseout.remove();
			    		mouseleave && mouseleave.remove();
			    	});
			    	
			    	// mouseleave is for IE
			    	mouseleave = on.once(cnvContainerNode,"mouseleave",function(e){
			    		if(currentlyShown){
				    		GrnModelMsgs.popMessage();
				    		currentlyShown = null;
				    	}
			    		mouseMoveHandler && mouseMoveHandler.remove();
			    		blur && blur.remove();
			    		mouseout && mouseout.remove();
			    	});
			    	
		    	}));	    		
	    	});	    	
	    },
    
	    ///////////////////////////////////////
	    // attachTooltipEvent
	    ///////////////////////////////////////
	    //
	    // Attach a callback to the 'tooltip' event, defined as a mouse pausing in a location
	    // for more than params.delay milliseconds.
	    // 
	    // The callback should be the function which will return whatever is to be displayed in the tooltip.
	    //
	    attachTooltipEvent: function(callback,params) {
	    	var MIN_MOVE = 3;
	    	var padding = params.padding;
	    	var delay = params.delay;
	    	var cnvContainerNode = dom.byId(this._cnvContainerNodeId);
	    	var self=this;
	    	var mouseMoveHandler, thread, aroundThat, mouseMoved, currentlyShown;
	    		    	
	    	this.own(on(cnvContainerNode,"mouseover",function(e){
	    		
	    		self.own(on(cnvContainerNode,"mousedown",function(e){
	    			aroundThat && Tooltip.hide(aroundThat);
	    		}));
	    		
	    		mouseMoveHandler = on(cnvContainerNode,"mousemove",throttle(function(e){
	    			var diffs = {
	    				x: aroundThat ? Math.abs(aroundThat.x-e.clientX) : (MIN_MOVE+1),
	    				y: aroundThat ? Math.abs(aroundThat.y-e.clientY) : (MIN_MOVE+1)
	    			};

				    var onmousestop = function() {
				    	var aroundThis = {x: e.clientX, y: e.clientY, w: padding.x, h: padding.y};
				    	if(!self._actionClickPending && self._currentModel && self._currentModel.drawingObject_ && self._rendererIsValid && self._canvasIsReady) {
					    	var hits = self.intersectByPoint(self._translateHit({x: e.clientX, y: e.clientY},self.cnvContainerDomNodeId_));
					    	var nonNoteHit = (hits && hits.length > 0) ? HitPriority.getTopPriorityHit(hits,{note: true},self._currentModel.get("toggledRegions_")) : null;
					    	var showThis = nonNoteHit ? callback(nonNoteHit) : null;
					    	if(showThis && !BTContextMenus.contextIsOpen("canvas") && (!currentlyShown || currentlyShown !== showThis)){
					    		currentlyShown = showThis;
						    	Tooltip.show(showThis,aroundThis,["after"]);
						    	// Because the Dijit.Tooltip requires knowing the
						    	// reference which opened it to close it, we
						    	// set it here.
						    	aroundThat = aroundThis;
					    	}
				    	}
				    };
				    
				    // We make a reference to this function so we can access it in
				    // the blur/mouseout/mouseleave events
				    mouseMoved = function() {
				    	if(diffs.x > MIN_MOVE || diffs.y > MIN_MOVE) {
				    		currentlyShown = null;
				    		Tooltip.hide(aroundThat);
				    		clearTimeout(thread);
				    	}
				    };

				    // Clear the previously set timeout
			    	mouseMoved();
			    	
			    	// Set a new one
			        thread = setTimeout(onmousestop, delay);
	    		},TOOLTIP_THROTTLE_RATE));	
	    		
	    		
	    		var blur,mouseout,mouseleave;
	    		
		    	mouseout = on.once(cnvContainerNode,"mouseout",function(e){
		    		mouseMoved && mouseMoved();
		    		mouseMoveHandler && mouseMoveHandler.remove();
		    		blur && blur.remove();
		    		mouseleave && mouseleave.remove();
		    	});

		    	blur = on.once(window,"blur",function(e){
		    		mouseMoved && mouseMoved();
		    		mouseMoveHandler && mouseMoveHandler.remove();
		    		mouseout && mouseout.remove();
		    		mouseleave && mouseleave.remove();
		    	});
		    	
		    	// mouseleave is for IE
		    	mouseleave = on.once(cnvContainerNode,"mouseleave",function(e){
		    		mouseMoved && mouseMoved();
		    		mouseMoveHandler && mouseMoveHandler.remove();
		    		blur && blur.remove();
		    		mouseout && mouseout.remove();
		    	});
	    	}));
	    },	    
	    
	    
	    /////////////////////////
	    // attachDragSelectEvent
		/////////////////////////
	    //
	    // Drag-to-Select implemented via CSS editing of a top-level DIV.
	    // This DIV's basic attributes (border size and color) are defined in main.css#selexBox 
		//
	    attachDragSelectEvent: function(callback,fallbackToClick) {
	    	
	    	domConstruct.create("div",{id: "selexBox"},document.body);
	    		    	
	    	var mouseStatus = {
	    		x: null,
	    		y: null,
	    		endX: null,
	    		endY: null,
	    		isDown: false
	    	};
	    	
	    	var selexStatus = {
	    		built: false	
	    	};
	    	
	    	var cleanUpSelex = function() {
				mouseStatus.endX = null;
				mouseStatus.endY = null;
				selexStatus.built = false;
	    		var selexBox = dom.byId("selexBox");
	    		domStyle.set(selexBox,{
		    		display:"none",
		    		top:"0px",
					left:"0px",
					width:"0px",
					height:"0px"
	    		});				
	    	};
	    	
	    	var handlers = new Array();
	    	
	    	var mouseup = function(e) {
	    		mouseStatus.isDown = false;
	    		mouseStatus.endX = e.clientX;
	    		mouseStatus.endY = e.clientY;
	    		var diffX = Math.abs(mouseStatus.endX-mouseStatus.x);
	    		var diffY = Math.abs(mouseStatus.endY-mouseStatus.y);
	    		DojoArray.forEach(handlers,function(handle) {handle.remove();});
	    		if(callback && diffX > 3 && diffY > 3) {
	    			e.mouseStatus = mouseStatus;
	    			callback(e);
	    		// In case a click was squelched as a move, try to resurrect it here
	    		} else if(mouseStatus.hasMoved && fallbackToClick) {
	    			fallbackToClick(e);
	    		}
	    		cleanUpSelex();
	    		
	    	};
	    	
	    	var mousemove = function(e) {
	    		var selexBox = dom.byId("selexBox");
	    		var diffX = Math.abs(e.clientX-mouseStatus.x);
	    		var diffY = Math.abs(e.clientY-mouseStatus.y);
	    		var newStyle = {
	    			left: (e.clientX < mouseStatus.x ? e.clientX : mouseStatus.x)+"px",
	    			top: (e.clientY < mouseStatus.y ? e.clientY : mouseStatus.y)+"px",
		    		width: diffX+"px",
		    		height: diffY+"px"
	    		};
	    		
	    		domStyle.set(selexBox,newStyle);
	    		e.preventDefault();
	    	};
	    	
	    	var moveFunction = function(e) {
	    		var diffX = Math.abs(e.clientX-mouseStatus.x);
	    		var diffY = Math.abs(e.clientY-mouseStatus.y);    				
	    		if(mouseStatus.isDown === true && (diffX > MIN_MOVEMENT || diffY > MIN_MOVEMENT)) {
	    			mouseStatus.hasMoved = true;
		    		var selexBox = dom.byId("selexBox");
		    		if(!selexStatus.built) {
		    			// This domStyle call will squelch "click" events! We use a diff to determine 
		    			// if the mouse really moved
						domStyle.set(selexBox,{
							top:e.clientY+"px",
							left:e.clientX+"px",
							display:"block"
						});	
	    				selexStatus.built = true;
	    				handlers.push(on(selexBox,"mouseup",mouseup));
	    				handlers.push(on(selexBox,"mousemove",throttle(mousemove,DRAGSEL_MOVE_THROTTLE_RATE)));
	    				handlers.push(on(selexBox,"mousemove",debounce(mousemove,DEBOUNCE_DELAY)));	
		    		}
		    		mousemove(e);
	    		}
	    	};
	    	
	    	this.own(on(window,"mousemove",throttle(moveFunction,DRAGSEL_MOVE_THROTTLE_RATE)));
	    	this.own(on(window,"mousemove",debounce(moveFunction,DEBOUNCE_DELAY)));
			
	    	this.own(
    			on(dom.byId(this._cnvContainerNodeId),"mousedown",function(e){
    				cleanUpSelex();
    				mouseStatus.x = e.clientX;
    				mouseStatus.y = e.clientY;
    				if(mouse.isLeft(e) && !e.ctrlKey && !e.altKey) {
    					handlers.push(on(window,"mouseup",mouseup));
    					mouseStatus.isDown = true;
        				mouseStatus.hasMoved = false;
        				e.preventDefault();
            		}
    			})
			);
	    },
	
	    
	    // pass through method to the Renderer point selection method
	    intersectByPoint: function(thisHit) {
	    	return this._canvasRenderer._doPointSelection(thisHit,this._currentModel.get("modelId_"));
	    },

	    // pass through method to the Renderer rectangular selection method
	    intersectByBoundingBox: function(thisBox) {
	    	return this._canvasRenderer._doRectangleSelection(thisBox,this._currentModel.get("modelId_"));
	    },	    
	    
	    
	    ////////////////////////////
	    // selectNodes
	    ///////////////////////////
	    //
	    // Method which selects nodes on the renderer and invokes a redraw of the model to
	    // reflect this selection.
	    //
	    selectNodes: function(nodes) {
	    	var self=this;
	    	var asyncSelector = new Deferred();
	    	this._canvasReady.promise.then(function(){
	    		self._updateOverlay();
	    		self._updateRegionToggles();
	    		self._selectNodes(nodes).then(function(){
	    			self._drawCanvas();
		    		asyncSelector.resolve();
	    		},function(err){
	    			console.warn("Canvas did not select.");
	    			asyncSelector.resolve();
	    		});
	    	});
	    	return asyncSelector.promise;
	    },
	    
	    ////////////////////////////////////////
	    // getAllNodes
	    ////////////////////////////////////////
	    //
	    // Only the renderer has a list of all nodes currently in the model, which sometimes must be
	    // queried for membership. Because the models are loaded into the renderer asynchronously,
	    // we register fetching this set as a callback against both _canvasReady and _asyncModelLoader,
	    // to be sure the canvas and its model are both in a ready state, which will mean the renderer
	    // is as well.
	    //
	    getAllNodes: function() {
	    	var self=this;
	    	var asyncSelector = new Deferred();
	    	this._canvasReady.promise.then(function(){
	    		self._asyncModelLoader.promise.then(function(){
	    			asyncSelector.resolve(self._canvasRenderer.getAllSelectedMap(self._currentModel.get("modelId_")));
	    		});
	    	});
	    	return asyncSelector.promise;
	    },
	    
	    ////////////////////////////////////
	    // getSharedIds
	    ///////////////////////////////////
	    //
	    // Some links can exist under more than one ID; a complete set of IDs a link may
	    // belong to is kept in the renderer.
	    //
	    getSharedIds: function(linkId) {
	    	return this._canvasRenderer.getLinkageBySharedID(this._currentModel.get("modelId_"),linkId);
	    },
	    
	    //////////////////////////////////
	    // getSelectedNodes
	    //////////////////////////////////
	    //
	    // Return the list of nodes the renderer has marked as selected
	    //
		getSelectedNodes: function() {
			return this._canvasRenderer.getSelectedNodeIDMap(this._currentModel.get("modelId_"));
		},
		
	///////////////////////////////////////////////////////
	// Zoom Drawing Actions
	///////////////////////////////////////////////////////
		
		// overall zoom method; everything uses this method to actually perform its zoom
		_zoomTo: function(zoomVal) {
			this._drawCanvas(zoomVal);
		},
		
		// basic zooming
		zoomIn: function() {
			this._zoomTo(ZoomController.zoomIn(this._currentZoomLevel,this._zoomStates));
		},
		zoomOut: function() {
			this._zoomTo(ZoomController.zoomOut(this._currentZoomLevel,this._zoomStates));
		},
		
		// module-based zooming
		zoomToModules: function(modules) {
			var modBounds = canvasRenderer.getOverlay(this._currentModel.get("modelId_"),this._currentModel.get("overlay_").id).getOuterBoundsForModules(modules);
			this._zoomTo(ZoomController.getOptimalZoom(
    			{w: (Math.abs(modBounds.max_x - modBounds.min_x)), h: (Math.abs(modBounds.max_y - modBounds.min_y))},
    			{w: dom.byId(this._cnvWrapperNodeId).clientWidth-SCROLL_BAR_SIZE,h: dom.byId(this._cnvWrapperNodeId).clientHeight-SCROLL_BAR_SIZE},
    			"OPTIMAL_SELECTED",
    			this._zoomStates
			));
			
			this._scrollToWorldPoint({
				x: modBounds.min_x + (Math.abs(modBounds.max_x - modBounds.min_x))/2, 
				y: modBounds.min_y + (Math.abs(modBounds.max_y - modBounds.min_y))/2
			});				
		},
		zoomToActiveModules: function() {
			var self=this;
			this._asyncModelLoader.promise.then(function(){
				var enabledMods = [];
				DojoArray.forEach(self._currentModel.get("overlay_").enabled_modules,function(mod){
					enabledMods.push(mod.id);
				});
				self._updateOverlay();
				self._updateRegionToggles();
				self.zoomToModules(enabledMods);
			});			
		},
		
		// node- and selection-specific zooming
		zoomToNode: function(nodeId) {
			var self=this;
			this._asyncModelLoader.promise.then(function(){
				var nodeBounds = canvasRenderer.getBoundsForIntersection(
					self._currentModel.get("modelId_"),
					canvasRenderer.getIntersectionsByIDs(self._currentModel.get("modelId_"),[nodeId])[nodeId]
				);
				self._zoomTo(ZoomController.getOptimalZoom(
	    			{w: (Math.abs(nodeBounds.max_x - nodeBounds.min_x)), h: (Math.abs(nodeBounds.max_y - nodeBounds.min_y))},
	    			{w: dom.byId(self._cnvWrapperNodeId).clientWidth-SCROLL_BAR_SIZE,h: dom.byId(self._cnvWrapperNodeId).clientHeight-SCROLL_BAR_SIZE},
	    			"OPTIMAL_SELECTED",
	    			self._zoomStates
				));
				
				self._scrollToWorldPoint({
					x: nodeBounds.min_x + (Math.abs(nodeBounds.max_x - nodeBounds.min_x))/2, 
					y: nodeBounds.min_y + (Math.abs(nodeBounds.max_y - nodeBounds.min_y))/2
				});	
			});
		},
		zoomToSelNode: function(nodeId) {
			var self=this;
			this._asyncModelLoader.promise.then(function(){
				var nodeBounds = canvasRenderer.getBoundsForIntersection(self._currentModel.get("modelId_"),self.getSelectedNodes()[nodeId]);
				self._zoomTo(ZoomController.getOptimalZoom(
	    			{w: (Math.abs(nodeBounds.max_x - nodeBounds.min_x)), h: (Math.abs(nodeBounds.max_y - nodeBounds.min_y))},
	    			{w: dom.byId(self._cnvWrapperNodeId).clientWidth-SCROLL_BAR_SIZE,h: dom.byId(self._cnvWrapperNodeId).clientHeight-SCROLL_BAR_SIZE},
	    			"OPTIMAL_SELECTED",
	    			self._zoomStates
				));
				
				self._scrollToWorldPoint({
					x: nodeBounds.min_x + (Math.abs(nodeBounds.max_x - nodeBounds.min_x))/2, 
					y: nodeBounds.min_y + (Math.abs(nodeBounds.max_y - nodeBounds.min_y))/2
				});	
			});
		},		
		zoomToSelected: function(focusCanvas) {
			var self=this;
			var grnWrapper = dom.byId(self._cnvWrapperNodeId);
			this._asyncModelLoader.promise.then(function(){
				var selectedBoundingBox = canvasRenderer.getBoundsForSelectedNodes(self._currentModel.get("modelId_"));
				self._zoomTo(ZoomController.getOptimalZoom(
	    			{w: (Math.abs(selectedBoundingBox.max_x - selectedBoundingBox.min_x)), h: (Math.abs(selectedBoundingBox.max_y - selectedBoundingBox.min_y))},
	    			{w: grnWrapper.clientWidth-SCROLL_BAR_SIZE,h: grnWrapper.clientHeight-SCROLL_BAR_SIZE},
	    			"OPTIMAL_SELECTED",
	    			self._zoomStates
				));
				
				self._scrollToWorldPoint({
					x: selectedBoundingBox.min_x + (Math.abs(selectedBoundingBox.max_x - selectedBoundingBox.min_x))/2, 
					y: selectedBoundingBox.min_y + (Math.abs(selectedBoundingBox.max_y - selectedBoundingBox.min_y))/2
				});	
				
				if(focusCanvas) {
					require(["dijit/focus"],function(focus){
						focus.focus(grnWrapper);
					});
				}
			});
		},
		
		// model zooming
		zoomToWholeModel: function() {
			var self=this;
			this._canvasReady.promise.then(function(){
				self._zoomTo(ZoomController.getOptimalZoom(
	    			{w: self._currentModel.drawingObject_.model_w, h: self._currentModel.drawingObject_.model_h},
	    			{w: dom.byId(self._cnvWrapperNodeId).clientWidth-SCROLL_BAR_SIZE,h: dom.byId(self._cnvWrapperNodeId).clientHeight-SCROLL_BAR_SIZE},
	    			"OPTIMAL_WHOLE_MODEL",
	    			self._zoomStates
				));
				
				self._scrollToWorldPoint({
					x: self._currentModel.drawingObject_.model_x+(self._currentModel.drawingObject_.model_w/2), 
					y: self._currentModel.drawingObject_.model_y+(self._currentModel.drawingObject_.model_h/2)
				});
			});
		},
		zoomToAllModels: function(bounds) {
			var self=this;
			this._canvasReady.promise.then(function(){
				self._zoomTo(ZoomController.getOptimalZoom(
	    			{w: Math.abs(bounds.max_x-bounds.min_x), h: Math.abs(bounds.max_y-bounds.min_y)},
	    			{w: dom.byId(self._cnvWrapperNodeId).clientWidth-SCROLL_BAR_SIZE,h: dom.byId(self._cnvWrapperNodeId).clientHeight-SCROLL_BAR_SIZE},
	    			"OPTIMAL_WHOLE_MODEL",
	    			self._zoomStates
				));
				
				self._scrollToWorldPoint({
					x: bounds.center_x, 
					y: bounds.center_y
				});			
			});
		},
		
		zoomToWholeWorkspace: function() {
			var self=this;
			this._canvasReady.promise.then(function(){
				self._zoomTo(ZoomController.getOptimalZoom(
	    			{w: self._workspaceDimensions.width, h: self._workspaceDimensions.height},
	    			{w: dom.byId(self._cnvWrapperNodeId).clientWidth-SCROLL_BAR_SIZE,h: dom.byId(self._cnvWrapperNodeId).clientHeight-SCROLL_BAR_SIZE},
	    			"WORKSPACE",
	    			self._zoomStates
				));
			});
		},
				
		/////////////////////////////////
		// scrollToSelNode
		////////////////////////////////
		//
		// Given the node ID of a currently selected node, fetch its bounds from the renderer and scroll to the center
		// of that rectangle. This does *not* zoom in on that point, it only scrolls the drawing view.
		//
		scrollToSelNode: function(nodeId) {
			var self=this;
			this._asyncModelLoader.promise.then(function(){
				var thisNode = self.getSelectedNodes()[nodeId];
				if(!thisNode) { return; };
				var nodeBounds = canvasRenderer.getBoundsForIntersection(self._currentModel.get("modelId_"),thisNode);
				self._scrollToWorldPoint({
					x: nodeBounds.min_x + (Math.abs(nodeBounds.max_x - nodeBounds.min_x))/2, 
					y: nodeBounds.min_y + (Math.abs(nodeBounds.max_y - nodeBounds.min_y))/2
				});	
			});			
		},

		///////////////////////////////
		// getContainerDomNodeId
		/////////////////////////////
		//
		// Retrn the ID of the canvas-container node for this BTCanvas
	    getContainerDomNodeId: function() {
	    	return this._cnvContainerNodeId;
	    },
	    
	    ////////////////////////////////
	    // destroyRecursive
	    ///////////////////////////////
	    //
	    // Implementation of dojo/Destroyable
	    //
	    destroyRecursive: function() {
	    	this.destroy();
	    },
		
	    //////////////////////////////////////////
	    // attachArtboard
	    //////////////////////////////////////////
	    //
		// Bootstrapping method for the BTCanvas; unlike the constructor, this method requires
	    // that the containing domNode now be in existence so that the canvas element and its
	    // virtual scrolling system can be instantiated and all relevant event listeners put
	    // into place
	    //
		attachArtboard: function() {
			var self = this;
            
            // Whenever the window or the containing widget are resized, we need to 
            // resize our canvas, adjust the scrolling system, and redraw based on
            // that		
            this.own(
        		on(window,"resize",function(){
        			if(self._currentModel) {
        				self._drawCanvas();
    				} else {
    					self._toggleCanvas();
    					self._zoom(self._currentZoomLevel);
    					self._swapCanvas();
					}
    			})
			);
            								
			// Create the canvas and its virtual scrolling system and place them
			this._buildCanvas();
			
			var grn = dom.byId(this._cnvContainerNodeId);
			
            // Squelch all default context menuing on the DIV container for the 
            // canvas and on the scrolling system containers
            this.own(on(grn,"contextmenu",function(e){e.preventDefault();}));			
						
			// The canvas renderer is static, but we may need to initialize it if we are the
			// first instantiated canvas
			if(!canvasRenderer) {
                canvasRenderer = CanvasRendererFactory.create({
                	primary_canvas: {type: 'external', element: this._canvas},
                	overlay_canvas: {type: 'internal'},
                	temp_canvas: {type: 'internal'},                	
                	// These settings are for renderer logic that uses the overlay_canvas and temp_canvas above.
                	// This shouldn't break anything, as the overlay rendering is currently disabled.
                	viewport: {
                		width: 1920,
                		height: 1200
                	}
				});
			}
			this._canvasRenderer = canvasRenderer;

			// Bootstrap the first display of a model
			this._canvasReady = new Deferred();
            this._loadModel().then(function(){
	    		require([self._networkModelController,"views"],function(networkModelController,BTViews){
	    			// Set the optimal zoom as the beginning zoom level, then, check for an initial mode, and if it's provided use it
	    			// (otherwise we'll ignore it).
	            	self._currentZoomLevel = ZoomController.getOptimalZoom(
            			{w: self._currentModel.drawingObject_.model_w, h: self._currentModel.drawingObject_.model_h},
            			{w: dom.byId(self._cnvContainerNodeId).clientWidth-SCROLL_BAR_SIZE,h: dom.byId(self._cnvContainerNodeId).clientHeight-SCROLL_BAR_SIZE},
            			"OPTIMAL_WHOLE_MODEL",
            			self._zoomStates
        			);
            		self._disableScrolling();
            		var firstDraw = function(){
        				// Because there might have been a resizing of the container which holds the canvas, make the offCanvas now,
        				// and force a toggle and swap to ensure they're both the same size to start with. This way, any draws will
        				// be done with the canvases synced up.
        				if(!self._offCanvas) {
        					self._makeOffCanvas();	
        					self._toggleCanvas();
        					self._swapCanvas();
        	    		}
                		self._redraw(null,false,null,networkModelController.get("initialZoomMode_"),networkModelController.get("completeModelBounds_")).then(function(){
            				self._canvasReady.resolve();
            				self._canvasIsReady = true;
            	            self._makeResizingAspect();
                		});	
        			};
        			if(self._isPrimaryCanvas) {
                		BTViews.getTreeResize().then(firstDraw);
        			} else {
        				firstDraw();
        			}
	    		});
			},function(err){
				self._disableScrolling();
				// We may not have actually finished our build of the offCanvas if the load failed, 
				// so we should make sure that gets done before doing any clearing, otherwise we
				// could--in the case of floating artboards--wind up sending commands to the renderer
				// (which is a singleton) for the wrong canvas
				self._toggleCanvas();
				self._swapCanvas();
				self._clearCanvas();
				self._canvasReady.resolve();
			});
            
            // Once the first load is complete, place watch callbacks for changes in the ArtboardModel
            this._canvasReady.promise.then(function(){
		    	self._watchers["model"] = ArtboardController.getArtboardController(self._cnvContainerNodeId).setWatch("currentModel_",function(name,oldVal,newVal){
		    		if(self._drawEventsGo) {
			    		require([self._networkModelController,"views"],function(networkModelController,BTViews){
			    			var redrawAndReady = function() {
	            				self._redraw(newVal,true,null,networkModelController.get("navZoomMode_")).then(function(){
	            					// If this is a redraw in response to a reload (from a session expiring or a new model), then
	            					// the Canvas will have been flagged unready and should be re-readied.
	            					if(!self._canvasIsReady) {
	            						self._canvasIsReady = true;
	                    				self._canvasReady.resolve();
	            					}
	            				});
			    			};
			    			if(self._isPrimaryCanvas) {
			    				BTViews.getTreeResize().then(redrawAndReady);
			    			} else {
	            				redrawAndReady();
			    			}
			    		});
		    		}
				});
		    	self.own(self._watchers["model"]);
		    	self._watchers["overlay"] = ArtboardController.getArtboardController(self._cnvContainerNodeId).setWatch("overlay_",function(name,oldVal,newVal){
		    		if(self._drawEventsGo) {
		    			self._currentModel && self._redraw(self._currentModel.get("modelId_"));
		    		}
				});
		    	self.own(self._watchers["overlay"]);
		    	self._watchers["toggledRegions"] = ArtboardController.getArtboardController(self._cnvContainerNodeId).setWatch("toggledRegions_",function(name,oldVal,newVal){
		    		if(self._drawEventsGo) {
		    			self._currentModel && self._redraw(self._currentModel.get("modelId_"));
		    		}
				});
		    	self.own(self._watchers["toggledRegions"]);			    	
		    	
			});
	    },
	    
	    ////////////////////////////////
	    // canvasReady
	    ///////////////////////////////
	    //
	    // Method to get the promose of the _canvasReady Deferred
	    // 
	    canvasReady: function() {
	    	return this._canvasReady.promise;
	    },
	    		
	    
	    /////////////////////////////////////////
	    // Constructor
	    /////////////////////////////////////////
	    //
	    // The constructor sets down various parameters but it DOES NOT construct
	    // the canvas element, instantiate the renderer, or set up canvas-specific
	    // event listeners. this.attachArtboard(), which can be run once there is a DOM element
	    // to attach the canvas element to (specified by _cnvWrapperNodeId), will complete the BTCanvas setup.
	    // 
		constructor: function(params) {
			
			var self=this;
			this._workspaceDimensions = {width: params.wsWidth, height: params.wsHeight};
			this._drawEventsGo = true;
			this._cnvContainerNodeId = params.cnvContainerDomNodeId;
			this._cnvWrapperNodeId = params.cnvWrapperDomNodeId;
			this._networkModelController = params.networkModelController;
			this._willDrawWorkspace = params.drawWorkspace;
			this.id_ = params.id;
			this._watchers = {};
			this._scrollHandlers = {
				scrollv: null,
				scrollh: null
			};
			this._zoomStates = params.zoomStates;
			this._currentZoomLevel = ZoomController.getDefaultZoom(); 
			this._actionClickPending = false;
			this._isPrimaryCanvas = !!params.primaryCanvas;
		}
	});
	
	// Our map of BioTapestryCanvases, keyed on their container DOM Node ID
	var _btCanvases = {};
	

///////////////////////////////////////
// Module Interface
///////////////////////////////////////
	
	return  {
		buildBtCanvas: function(params) {
			if(_btCanvases[params.cnvContainerDomNodeId]) {
				this.removeBtCanvas(params.cnvContainerDomNodeId);
			}	
			_btCanvases[params.cnvContainerDomNodeId] = new BioTapestryCanvas(params);
			return _btCanvases[params.cnvContainerDomNodeId];
		},
		
		getBtCanvas: function (containerDomNodeId) {
			return _btCanvases[containerDomNodeId];
		},
		
		canvasReady: function (containerDomNodeId) {
			return _btCanvases[containerDomNodeId].canvasReady();
		},
			
		removeBtCanvas: function(containerDomNodeId) {
			_btCanvases[containerDomNodeId] && _btCanvases[containerDomNodeId].destroyRecursive();
			delete _btCanvases[containerDomNodeId];
		},
		
		attachArtboard: function(containerDomNodeId) {
			_btCanvases[containerDomNodeId].attachArtboard();
		},
		
		translateHit: function(hit,containerDomNodeId) {
			return _btCanvases[containerDomNodeId]._translateHit(hit);
		},
		
		getEntityNames: function(containerDomNodeId,ids) {
			return _btCanvases[containerDomNodeId]._getEntityNames(ids);
		},
		
		drawClickPending: function(containerDomNodeId,clickEvent) {
			_btCanvases[containerDomNodeId]._drawClickPending(true,clickEvent);
		},
		
		actionClickPending: function(containerDomNodeId,isPending) {
			_btCanvases[containerDomNodeId]._setActionClickPending(isPending);
		},

		drawClickError: function(containerDomNodeId) {
			_btCanvases[containerDomNodeId]._drawClickError();
		},		
		
		drawClickEnd: function(containerDomNodeId) {
			_btCanvases[containerDomNodeId]._drawClickPending(false);
		},
		
		zoomToShowModel: function(containerDomNodeId) {
			_btCanvases[containerDomNodeId].zoomToWholeModel();
		},

		zoomToShowWorkspace: function(containerDomNodeId) {
			_btCanvases[containerDomNodeId].zoomToWholeWorkspace();
		},
				
		zoomToSelected: function(containerDomNodeId,focusCanvas) {
			_btCanvases[containerDomNodeId].zoomToSelected(focusCanvas);
		},
		
		removeResizingAspect: function(containerDomNodeId) {
			_btCanvases[containerDomNodeId]._removeResizingAspect();
		},
		makeResizingAspect: function(containerDomNodeId) {
			_btCanvases[containerDomNodeId]._makeResizingAspect();
		},
		toggleWatchEvents: function(containerDomNodeId) {
			_btCanvases[containerDomNodeId]._toggleWatchEvents();
		}
	};

}); // define 
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
    // Dojo dependencies
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
    // BT dependencies
    "widgets/BTContextMenus",
    "controllers/ArtboardController",
    "controllers/ZoomController",
    "./renderer/CanvasRenderer",
    "controllers/HitPriority",
    "app/utils",
    "static/ErrorMessages",
    "views/GrnModelMessages"
],function(
    // Dojo dependencies
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
    // BT dependencies
	BTContextMenus,
	ArtboardController,
	ZoomController,
    CanvasRendererFactory,
    HitPriority,
    utils,
    ErrMsgs,
    GrnModelMsgs
) {
		
	// The default zoom 'level' (array index)
	var DEFAULT_ZOOM_LEVEL = 5;
					
	// A CanvasRenderer object, which will parse a JSON model and render it to a supplied
	// canvas instance. The renderer is currently used as a single instance
	var canvasRenderer = null;
	
	// Amount to scroll by with the mousewheel
	var WHEEL_SCROLL_VALUE = 25;

	// Amount to scroll by with the keyboard up/down and left/right keys
	var KB_SCROLL_VALUE = 25;
	
	// Throttle rate of redrawing
	var REDRAW_THROTTLE_RATE = 25;
	// Debounce delay of redrawing
	var REDRAW_DEBOUNCE_DELAY = 55;
	
	// Some versions of IE require a scrollbar to be a minimum of 18px in size, so this is our minimum size in that case;
	// otherwise, calculate them specifically
	// *** If there are scrollbar functionality problems in IE, try adjusting this size first ***
	var SCROLL_BAR_SIZE = (has("ie") || has("trident")) ? 18 : utils.calcScrollbarSize();
	
	var SCROLL_BAR_SPACE = SCROLL_BAR_SIZE+1;
	
	// GroupNodes are not zoomed
	var GROUP_NODE_ZOOM = 1.0;
	
	// Minimum mouse delta required to qualify as a 'move'
	var MIN_MOUSE_MOVE = 3;
	
	// Helper values for managing mouse clicks
	var LEFT_MOUSE = "LEFT";
	var RIGHT_MOUSE = "RIGHT";
	
	var KEYPRESS_SET = ["NONE","SHIFT","ALT","SHIFT_ALT","CTRL","SHIFT_CTRL","CTLR_ALT","SHIFT_CTRL_ALT"];
	
	/////////////// HELPER CLASSES /////////////// 
	
	////////////////////
	// MouseHandlers
	///////////////////
	//
	// Object for managing our various mouse handlers
	// Stores the functions called by event handlers, and provides convenience
	// methods for pausing and resuming groups of related handles
	//
	var MouseHandlers = declare(null,{
		RIGHT: null,
		LEFT: null,
		HOVER: null,
		constructor: function(params) {
			this.LEFT = {
				UP: {
					NONE: null,
					ALT: null,
					SHIFT: null,
					CTRL: null					
				},
				DRAG: {
					CTRL: null,
					NONE: {
						windowMouseMove: null,
						selBox: {
							mouseUp: null,
							mouseMove: null,
							mouseUpCallback: null
						},
						callback: null,
						pauseAll: function() {
							this.windowMouseMove && this.windowMouseMove.pause();
							this.selBox.mouseMove && this.selBox.mouseMove.pause();
							this.selBox.mouseUp && this.selBox.mouseUp.pause();
						},
						resumeAll: function() {
							this.windowMouseMove && this.windowMouseMove.resume();
							this.selBox.mouseMove && this.selBox.mouseMove.resume();
							this.selBox.mouseUp && this.selBox.mouseUp.resume();						
						}
					}
				},
				DOWN: {
					NONE: null,
					ALT: null,
					SHIFT: null,
					CTRL: null
				}
			};
			
			this.RIGHT = {
				UP: {
					NONE: null,
					ALT: null,
					SHIFT: null,
					CTRL: null
				}
			};
			
			this.HOVER = {
				note: null,
				groupnode: null
			};
		}
	});
	
	//////////////
	// BTTooltip
	/////////////
	//
	// Object which manages tooltip and their display
	// 
	var BTTooltip = declare(null,{
		delay: null,
		showAt: null,
		showThis: null,
		showAround: null,
		padding: null,
		fetch: null,
		show: function(toShow,here) {
			if(!toShow) {
				console.warn("[WARNING] No tooltip to show, but called BTTooltip.show anyways.");
				return;
			}
			this.showThis = toShow;
			this.showAt = here;
			this.showAround = {x: this.showAt.x, y: this.showAt.y, w: this.padding.x, h: this.padding.y};
			Tooltip.show(this.showThis,this.showAround,["after"]);
		},
		hide: function() {
			this.showThis && Tooltip.hide(this.showAround);
			this.showThis = null;
			this.showAround = null;
			this.showAt = null;
		},
		isCurrentlyShown: function(toShow) {
			if(this.showThis) {
				return (JSON.stringify(toShow) === JSON.stringify(this.showThis));
			}
			return false;
		},
		constructor: function(params) {
			
		}
	});
	
	/////////////////
	// MouseStatus
	////////////////
	//
	// Object which can be used by event handlers to track the status of the mouse, and note
	// its coordinates when down and up events fire, which mouse was pressed down, define if the
	// mouse has moved a minimum amount, etc.
	//
	var MouseStatus = declare(null,{
		downX: null,
		downY: null,
		upX: null,
		upY: null,
		currX: null,
		currY: null,
		lastCheckedX: null,
		lastCheckedY: null,
		isDown: false,
		which: null,
		mouseDown: function(e) {
			this.currX = this.downX = e.clientX;
			this.currY = this.downY = e.clientY;
    		this.upX = null;
    		this.upY = null;
    		this.which = mouse.isRight(e) ? RIGHT_MOUSE : LEFT_MOUSE;
    		this.isDown = true;
		},
		mouseUp: function(e) {
			this.upX = this.currX = e.clientX;
			this.upY = this.currY = e.clientY;
    		this.which = mouse.isRight(e) ? RIGHT_MOUSE : LEFT_MOUSE;
    		this.isDown = false;
		},
		clear: function() {
			this.currX = this.downX = this.upX = null;
			this.currY = this.downY = this.upY = null;
			this.isDown = false;
			this.which = null;
		},
		// Method which tells you if the supplied event has moved more than MIN_MOUSE_MOVE
		// from currX and/or currY.
		//
		// SPECIAL NOTE ABOUT REQUIRING MINIMUM MOVEMENT
		// If you want to require a minimum movement under mousemove, as opposed to just making
		// sure the mouse *didn't* move, you should consider one of the following:
		// 	* Throttling mousemove itself (via on/throttle)
		// 	* Throttling the rate the function itself is called, eg. on(node,"mousemove",throttle(callback,rate))
		// 	* Storing a separate coordiante pair outside of the "mousemove" and using that to track qualifiying movements
		// 
		// These are necessary because during periods of slow mouse movement the difference from one move event to the 
		// next can be as low as one pixel, making this method unhelpful
		//
		isMinMove: function(e) {
			this.currX = (this.currX === null ? e.clientX : this.currX);
			this.currY = (this.currY === null ? e.clientY : this.currY);
			
			return ((Math.abs(this.currX-e.clientX) > MIN_MOUSE_MOVE) || (Math.abs(this.currY-e.clientY) > MIN_MOUSE_MOVE));
		},
		constructor: function(params) {
			
		}
	});
	
	// A drag-selection box class for drawing a box which can store its coordinates to be used
	// in calculating its contents
	var SelexBox = declare([],{
		_domNode: null,
		isShown: false,
		show: function(where) {
    		domStyle.set(this._domNode,{
	    		display:"block",
	    		top: where.y+"px",
				left: where.x+"px",
				width: where.w+"px",
				height: where.h+"px"
    		});	
    		this.isShown = true;
		},
		cleanUp: function() {
			this.isShown = false;
    		domStyle.set(this._domNode,{
	    		display:"none",
	    		top:"0px",
				left:"0px",
				width:"0px",
				height:"0px"
    		});						
		},
		constructor: function(params) {
			// We only ever need to have one selection box on the DOM
			this._domNode = params.domNode || dom.byId("selexBox") || domConstruct.create("div",{id: "selexBox"},document.body); 
		}
	});
	
	///////////////////////
	// BioTapestryCanvas
	///////////////////////
	//
	// An interface class which uses a Renderer to display an ArtboardModel on an HTML5 canvas element
	//
	var BioTapestryCanvas = declare([Destroyable],{
		
		// The ZoomController instance for this BTCanvas
		_zoomController: null,
		
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
							
		// The true (unscaled) dimensions of the workspace. They do not change unless someone 
		// sets them to new values (Editor-only function).
		_workspaceDimensions: null,
		
		// In some cases, rendering to an off-DOM canvas and then swapping it into position can
		// prevent screen-tearing and other undesirable results. Setting this to true
		// will enable use of the _offCanvas and the relevant methods.
		_bufferedCanvases: null,
		
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
		currentModel_: null,
		
		// Our list of event listener handles that watch for changes in the ArtboardController
		// model state, such as overlay changes, region toggles, etc.
		watchers_: null,
		
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
		actionClickPending_: null,
		
		// The node to be drawn in the case of a pending draw event
		placeHolder_: null,
		
		// If a draw click is pending, it's movement handlers are stored here
		drawClickMoveHandlers_: null,
		
		// If this Canvas is not currently enabled (scroll bars should be shut off and clicks should not respond)
		// we set disabled_ to false. 
		disabled_: false,
		
		// The property names of the zoom states this canvas' zoom controller is associated with
		zoomStates_: null,
		
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
		
		_mouseHandlers: null,
		
    	_mouseStatus: null,
		
		_tooltip: null,
		
		_currentNote: null,
		
		_selexBox: null,
		
		_keysPressed: function(e) {
			return KEYPRESS_SET[parseInt((e.ctrlKey ? "1" : "0") + (e.altKey ? "1" : "0") + (e.shiftKey ? "1" : "0"),2)];
		},
		
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
            		
            		var cnvWrapper = dom.byId(self._cnvWrapperNodeId);
            		// Never pick up sizing <= 0 because it means we are no longer being rendered
            		// and it's not accurate
            		self._lastWrapperSize.w = cnvWrapper.clientWidth || self._lastWrapperSize.w;
            		self._lastWrapperSize.h = cnvWrapper.clientHeight || self._lastWrapperSize.h;
            		if(self.currentModel_ && self._rendererIsValid) {
            			self._drawCanvas();
        			} else {
        				self._toggleCanvas(); 
        				self._zoom(self._currentZoomLevel);
        				self._swapCanvas();
    				}
            	}
            });
		},
		
		_currentModelId: function() {
			return this.currentModel_.get("modelId_")+"_"+this._cnvContainerNodeId;
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
				newZoomScale: this._zoomController.getZoomValue(newZoomLevel),
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
			
			var wrapperSize = {
				w: (grnWrapper.clientWidth || this._lastWrapperSize.w),
				h: (grnWrapper.clientHeight || this._lastWrapperSize.h)
			};
			
			// if this zoom call is the result of the canvas DOM node being resized, 
			// that will factor into our translation and scrolling; if not, this
			// value will be 0
			var grnResize = {
				w: ((wrapperSize.w-SCROLL_BAR_SPACE)-this._canvas.width),
				h: ((wrapperSize.h-SCROLL_BAR_SPACE)-this._canvas.height)
			};
			
			this._clearCanvas();
			this._canvasRenderer.context_setTransform(1, 0, 0, 1, 0, 0);
						
			// Adjust the sizes of our virtual scrollbars
			this._adjustScrolling(zoomLevels.newZoomScale);
						
			var grnStyleChange = null;
			
			// Always assume we need to size the canvas to the image; wrapper resize
			// events will override this if needed.
			if(this.currentModel_.isGroupNode()) {
				if(this.currentModel_.drawingObject_.workspace.w < wrapperSize.w-SCROLL_BAR_SPACE) {
					this._canvas.width = wrapperSize.w-SCROLL_BAR_SPACE;
				} else {
					this._canvas.width = this.currentModel_.drawingObject_.workspace.w;
				}
				if(this.currentModel_.drawingObject_.workspace.h < wrapperSize.h-SCROLL_BAR_SPACE) {
					this._canvas.height = wrapperSize.h-SCROLL_BAR_SPACE;
				} else {
					this._canvas.height = this.currentModel_.drawingObject_.workspace.h;
				}
			}
			
			// Don't set a new container style unless it's truly needed
			if(grnResize.w !== 0) {
				if(!this.currentModel_.isGroupNode() || this.currentModel_.drawingObject_.workspace.w < wrapperSize.w-SCROLL_BAR_SPACE) {
					this._canvas.width = wrapperSize.w-(SCROLL_BAR_SPACE);
				} else {
					this._canvas.width = this.currentModel_.drawingObject_.workspace.w;
				}
				if(grnStyleChange === null) {
					grnStyleChange = {};
				}
				grnStyleChange.width = (wrapperSize.w-(SCROLL_BAR_SPACE))+"px";
			}
			if(grnResize.h !== 0) {
				if(!this.currentModel_.isGroupNode() || this.currentModel_.drawingObject_.workspace.h < wrapperSize.h-SCROLL_BAR_SPACE) {
					this._canvas.height = wrapperSize.h-(SCROLL_BAR_SPACE);
				} else {
					this._canvas.height = this.currentModel_.drawingObject_.workspace.h;
				}
				if(grnStyleChange === null) {
					grnStyleChange = {};
				}
				grnStyleChange.height = (wrapperSize.h-(SCROLL_BAR_SPACE))+"px";
			}
			
			grnStyleChange && domStyle.set(grn,grnStyleChange);
			
			// If there's no current model, we're done
			if(!this.currentModel_) { return; }

			// Initial translation of the canvas based on the new zoom setting
			this._canvasTranslation = {
				x: -(this.currentModel_.drawingObject_.workspace.x*zoomLevels.newZoomScale),
				y: -(this.currentModel_.drawingObject_.workspace.y*zoomLevels.newZoomScale)
			};			
			
			// Adjust the translation based on our workspace size relative to the viewport size 
			//
			// If our proposed drawing area (worksapceDimensions times the scaling) is bigger
			// than our actual canvas, we will be translating to that center
			if(this._workspaceDimensions.width*zoomLevels.newZoomScale > this._canvas.width) {
				if(!this._scrollHandlers.scrollh.enabled) {
					this._initScrollH(zoomLevels.newZoomScale);
					currScroll.left=scrollh.scrollLeft;
				} else {
					// Adjust the scrollbars so that whatever was on the canvas center before this event is still
					// under it after
					scrollh.scrollLeft=Math.round(wsOnCnvCtr.x*((zoomLevels.newZoomScale/zoomLevels.oldZoomScale)-1))+currScroll.left-(Math.round(grnResize.w/(2*(this._bufferedCanvases ? 2 : 1))));
				}
			} else {
				// disable scrolling and translate to the center of the canvas
				this._disableScrollH();
				this._canvasTranslation.x = Math.round(this._canvas.width/2)
					-((this.currentModel_.drawingObject_.workspace.x+((this.currentModel_.drawingObject_.workspace.w)/2))*zoomLevels.newZoomScale);
			}

			if(this._workspaceDimensions.height*zoomLevels.newZoomScale > this._canvas.height) {
				if(!this._scrollHandlers.scrollv.enabled){
					this._initScrollV(zoomLevels.newZoomScale);
					currScroll.top = scrollv.scrollTop;
				} else {
					// Adjust the scrollbars so that whatever was on the canvas center before this event is still
					// under it after					
					scrollv.scrollTop=Math.round(wsOnCnvCtr.y*((zoomLevels.newZoomScale/zoomLevels.oldZoomScale)-1))+currScroll.top-(Math.round(grnResize.h/(2*(this._bufferedCanvases ? 2 : 1))));
				}
			} else {
				// disable scrolling and translate to the center of the canvas				
				this._disableScrollV();
				this._canvasTranslation.y = Math.round(this._canvas.height/2)
					-((this.currentModel_.drawingObject_.workspace.y+((this.currentModel_.drawingObject_.workspace.h)/2))*zoomLevels.newZoomScale);
			}
			
			// The translation that is placed on the renderer must be adjusted by the scrollbars as well			
			this._canvasRenderer.context_translate(
				this._canvasTranslation.x - scrollh.scrollLeft,
				this._canvasTranslation.y - scrollv.scrollTop
			);

			this._canvasRenderer.context_scale(zoomLevels.newZoomScale,zoomLevels.newZoomScale);
		},
		
		//////////////////////////
		// _transformCanvas
		/////////////////////////
		//
		// Specifically transform the Canvas element itself via the CSS3 transform property
		//
		_transformCanvas: function(property,value) {
			var browserStyle = null;
			if(has("webkit")) {
				browserStyle = "-webkit-transform";
			}
			if(has("mozilla")) {
				browserStyle = "-moz-transform";
			}
			// Double-check for both IE and Trident (IE engine)
			if(has("ie") || has("trident")) {
				browserStyle = "-ms-transform";
			}
			
			var leftMargin = null,
				topMargin = null;
			
			if(value && value < 1) {
				var grnWrapper = dom.byId(this._cnvWrapperNodeId);
				// If we are scaling the Canvas down to fit into the viewport, we want to set it to
				// the full image size so the image is properly resized
				leftMargin = (((grnWrapper.clientWidth-SCROLL_BAR_SPACE)-this.currentModel_.drawingObject_.workspace.w)/2);
				topMargin = (((grnWrapper.clientHeight-SCROLL_BAR_SPACE)-this.currentModel_.drawingObject_.workspace.h)/2);
			}
			
			var styleSet = {
				transform: (value ? property+"("+value+","+value+")" : ""),
			};
			
			if(browserStyle) {
				styleSet[browserStyle] = (value ? property+"("+value+","+value+")" : "");
			}
			styleSet["margin-left"] = leftMargin && leftMargin < 0 ? leftMargin+"px" : "";
			styleSet["margin-top"] = topMargin && topMargin < 0 ? topMargin+"px" : "";
			
			
			domStyle.set(this._canvas,styleSet);

		},
		
		///////////////////////////////
		// _calculateGroupNodeScale
		/////////////////////////////
		//
		//
		_calculateGroupNodeScale: function() {
			var grnWrapper = dom.byId(this._cnvWrapperNodeId);
			if((grnWrapper.clientWidth-SCROLL_BAR_SPACE) < this.currentModel_.drawingObject_.workspace.w 
				|| (grnWrapper.clientHeight-SCROLL_BAR_SPACE) < this.currentModel_.drawingObject_.workspace.h) {
				return Math.min(((grnWrapper.clientWidth-SCROLL_BAR_SPACE)/this.currentModel_.drawingObject_.workspace.w),((grnWrapper.clientHeight-SCROLL_BAR_SPACE)/this.currentModel_.drawingObject_.workspace.h));
			}
			return null;
		},
				
		////////////////////
		// _showLoading
		///////////////////
		//		
		// If the loading element does not exist, create it, and then show or hide it depending
		// on the value of the hide variable
		//
		_showLoading: function(hide) {
			if(!this._loadingScreen) {
				this._loadingScreen = domConstruct.create(
					"div",{
						id: "CanvasLoading",
						width: this._canvas.width,
						height: this._canvas.height,
						innerHTML: "<p><span id=\"CanvasLoadText\">Loading...</span></p>"
					}
				);
				domStyle.set(this._loadingScreen,"display","none");
				domConstruct.place(this._loadingScreen,dom.byId(this._cnvWrapperNodeId),"first");
			}
			domStyle.set(this._loadingScreen,{"display":(hide ? "none" : "block"),width:this._canvas.width + "px",height:this._canvas.height + "px"});
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
				var entities = self._canvasRenderer.getAllSelectedMap(self._currentModelId());
				DojoArray.forEach(ids,function(id){
					names[id] = entities[id].getName();
				});
				loadAsync.resolve(names);
			},function(err){
				console.error(ErrMsgs.CanvasReadyErr + " entity name retrieval!");
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
			
			var imgSize = (this.currentModel_.isGroupNode()) ? (this._calculateGroupNodeScale() || 1) : 1;
						
			// translate from canvas coordinates to unzoomed world coordinates
			translatedHit.x = ((translatedHit.x/imgSize)-(this._canvasTranslation.x-scrollh.scrollLeft))/(this._zoomController.getZoomValue(this._currentZoomLevel));
			translatedHit.y = ((translatedHit.y/imgSize)-(this._canvasTranslation.y-scrollv.scrollTop))/(this._zoomController.getZoomValue(this._currentZoomLevel));
			
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
				this._transformCanvas();
				this._canvasRenderer.context_save();
				
				var grnWrapper = dom.byId(this._cnvWrapperNodeId);
				
				this._canvas.width = (grnWrapper.clientWidth || this._lastWrapperSize.w)-(SCROLL_BAR_SPACE);
				this._canvas.height = (grnWrapper.clientHeight || this._lastWrapperSize.h)-(SCROLL_BAR_SPACE);

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
			
			var grnContainer = dom.byId(this._cnvContainerNodeId);
			
			if(this.currentModel_.isGroupNode()) {
				domStyle.set(grnContainer,"background-color","white");
				domStyle.set(this._canvas,"border","none");
				return;
			} 
			
			domStyle.set(grnContainer,"background-color","");
			domStyle.set(this._canvas,"border","");			
						
			this._canvasRenderer.ctx.beginPath();
			this._canvasRenderer.ctx.fillStyle = "white";
			this._canvasRenderer.ctx.strokeStyle = "gray";
			
			// If no workspace dimensions are available then we just fill the canvas with a workspace
			var width = this._workspaceDimensions.width  || this._canvas.width/this._currentZoomValue;
			var height = this._workspaceDimensions.height || this._canvas.height/this._currentZoomValue; 
			
			// TODO: rendered item size != workspace size!
			var centerX = 0, centerY = 0;
						
			if(this.currentModel_.drawingObject_.center_x !== null && this.currentModel_.drawingObject_.center_x !== undefined) {
				centerX = this.currentModel_.drawingObject_.center_x;
			} else {
				centerX = Math.round(((this.currentModel_.drawingObject_.workspace.w)/2)/this._currentZoomValue);
			}
			
			if(this.currentModel_.drawingObject_.center_y !== null && this.currentModel_.drawingObject_.center_y !== undefined) {
				centerY = this.currentModel_.drawingObject_.center_y;
			} else {
				centerY = Math.round(((this.currentModel_.drawingObject_.workspace.h)/2)/this._currentZoomValue);
			}			
			
			this._canvasRenderer.ctx.rect(
				centerX-Math.round(width/2),
				centerY-Math.round(height/2),
				width,
				height
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
			if(this.currentModel_) {
				var overlay = this.currentModel_.get("overlay_") || {id: null};
				this._canvasRenderer.setOverlayIntensity(this._currentModelId(),overlay.id ? overlay.intensity : 1);
				this._canvasRenderer.toggleOverlay(this._currentModelId(),overlay);
			}
		},
		
		////////////////////////////////
		// _updateRegionToggles
		////////////////////////////////
		//
		// Update any toggled regions in the renderer, but only if we have a valid model.
		// 		
		_updateRegionToggles: function() {
			if(this.currentModel_) {
				var toggledRegions = this.currentModel_.get("toggledRegions_") || {};
				toggledRegions && this._canvasRenderer.toggleGroupForModelID(this._currentModelId(),Object.keys(toggledRegions));
			}
		},

		////////////////////////////////
		// _drawGroupNode
		///////////////////////////////
		//
		// Primary drawing method for GroupNodes, which are special hitmap image sets. 
		// 
		_drawGroupNode: function() {
			var scale = this._calculateGroupNodeScale();
			this._drawWorkspace();
            this._canvasRenderer.renderModelByIDFull(this._currentModelId());
            this._transformCanvas("scale",scale);
		},
		
		////////////////////////////////
		// _drawModel
		///////////////////////////////
		//
		// Primary drawing method for Grn/Pathing Models. Draws the workspace (white rectangle) if set to do so, 
		// sets toggled regions and overlays, then kicks off the Canvas Renderer draw functions.
		// 
		_drawModel: function() {
			this._willDrawWorkspace && this._drawWorkspace();
			this._canvasRenderer.renderModelByIDFull(this._currentModelId());
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
				if(self.currentModel_.isGroupNode()) {
					drawZoomMode = "NAV_ZOOM_TO_GROUP_NODE";
				}
				switch(drawZoomMode){
					case "NAV_ZOOM_TO_GROUP_NODE":
						self.zoomToWholeGroupNode();
						break;
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
					case "ZOOM_TO_FULL_GROUP_NODE":
						// TODO: if we don't allow 'zoom' on GroupNodes this will just be a zoom to 100%
						//break;
					case "NAV_MAINTAIN_ZOOM":
					default:
						self._drawCanvas();
						break;
				}
			};
			this._showLoading();
			if(!modelId) {
				if(!self.currentModel_.isGroupNode()) {
					self._updateOverlay();
					self._updateRegionToggles();
					if(withSelect) {
						self._selectNodes(selectedNodes).then(drawWithZoom(zoomMode));
					} else {
						drawWithZoom(zoomMode);
					}
				} else {
					drawWithZoom(zoomMode);
				}
				asyncRedraw.resolve();
				
			} else {
				self._loadModel(modelId).then(function(){
					if(!self.currentModel_.isGroupNode()) {
						self._updateOverlay();
						self._updateRegionToggles();
						if(withSelect) {
							self._selectNodes(selectedNodes).then(drawWithZoom(zoomMode));
						} else {
							drawWithZoom(zoomMode);
						}
					} else {
						drawWithZoom(zoomMode);
					}
					asyncRedraw.resolve();

				},function(err){
					// Clear out both canvases
					self._clearCanvas();
					self._toggleCanvas();
					self._swapCanvas();
					self._clearCanvas();
					// Reset our scrolling and disable it
					self._adjustScrolling(self._currentZoomValue);
					self._disableScrolling();
					// If there is no valid currentModel then we don't want to flag this as a successful redraw
					// otherwise, we can.
					if(self.currentModel_) {
						asyncRedraw.resolve();
					} else {
						asyncRedraw.reject();	
					}
					// Hide the loading element
					self._showLoading(true);
				});
			}
			return asyncRedraw.promise;
		},
		
		/////////////////////////////////////////
		// _loadModel
		/////////////////////////////////////////
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
			var loadingModel = (modelId !== null && modelId !== undefined ? 
				ArtboardController.getArtboardController(this._cnvContainerNodeId).getModel(modelId) 
				: ArtboardController.getArtboardController(this._cnvContainerNodeId).getCurrentModel());
			loadingModel.then(function(loadedModel){
				if(!loadedModel) {
					self.currentModel_ = null;
					self._canvasIsReady = false;
					self._canvasReady = new Deferred();
					self._asyncModelLoader.reject("No model for " + modelId);
				} else {
					var oldModel = self.currentModel_;
					self.currentModel_ = loadedModel;
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
										
					self._workspaceDimensions.width = (loadedModel.isGroupNode() ? 0 : loadedModel.drawingObject_.workspace.w); 
					self._workspaceDimensions.height = (loadedModel.isGroupNode() ? 0 : loadedModel.drawingObject_.workspace.h);

					require(["controllers/ArtboardController","static/XhrUris"],function(ArtboardController,XhrUris){
						var myAbC = ArtboardController.getArtboardController(self._cnvContainerNodeId);
						if(!loadedModel.isGroupNode()) {
							if(!myAbC.drawingObjIsCached(loadedModel.get("modelId_"))) {
								self._canvasRenderer.addModel(
									loadedModel.get("modelId_")+"_"+self._cnvContainerNodeId,
									loadedModel.drawingObject_.overlay_data,
									loadedModel.drawingObject_.draw_layer_groups,
									loadedModel.drawingObject_.fonts
								);
								myAbC.setCachedInRenderer(loadedModel.get("modelId_"),true);
							}
							self._asyncModelLoader.resolve(loadedModel);
							self._rendererIsValid = true;
						} else {
							var image_uri = XhrUris.groupnodeimg(self.currentModel_.get("modelId_"),ArtboardController.getArtboardController(self._cnvContainerNodeId).get("tabId_"));
                            var clickmap_uri = XhrUris.groupnodemap(self.currentModel_.get("modelId_"),ArtboardController.getArtboardController(self._cnvContainerNodeId).get("tabId_"));

                            if(!myAbC.drawingObjIsCached(loadedModel.get("modelId_"))) {
                                self._canvasRenderer.addGroupNode(
                                    loadedModel.get("modelId_")+"_"+self._cnvContainerNodeId,
                                    loadedModel.drawingObject_.clickMap,
                                    image_uri,
                                    clickmap_uri,
                                    loadedModel.drawingObject_.color_bounds_map
                                );
                                myAbC.setCachedInRenderer(loadedModel.get("modelId_"),true);
                            }
                            self._asyncModelLoader.resolve(loadedModel);
                            self._rendererIsValid = true;
						}
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
		// cnvw and cnvh DIVs which virtualize the workspace size.
		//
		_adjustScrolling: function(currScale) {
			var grnWrapper = dom.byId(this._cnvWrapperNodeId);
			var scrollh = dom.byId("scrollh_" + this._cnvContainerNodeId);
			var scrollv = dom.byId("scrollv_" + this._cnvContainerNodeId);	
			
			domStyle.set(scrollh,{width: ((grnWrapper.clientWidth || this._lastWrapperSize.w)-SCROLL_BAR_SPACE) + "px",height: SCROLL_BAR_SIZE+"px"});
			domStyle.set(scrollv,{height: ((grnWrapper.clientHeight  || this._lastWrapperSize.h)-SCROLL_BAR_SPACE) + "px",width: SCROLL_BAR_SIZE+"px"});
						
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
			
			wsCoords.x = (this._zoomController.getZoomValue(this._currentZoomLevel) * point.x) + this._canvasTranslation.x;
			wsCoords.y = (this._zoomController.getZoomValue(this._currentZoomLevel) * point.y) + this._canvasTranslation.y;
			
			scrollh.scrollLeft = wsCoords.x-(this._canvas.width/2);
			scrollv.scrollTop = wsCoords.y-(this._canvas.height/2);
		},
		
	/////////////////////////////////////////////////////
	// Virtual Scrolling
	/////////////////////////////////////////////////////
			
		// Set up the vertical virtual scroll element.
		_initScrollV: function(zoomScale) {

			var self=this;
			var scrollv = dom.byId("scrollv_" + this._cnvContainerNodeId);
			
			this._scrollHandlers.scrollv.enabled = true;
        	scrollv.scrollTop = Math.round(((this._workspaceDimensions.height*zoomScale)-this._canvas.height)/2);
        	
        	if(!this._scrollHandlers.scrollv.th) {
    			var scrollDraw = function(e) {
            		if(self._rendererIsValid) {
            			self._drawCanvas();
            		}
            	};
        		this._scrollHandlers.scrollv.th=on.pausable(scrollv,"scroll",throttle(scrollDraw,REDRAW_THROTTLE_RATE));
        		// To ensure the scroll positions are synced with the canvas, we add a debounce lagging
            	// just behind the throttled redraws, to make sure the draw fires one last time and 
            	// syncs up the canvas translations with the scroll positions
            	this._scrollHandlers.scrollv.db=on.pausable(scrollv,"scroll",debounce(scrollDraw,REDRAW_DEBOUNCE_DELAY));
        	} else {
        		this._scrollHandlers.scrollv.th.resume();
        		this._scrollHandlers.scrollv.db.resume();
        	}

		},

		// Set up the horizontal virtual scroll element.
		_initScrollH: function(zoomScale) {
			
			var self=this;
			var scrollh = dom.byId("scrollh_" + this._cnvContainerNodeId);
			
        	scrollh.scrollLeft = Math.round(((this._workspaceDimensions.width*zoomScale)-this._canvas.width)/2);
			
        	this._scrollHandlers.scrollh.enabled = true;
        	
        	if(!this._scrollHandlers.scrollh.th) {
    			var scrollDraw = function(e) {
            		if(self._rendererIsValid) {
            			self._drawCanvas();
            		}
            	};
            	
            	this._scrollHandlers.scrollh.th=on.pausable(scrollh,"scroll",throttle(scrollDraw,REDRAW_THROTTLE_RATE));
            	// To ensure the scroll positions are synced with the canvas, we add a debounce lagging
            	// just behind the throttled redraws, to make sure the draw fires one last time and 
            	// syncs up the canvas translations with the scroll positions
            	this._scrollHandlers.scrollh.db=on.pausable(scrollh,"scroll",debounce(scrollDraw,REDRAW_DEBOUNCE_DELAY));
        	} else {
        		this._scrollHandlers.scrollh.th.resume();
        		this._scrollHandlers.scrollh.db.resume();
        	}
		},

		// Disable the horizontal scroll element's event
		_disableScrollH: function() {
			if(this._scrollHandlers.scrollh.enabled) {
				this._scrollHandlers.scrollh.enabled = false;
				this._scrollHandlers.scrollh.th.pause();
				this._scrollHandlers.scrollh.db.pause();
			}
		},
		
		// Disable the vertical scroll element's event
		_disableScrollV: function() {
			if(this._scrollHandlers.scrollv.enabled) {
				this._scrollHandlers.scrollv.enabled = false;
				this._scrollHandlers.scrollv.th.pause();
				this._scrollHandlers.scrollv.db.pause();
			}			
		},
		
		// Disable both scroll elements' indidvidual events, and the combined dragToScroll event
		_disableScrolling: function() {
			this._disableScrollH();
			this._disableScrollV();
		},
		
		///////////////////////////////
		// _makeOffCanvas
		//////////////////////////////
		//
		// Build the DOM element for the _offCanvas variable
		_makeOffCanvas: function() {
			var grnWrapper = dom.byId(this._cnvWrapperNodeId);
			this._offCanvas = domConstruct.create(
				"canvas",{
					id: this._cnvContainerNodeId + "Canvas2_" + utils.makeId(),
					width: (grnWrapper.clientWidth || this._lastWrapperSize.w)-SCROLL_BAR_SPACE,
					height: (grnWrapper.clientHeight || this._lastWrapperSize.h)-SCROLL_BAR_SPACE
				}
			);
		},
		
		///////////////////////////////
		// _toggleCanvas
		//////////////////////////////
		//
		// Switch the private canvas references
		//
		_toggleCanvas: function(){
			if(this._bufferedCanvases) {
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
			}
			
			// Always do a context update
			this._canvasRenderer.setElementAndContext(this._canvas);
		},
		
		///////////////////////////////
		// _swapCanvas
		//////////////////////////////
		//
		// Swap the canvas DOM nodes
		//
		_swapCanvas: function() {
			this._bufferedCanvases && domConstruct.place(this._canvas,this._offCanvas,"replace");	
		},
		
		///////////////////////////////
		// _drawCanvas
		//////////////////////////////
		//
		// Primary draw method. Toggles the canvases, sets the zoom levels
		// and adjusts the scroll settings, draws the model, and swaps
		// the canvases
		//		
		_drawCanvas: function(zoomToLvl) {
    		this._toggleCanvas();

    		// only store the zoomToLvl if it has a value set
    		if(zoomToLvl !== undefined && zoomToLvl !== null) {
    			this._currentZoomLevel = zoomToLvl;
			}
    		
    		this._zoom(this._currentZoomLevel,zoomToLvl);
    		

    		if(this.currentModel_.isGroupNode()) {
    			this._drawGroupNode();
    		} else {
    			this._drawModel();	
    		}
			   
			this._swapCanvas();
			this._showLoading(true);
		},
		
		/////////////////////////////////////
		// _buildCanvas
		////////////////////////////////////
		//
		// Build the canvas element and its accompanying virtual scrolling system.
		//
		_buildCanvas: function() {
			
			var grnWrapper = dom.byId(this._cnvWrapperNodeId);
			
			this._lastWrapperSize = {
				w: grnWrapper.clientWidth,
				h: grnWrapper.clientHeight
			};
			
			var self=this;
			
			var cnvRow1 = domConstruct.create("div",{id: "cnvRow1_" + this._cnvContainerNodeId, width: (grnWrapper.clientWidth-2)},grnWrapper,"last");
			var cnvRow2 = domConstruct.create("div",{id: "cnvRow2_" + this._cnvContainerNodeId, width: (grnWrapper.clientWidth-SCROLL_BAR_SIZE)},grnWrapper,"last");
						
			var grn = domConstruct.create("div",{
				id: this._cnvContainerNodeId,
				"class":"CanvasContainer"
			},cnvRow1,"first");

			this._canvas = domConstruct.create(
				"canvas",{
					id: this._cnvContainerNodeId + "Canvas1_" + utils.makeId(),
					width: grnWrapper.clientWidth-SCROLL_BAR_SPACE,
					height: grnWrapper.clientHeight-SCROLL_BAR_SPACE
				}, 
				grn
			);
			
			// OSX scrollbars
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
			// There is currently no solution available for Firefox which does not rely on Js-created scrollbars.
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
			
			// We need to create a scrollwheel event for our Canvas container since we've shut off native scrolling.
			//
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
		//
	    _selectNodes: function(nodesToSelect) {
	    	var self=this;
	    	var asyncSelector = new Deferred();
	    	this._asyncModelLoader.promise.then(function(model){
	    		if(!self.currentModel_) {
	    			asyncSelector.reject();
	    		} else {
			    	if(!nodesToSelect) {
			    		nodesToSelect = {};
			    	}
		    		self._canvasRenderer.setSelectedNodeIDMap(self._currentModelId(),nodesToSelect);
		    		asyncSelector.resolve();	
	    		}
	    	},function(err){
	    		console.error("[ERROR] In node selection: "+err);
	    	});
	    	return asyncSelector.promise;
	    },	    
	    
	    /////////////////////////////////////////
	    // _drawClickError
	    ////////////////////////////////////////
	    //
	    //
	    _drawClickError: function() {
	    	if(this.actionClickPending_ && this.placeHolder_) {
	    		var self=this;
    			var ctx = this.placeHolder_.getContext("2d");
    			ctx.clearRect(0,0,self.placeHolder_.width,self.placeHolder_.height);
    			ctx.font="bold 50px serif";
    			ctx.fillStyle="red";
    			ctx.textBaseline="top";
    			ctx.fillText("NO",0,0);
	    	}
	    },

	    /////////////////////////////////////////
	    // _actionClickPending
	    ////////////////////////////////////////
	    //
	    // Set the _actionClickPending state
	    //
	    _actionClickPending: function(isPending) {
	    	this.actionClickPending_ = isPending;
	    },
	    
	    ///////////////////////////////////////
	    // _drawClickPending
	    //////////////////////////////////////
	    //
	    // Creates the floating to-be-drawn Node canvas and attaches the events which drive its movement,
	    // and associates the callback which will fire when the click event is emitted.
	    //
	    _drawClickPending: function(drawClick,clickEvent) {

	    	// Helper function
		    var movePlaceHolder = function(e) {
		    	domStyle.set(this.placeHolder_,{
		    		top: (e.clientY) + "px",
		    		left: (e.clientX) + "px"
		    	});
		    };
		    
	    	var self=this;
	    	if(drawClick === true) {
	    		// TODO: Make this its own method?
	    		this.actionClickPending_ = true;
	    		if(this.placeHolder_ === null) {
	    			this.placeHolder_ = domConstruct.create("canvas",{id: "placeHolder"},document.body,"first");
	    			this.placeHolder_.width = 100;
	    			this.placeHolder_.height = 50;
	    		}
    			var ctx = this.placeHolder_.getContext("2d");
    			ctx.clearRect(0,0,this.placeHolder_.width,this.placeHolder_.height);
    			ctx.font="bold 50px serif";
    			ctx.fillStyle="black";
    			ctx.textBaseline="top";
    			ctx.fillText("New Gene",0,0);
	    			
	    		if(clickEvent) {
		    		this.drawClickMoveHandlers_ = new Array();
		    		require(["dojo/_base/lang"],function(lang){
		    			self.drawClickMoveHandlers_.push(on(dom.byId(self._cnvContainerNodeId),"mousemove",lang.hitch(self,movePlaceHolder)));
		    			self.drawClickMoveHandlers_.push(on(self.placeHolder_,"mousemove",lang.hitch(self,movePlaceHolder)));	 
		    			self.drawClickMoveHandlers_.push(on(self.placeHolder_,"click",clickEvent));
		    		});
		    		
		    		self.drawClickMoveHandlers_.push(on.once(dom.byId(self._cnvContainerNodeId),"mousemove",function(e){
			    		domStyle.set(self.placeHolder_,{
			    			display:"block",
			    			top:e.clientX+"px",
			    			left:e.clientY+"px"
		    			});	    			
		    		}));
	    		}
    		// TODO: Make this its own method 
	    	} else {
	    		this.actionClickPending_ = false;
		    	domStyle.set(this.placeHolder_,{
		    		display: "none",
		    		top: "0px",
		    		left: "0px"
		    	});	    		
	    		DojoArray.forEach(this.drawClickMoveHandlers_,function(handler){handler.remove();});
	    	}
	    },
	    
	    //////////////////////////////
	    // _toggleWatchEvents
	    /////////////////////////////
	    //
	    // Toggle the value of _drawEventsGo
	    //
	    _toggleWatchEvents: function() {
	    	this._drawEventsGo = !this._drawEventsGo;
	    },
	    
	    //////////////////////////
	    // _buildMouseHandlers
	    /////////////////////////
	    //
	    // Puts together the primary event handling of mouseup, mousedown, and mousemove.
	    // This includes left-drag events (control-left scrolling and left-only selection box), left 
	    // and shift-left entity selection and left note-sticky, tooltips, note and groupnode hovers, 
	    // and right or alt-left context menuing
	    //
	    _buildMouseHandlers: function() {
	    	var self=this;
	    	var grn = dom.byId(this._cnvContainerNodeId);
	    	
	    	// If a selexBox is in use, it's possible for the mouse events to
	    	// fire from that and not from the window or grn. We define a special function
	    	// so we can bind mouseup on the selection box to the same event as would be
	    	// fired if it occurred on the window/grn.
	    	self._mouseHandlers.LEFT.DRAG.NONE.selBox.mouseUpCallback = function(e) {
	    		self._mouseHandlers.LEFT.DRAG.NONE.pauseAll();
	    		self._mouseStatus.mouseUp(e);
	    		var diffX = Math.abs(self._mouseStatus.upX-self._mouseStatus.downX);
	    		var diffY = Math.abs(self._mouseStatus.upY-self._mouseStatus.downY);
	    		if(self._mouseHandlers.LEFT.DRAG.NONE.callback && (diffX > MIN_MOUSE_MOVE || diffY > MIN_MOUSE_MOVE)) {
	    			var mouseStatus = self._mouseStatus;
	    			var translatedStart = self._translateHit({x: mouseStatus.downX, y: mouseStatus.downY});
	    			var translatedStop = self._translateHit({x: mouseStatus.upX, y: mouseStatus.upY});
	    			e.hits = self.intersectByBoundingBox({
	    				min_x: Math.min(translatedStart.x,translatedStop.x),
	    				max_x: Math.max(translatedStart.x,translatedStop.x),
	    				min_y: Math.min(translatedStart.y,translatedStop.y),
	    				max_y: Math.max(translatedStart.y,translatedStop.y)	
	    			});
	    			e.selectedNodes = self.getSelectedNodes();
	    			self._mouseHandlers.LEFT.DRAG.NONE.callback(e);
	    		}
	    		self._mouseStatus.clear();
	    		self._selexBox.cleanUp();	
	    	};
	    	
	    	self._mouseHandlers.LEFT.DRAG.CTRL = function(e) {			
				if(self._scrollHandlers.scrollh.enabled) {
					dom.byId("scrollh_" + self._cnvContainerNodeId).scrollLeft += (self._mouseStatus.currX-e.clientX);
				}
				if(self._scrollHandlers.scrollv.enabled) {
					dom.byId("scrollv_" + self._cnvContainerNodeId).scrollTop += (self._mouseStatus.currY-e.clientY);
				}
	    	};
	    	
	    	// Primary Mousedown Handle
	    	this.own(
            	on(grn,"mousedown",function(e){
            		self._mouseStatus.mouseDown(e);
            		
            		self._tooltip && self._tooltip.hide();
 
            		if(self.currentModel_ && self.currentModel_.drawingObject_) {
            			var clickedOn = null;
            			if(self.currentModel_.isGroupNode()) {
            				var ID = self.getGroupNodeClick(self._translateHit({x: e.clientX, y: e.clientY}));
	        				if(ID) {
	        					clickedOn = {};
	        					clickedOn.modelId = ((ID.node_id !== null && ID.node_id !== undefined) ? ID.node_id : ID.proxy_id);
	        					clickedOn.state = ID.proxy_time;
	        					clickedOn.region = ID.region_id;
	        				}            				
            			} else {
                			var hits = self.intersectByPoint(self._translateHit({x: e.clientX, y: e.clientY}));
                			if(hits) {
                				clickedOn = {};
                				clickedOn.hits = hits;
                				clickedOn.selNodes = self.getSelectedNodes();
                			}
                		}
            			
                		// clickedOn && self._prepForDrag(clickedOn); 
                		
                		if(!self.currentModel_.isGroupNode() && (!e.hits || !HitPriority.movableHit(e.hits)) && self._keysPressed(e) === "NONE") {
                			self._mouseHandlers.LEFT.DRAG.NONE.resumeAll();
                		}
            		}
            	})
            );
	    	
	    	// Primary Mouseup Handle
	    	this.own(on(grn,"mouseup",function(e){
	    		self._mouseStatus.mouseUp(e);
	    		self._mouseHandlers.LEFT.DRAG.NONE.pauseAll();
	    		
				if(!self.actionClickPending_ && self.currentModel_ && self.currentModel_.drawingObject_) {
					if(self._selexBox.isShown) {
						self._mouseHandlers.LEFT.DRAG.NONE.selBox.mouseUpCallback(e);
					} else {
						if(self.currentModel_.isGroupNode()) {
	        				var ID = self.getGroupNodeClick(self._translateHit({x: e.clientX, y: e.clientY}));
	        				if(!ID) {
	        					e.modelId = null;
	        					e.state = null;
	        					e.region = null;
	        				} else {
	        					e.modelId = ((ID.node_id !== null && ID.node_id !== undefined) ? ID.node_id : ID.proxy_id);
	        					e.state = ID.proxy_time;
	        					e.region = ID.region_id;
	        				}
	        			} else {
	        				e.hits = self.intersectByPoint(self._translateHit({x: e.clientX, y: e.clientY}));
	        				e.selectedNodes = self.getSelectedNodes();
	        			}
						e.nodeType = self.currentModel_.nodeType_;
						if(mouse.isLeft(e)) {
							// Require no minimum movement over the max to ensure this wasn't an accidental mouseup during a drag
							 !self._mouseStatus.isMinMove(e) && self._mouseHandlers 
							 	&& self._mouseHandlers.LEFT[self._keysPressed(e)] 
							 && self._mouseHandlers.LEFT[self._keysPressed(e)](e);
						} else {
							self._mouseHandlers && self._mouseHandlers.RIGHT[self._keysPressed(e)] 
								&& self._mouseHandlers.RIGHT[self._keysPressed(e)](e);
						}
					}
				}
				self._mouseStatus.clear();
	    	}));
	    		   
	    	// We'll need to perform this action in several places, so we make it into a function
	    	// to be called from those event handlers.
	    	var resizeSelBox = function(e) {
	    		if(self._mouseStatus.isDown && self._mouseStatus.which === LEFT_MOUSE && !self.currentModel_.isGroupNode()) {
					self._selexBox.show({
		    			x: Math.min(e.clientX,self._mouseStatus.downX),
		    			y: Math.min(e.clientY,self._mouseStatus.downY),
			    		w: Math.abs(e.clientX-self._mouseStatus.downX),
			    		h: Math.abs(e.clientY-self._mouseStatus.downY)
		    		});
	    		}
	    		e.preventDefault();
	    	};
	    	
	    	// We need the box to keep drawing even if they mouse off the canvas, so we have
	    	// to assign the mousemove to the window as well as grn
	    	this._mouseHandlers.LEFT.DRAG.NONE.windowMouseMove = on.pausable(window,"mousemove",function(e){
	    		resizeSelBox(e);
	    	});
	    	
	    	// Because it's possible for events to trigger from the selection box DIV itself, we 
	    	// assign handlers to it, but we pause that handler any time the selectionBox is not
	    	// being displayed (done in mouseup)
	    	this._mouseHandlers.LEFT.DRAG.NONE.selBox.moveMove = on.pausable(self._selexBox._domNode,"mousemove",function(e){
	    		resizeSelBox(e);
	    	});
	    	this._mouseHandlers.LEFT.DRAG.NONE.selBox.mouseUp = on.pausable(self._selexBox._domNode,"mouseup",function(e){
	    		self._mouseHandlers.LEFT.DRAG.NONE.selBox.mouseUpCallback(e);
	    	});
	    	
	    	this.own(this._mouseHandlers.LEFT.DRAG.NONE.windowMouseMove);
	    	self._mouseHandlers.LEFT.DRAG.NONE.windowMouseMove.pause();
	    	
	    	var tooltipThread = null;
	    	
		    var tooltipStop = function(e) {
		    	var aroundThis = {x: e.clientX, y: e.clientY};
		    	if(!self.actionClickPending_ && self.currentModel_ && self.currentModel_.drawingObject_ && self._rendererIsValid && self._canvasIsReady) {
		    		var hits = [];
					if(!self.currentModel_.isGroupNode()) {
	    				hits = self.intersectByPoint(self._translateHit({x: e.clientX, y: e.clientY},self.cnvContainerDomNodeId_));
			    	}
			    	var tooltipableHit = (hits && hits.length > 0) ? HitPriority.getTopPriorityHit(hits,{note: true},self.currentModel_.get("toggledRegions_")) : null;
			    	var showThis = tooltipableHit ? self._tooltip.fetch(tooltipableHit) : null;
			    	if(showThis && !BTContextMenus.contextIsOpen("canvas") && (!self._tooltip.toShow || !self._tooltip.isCurrentlyShown(showThis))){
			    		self._tooltip.show(showThis,aroundThis);					    	
		    		}
		    	}
		    };
		    
	    	// Primary Mousemove Handle
		    // This is a pausable handle so we can stop firing this handler in certain circumstances where
		    // it might prove extraneous or problematic
	    	var mainMouseMove = on.pausable(grn,"mousemove",function(e){
	    		if(self._mouseStatus.isDown) {
	    			// These are 'drag' handlers
	    			if(self._mouseStatus.which === "LEFT") {
	    				switch(self._keysPressed(e)) {
		    				case "CTRL":
		    					self._mouseHandlers && self._mouseHandlers[self._mouseStatus.which] && 
		    						self._mouseHandlers[self._mouseStatus.which].DRAG.CTRL && self._mouseHandlers[self._mouseStatus.which].DRAG.CTRL(e);
		    					e.preventDefault();
		    					e.stopPropagation();
		    					break;
		    				case "NONE":
		    					resizeSelBox(e);
		    					break;
	    					default:
	    						break;
		    			}
	    			}
	    		} else {
	    			if(self.currentModel_ && self.currentModel_.drawingObject_ && self._rendererIsValid && self._canvasIsReady) {
	    				// Hovers act immediately
	    				var translatedHit = self._translateHit({x: e.clientX, y: e.clientY});
    					if(self.currentModel_.isGroupNode()) {
				    		var ID = self.getGroupNodeClick(translatedHit);
				    		if(ID) {
				    			self._canvasRenderer._enableGroupNodeRegionHighlightWithPoint(translatedHit,self._currentModelId());	
				    		} else {
				    			self._canvasRenderer._disableGroupNodeRegionHighlight(self._currentModelId());
				    		}
				    		self._canvasRenderer.renderModelByIDFull(self._currentModelId());
	    					self._mouseHandlers.HOVER.groupnode && self._mouseHandlers.HOVER.groupnode(e);
				    	} else {
				    		var hits = self.intersectByPoint(translatedHit);
					    	var noteHit = (hits && hits.length > 0) ? HitPriority.getTopNoteHit(hits,null,self.currentModel_.get("toggledRegions_")) : null;
					    	var showThis = noteHit ? self._mouseHandlers.HOVER.note(noteHit) : null;
					    	showThis = (showThis && showThis.msg ? showThis : null);
					    	if(showThis) {
					    		if(!self._currentNote) {
					    			self._currentNote = showThis.id;
							    	GrnModelMsgs.pushMessage(showThis);
					    		} else if(self._currentNote !== showThis.id){
					    			GrnModelMsgs.popMessage();
					    			GrnModelMsgs.pushMessage(showThis);
					    		}
					    	} else if(self._currentNote){
					    		GrnModelMsgs.popMessage();
					    		self._currentNote = null;
					    	}
				    	}
		    								    
	    				// Unlike hovering, tooltip has a slight delay built in, so that we're sure we've stopped at a point and
    					// aren't just passing through it. If there's a tooltip up already, we require a minimum movement from it 
    					// (rather than from the last recorded mouse position) before we clear timeouts and hide it. This helps 
    					// prevent tooltip flicker as we mouse along a tooltip-popping object, or a tooltip which is already open
	    				if(self._tooltip.showAt ? (Math.abs(self._tooltip.showAt.x - e.clientX) > MIN_MOUSE_MOVE || Math.abs(self._tooltip.showAt.y - e.clientY) > MIN_MOUSE_MOVE)
	    					: true) {
	    					self._tooltip && self._tooltip.hide();
	    					tooltipThread && clearTimeout(tooltipThread);
	    				}
				    	
				    	// Set a new one
					    tooltipThread = setTimeout(tooltipStop, self._tooltip.delay,e);
		    		}
	    		}
	    		
	    		self._mouseStatus.currX = e.clientX;
	    		self._mouseStatus.currY = e.clientY;
	    	});	
	    	
	    	// Pause the mousemove event any time we leave the window, and resume it any time we hover
	    	// back onto the GRN container
	    	this.own(on(window,"mouseleave",function(e){
	    		mainMouseMove.pause();
	    	}));
	    	
	    	this.own(on(window,"mouseout",function(e){
	    		mainMouseMove.pause();
	    	}));
	    	
	    	this.own(on(window,"blur",function(e){
	    		mainMouseMove.pause();
	    	}));
	    	
	    	this.own(on(grn,"mouseover",function(e){
	    		mainMouseMove.resume();
	    	}));
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
	    // Empty the supplied list of models from the renderer cache.
		// TODO: If no model IDs are provided, flush all?
	    //
		flushRendererCache: function(modelIds) {
			this._rendererIsValid = false;
			var self=this;
			DojoArray.forEach(modelIds,function(modelId){
				self._canvasRenderer.removeModel(modelId+"_"+self._cnvContainerNodeId);
				if(self.currentModel_ && (self.currentModel_.get("modelId_") === modelId)) {
					self._canvasIsReady = false;
					self._canvasReady = new Deferred();
					self.currentModel_ = null;
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
		// attachLeftClickEvents
		/////////////////////////////////////
		//
		// Attach callbacks to the click event when the left key is used. Can provide 
		// key+leftclick alternate callbacks if desired
		//
	    attachLeftClickEvent: function(leftOnlyCallback,shiftCallback,ctrlCallback,altCallback) {
	    	this._mouseHandlers.LEFT.NONE = leftOnlyCallback;
	    	this._mouseHandlers.LEFT.SHIFT = shiftCallback;
	    	this._mouseHandlers.LEFT.ALT = altCallback;
	    	this._mouseHandlers.LEFT.CTRL = ctrlCallback;
	    },
	    
	    ////////////////////////////////
	    // attachRightClickEvent
	    ///////////////////////////////
	    //
	    // Assign a callback to mousedown events where the right mouse button is
	    // in use, and no keyboard keys are being pressed
	    //
	    attachRightClickEvent: function(callback) {
	    	this._mouseHandlers.RIGHT.NONE = callback;
	    	this._mouseHandlers.LEFT.ALT = callback;
	    },    
	    	  
	    /////////////////////////////////////
	    // attachHoverEvents
	    /////////////////////////////////////
	    //
	    // Attach callbacks to manage any on-hover events
	    //
	    attachHoverEvents: function(noteCallback,groupNodeCallback) {
	    	this._mouseHandlers.HOVER.note = noteCallback;
	    	this._mouseHandlers.HOVER.groupnode = groupNodeCallback;
	    },
    
	    ///////////////////////
	    // attachTooltipEvent
	    ///////////////////////
	    //
	    // Attach a callback to the 'tooltip' event, defined as a mouse pausing in a location
	    // for more than params.delay milliseconds.
	    // 
	    // The callback should be the function which will return whatever is to be displayed in the tooltip.
	    //
	    attachTooltipEvent: function(callback,params) {
	    	this._tooltip.padding = params.padding;
	    	this._tooltip.delay = params.delay;
	    	this._tooltip.fetch = callback;
	    },
	    
	    /////////////////////////////////
	    // attachDragSelectEvent
		/////////////////////////////////
	    //
	    // Drag-to-Select implemented via CSS editing of a top-level DIV.
	    // This DIV's basic attributes (border size and color) are defined in main.css#selexBox 
		//
	    attachDragSelectEvent: function(callback) {
	    	this._mouseHandlers.LEFT.DRAG.NONE.callback = callback;
	    },
	
	    //////////////////////
	    // updateZoomStates
	    /////////////////////
	    //
	    // 
	    updateZoomStates: function() {
	    	this._zoomController.updateStates(this._currentZoomLevel,this.zoomStates_);
	    },
	    
	    ///////////////////////
	    // disableZooming
	    ///////////////////////
	    //
	    //
	    disableZooming: function() {
	    	this._zoomController.disableZooming(this.zoomStates_);
	    },
	    
	    // pass through method to the Renderer point selection method
	    intersectByPoint: function(thisHit) {
	    	return this._canvasRenderer._doPointSelection(thisHit,this._currentModelId());
	    },

	    // pass through method to the Renderer rectangular selection method
	    intersectByBoundingBox: function(thisBox) {
	    	return this._canvasRenderer._doRectangleSelection(thisBox,this._currentModelId());
	    },
	    
	    // pass through method to the Renderer Group Node click method
	    getGroupNodeClick: function(thisHit) {
	    	return this._canvasRenderer._getGroupNodeClickId(thisHit,this._currentModelId());
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
	    			console.warn("[WARNING] Did not select nodes in BTCanvas.selectNodes!");
	    			asyncSelector.resolve();
	    		});
	    	},function(err){
	    		console.error(ErrMsgs.CanvasReadyErr + " node selection!");
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
	    			asyncSelector.resolve(self._canvasRenderer.getAllSelectedMap(self._currentModelId()));
	    		},function(err){
	    			console.error("[ERROR] Loader rejected in BTCanvas.getAllNodes!");
	    			asyncSelector.reject(err);
	    		});
	    	},function(err){
	    		console.error(ErrMsgs.CanvasReadyErr + " retrieval of all nodes!");
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
	    	return this._canvasRenderer.getLinkageBySharedID(this._currentModelId(),linkId);
	    },
	    
	    //////////////////////////////////
	    // getSelectedNodes
	    //////////////////////////////////
	    //
	    // Return the list of nodes the renderer has marked as selected
	    //
		getSelectedNodes: function() {
			return this._canvasRenderer.getSelectedNodeIDMap(this._currentModelId());
		},
		

	// ------------------------------- Zoom Drawing Actions ------------------------------- //

		
		///////////////////
		// zoomTo_
		//////////////////
		//
		// All zoom events delegate to this method
		//
		// zoomLvl (optional) - the index in the ZoomController array which corresponds to a 
		// 		zoom value
		// 
		zoomTo_: function(zoomLvl) {
			this._drawCanvas(zoomLvl);
		},
		
		////////// Basic Zooming //////////
		zoomIn: function() {
			this.zoomTo_(this._zoomController.zoomIn(this._currentZoomLevel,this.zoomStates_));
		},
		zoomOut: function() {
			this.zoomTo_(this._zoomController.zoomOut(this._currentZoomLevel,this.zoomStates_));
		},
		
		////////// Module-centric Zooming //////////
		zoomToModules: function(modules) {
			var grnWrapper = dom.byId(this._cnvWrapperNodeId);
			
			var modBounds = canvasRenderer.getOverlay(
				this._currentModelId(),
				this.currentModel_.get("overlay_").id
			).getOuterBoundsForModules(modules);
			this.zoomTo_(this._zoomController.getOptimalZoom(
    			{w: (Math.abs(modBounds.max_x - modBounds.min_x)), h: (Math.abs(modBounds.max_y - modBounds.min_y))},
    			{w: (grnWrapper.clientWidth || this._lastWrapperSize.w).clientWidth-SCROLL_BAR_SIZE,h: (grnWrapper.clientHeight || this._lastWrapperSize.h)-SCROLL_BAR_SIZE},
    			"OPTIMAL_SELECTED",
    			this.zoomStates_
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
				DojoArray.forEach(self.currentModel_.get("overlay_").enabled_modules,function(mod){
					enabledMods.push(mod.id);
				});
				self._updateOverlay();
				self._updateRegionToggles();
				self.zoomToModules(enabledMods);
			});			
		},
		
		////////// Node- and Selection-specific Zooming //////////
		zoomToNode: function(nodeId) {
			var self=this;
			
			this._asyncModelLoader.promise.then(function(){
				var grnWrapper = dom.byId(self._cnvWrapperNodeId);
								
				var nodeBounds = canvasRenderer.getBoundsForIntersection(
					self._currentModelId(),
					canvasRenderer.getIntersectionsByIDs(self._currentModelId(),[nodeId])[nodeId]
				);
				self.zoomTo_(self._zoomController.getOptimalZoom(
	    			{w: (Math.abs(nodeBounds.max_x - nodeBounds.min_x)), h: (Math.abs(nodeBounds.max_y - nodeBounds.min_y))},
	    			{w: (grnWrapper.clientWidth || self._lastWrapperSize.w)-SCROLL_BAR_SIZE,h: (grnWrapper.clientHeight || self._lastWrapperSize.h)-SCROLL_BAR_SIZE},
	    			"OPTIMAL_SELECTED",
	    			self.zoomStates_
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
				var grnWrapper = dom.byId(self._cnvWrapperNodeId);
				
				var nodeBounds = canvasRenderer.getBoundsForIntersection(self._currentModelId(),self.getSelectedNodes()[nodeId]);
				self.zoomTo_(self._zoomController.getOptimalZoom(
	    			{w: (Math.abs(nodeBounds.max_x - nodeBounds.min_x)), h: (Math.abs(nodeBounds.max_y - nodeBounds.min_y))},
	    			{w: (grnWrapper.clientWidth || self._lastWrapperSize.w)-SCROLL_BAR_SIZE,h: (grnWrapper.clientHeight || self._lastWrapperSize.h)-SCROLL_BAR_SIZE},
	    			"OPTIMAL_SELECTED",
	    			self.zoomStates_
				));
				
				self._scrollToWorldPoint({
					x: nodeBounds.min_x + (Math.abs(nodeBounds.max_x - nodeBounds.min_x))/2, 
					y: nodeBounds.min_y + (Math.abs(nodeBounds.max_y - nodeBounds.min_y))/2
				});	
			});
		},		
		zoomToSelected: function(focusCanvas) {
			var self=this;
			this._asyncModelLoader.promise.then(function(){
				var grnWrapper = dom.byId(self._cnvWrapperNodeId);
				var selectedBoundingBox = canvasRenderer.getBoundsForSelectedNodes(self._currentModelId());
				self.zoomTo_(self._zoomController.getOptimalZoom(
	    			{w: (Math.abs(selectedBoundingBox.max_x - selectedBoundingBox.min_x)), h: (Math.abs(selectedBoundingBox.max_y - selectedBoundingBox.min_y))},
	    			{w: (grnWrapper.clientWidth || self._lastWrapperSize.w)-SCROLL_BAR_SIZE,h: (grnWrapper.clientHeight || self._lastWrapperSize.h)-SCROLL_BAR_SIZE},
	    			"OPTIMAL_SELECTED",
	    			self.zoomStates_
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
		
		////////// Model/Node zooming //////////
		zoomToWholeGroupNode: function() {
			var self=this;

			this._canvasReady.promise.then(function(){
				var grnWrapper = dom.byId(self._cnvWrapperNodeId);
				self.zoomTo_(self._zoomController.getClosestZoomValue(GROUP_NODE_ZOOM));
			},function(err){
				console.error(ErrMsgs.CanvasReadyErr + " zoom to group node!");
			});
		},
		zoomToWholeModel: function() {
			var self=this;
			this._canvasReady.promise.then(function(){
				var grnWrapper = dom.byId(self._cnvWrapperNodeId);
				self.zoomTo_(self._zoomController.getOptimalZoom(
	    			{w: self.currentModel_.drawingObject_.model_w, h: self.currentModel_.drawingObject_.model_h},
	    			{w: (grnWrapper.clientWidth || self._lastWrapperSize.w)-SCROLL_BAR_SIZE,h: (grnWrapper.clientHeight || self._lastWrapperSize.h)-SCROLL_BAR_SIZE},
	    			"OPTIMAL_WHOLE_MODEL",
	    			self.zoomStates_
				));
				
				self._scrollToWorldPoint({
					x: self.currentModel_.drawingObject_.model_x+(self.currentModel_.drawingObject_.model_w/2), 
					y: self.currentModel_.drawingObject_.model_y+(self.currentModel_.drawingObject_.model_h/2)
				});
			},function(err){
				console.error(ErrMsgs.CanvasReadyErr + " zoom to whole model!");
			});
		},
		zoomToAllModels: function(bounds) {
			var self=this;
			this._canvasReady.promise.then(function(){
				var grnWrapper = dom.byId(self._cnvWrapperNodeId);
				self.zoomTo_(self._zoomController.getOptimalZoom(
	    			{w: Math.abs(bounds.max_x-bounds.min_x), h: Math.abs(bounds.max_y-bounds.min_y)},
	    			{w: (grnWrapper.clientWidth || self._lastWrapperSize.w)-SCROLL_BAR_SIZE,h: (grnWrapper.clientHeight || self._lastWrapperSize.h)-SCROLL_BAR_SIZE},
	    			"OPTIMAL_WHOLE_MODEL",
	    			self.zoomStates_
				));
				
				self._scrollToWorldPoint({
					x: bounds.center_x, 
					y: bounds.center_y
				});			
			},function(err){
				console.error(ErrMsgs.CanvasReadyErr + " zoom to all models!");
			});
		},
		
		zoomToWholeWorkspace: function() {
			var self=this;
			this._canvasReady.promise.then(function(){
				var grnWrapper = dom.byId(self._cnvWrapperNodeId);
				self.zoomTo_(self._zoomController.getOptimalZoom(
	    			{w: self._workspaceDimensions.width, h: self._workspaceDimensions.height},
	    			{w: (grnWrapper.clientWidth || self._lastWrapperSize.w)-SCROLL_BAR_SIZE,h: (grnWrapper.clientHeight || self._lastWrapperSize.h)-SCROLL_BAR_SIZE},
	    			"WORKSPACE",
	    			self.zoomStates_
				));
			},function(err){
				console.error(ErrMsgs.CanvasReadyErr + " zoom to whole workspace!");
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
				var nodeBounds = canvasRenderer.getBoundsForIntersection(self._currentModelId(),thisNode);
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
        			if(self.currentModel_) {
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
			var grnWrapper = dom.byId(this._cnvWrapperNodeId);
			
            // Squelch all default context menuing on the DIV container for the 
            // canvas and on the scrolling system containers
            this.own(on(grn,"contextmenu",function(e){e.preventDefault();}));
            
            this._buildMouseHandlers();            
						
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
	    		require(["controllers/ArtboardController","views"],function(ArtboardController,BTViews){
	    			var myAbC = ArtboardController.getArtboardController(self._cnvContainerNodeId);
	    			// Set the optimal zoom as the beginning zoom level, then, check for an initial mode, and if it's provided use it
	    			// (otherwise we'll ignore it).
	    			if(!self.currentModel_.isGroupNode()) {
		            	self._currentZoomLevel = self._zoomController.getOptimalZoom(
	            			{w: self.currentModel_.drawingObject_.model_w, h: self.currentModel_.drawingObject_.model_h},
	            			{w: (grnWrapper.clientWidth || self._lastWrapperSize.w)-SCROLL_BAR_SIZE,h: (grnWrapper.clientHeight || self._lastWrapperSize.h)-SCROLL_BAR_SIZE},
	            			"OPTIMAL_WHOLE_MODEL",
	            			self.zoomStates_
	        			);
	    			}
            		self._disableScrolling();
            		
            		var firstDraw = function(){
            			if(grnWrapper.clientWidth) {
            				self._lastWrapperSize.w = grnWrapper.clientWidth;
            				self._lastWrapperSize.h = grnWrapper.clientHeight;
            			}
            			
        				// Because there might have been a resizing of the container which holds the canvas, make the offCanvas now,
        				// and force a toggle and swap to ensure they're both the same size to start with. This way, any draws will
        				// be done with the canvases synced up.
        				if(!self._offCanvas) {
        					self._makeOffCanvas();	
        					self._toggleCanvas();
        					self._swapCanvas();
        	    		}

                		self._redraw(null,false,null,myAbC.get("initialZoomMode_"),myAbC.get("completeModelBounds_")).then(function(){
            				self._canvasReady.resolve();
            				self._canvasIsReady = true;
            	            self._makeResizingAspect();
                		},function(err){
                			console.warn("[WARNING] Redraw rejected during Canvas setup!");
                			if(self._canvasIsReady) {
                				self._canvasIsReady = true;
                	            self._makeResizingAspect();
                			}
                		});
        				
        			};
        			if(self._isPrimaryCanvas) {
                		BTViews.getTreeResize(myAbC.get("tabId_")).then(firstDraw);
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
            	var myAbC = ArtboardController.getArtboardController(self._cnvContainerNodeId);
		    	self.watchers_["model"] = myAbC.setWatch("currentModel_",function(name,oldVal,newVal){
		    		if(self._drawEventsGo) {
			    		require(["views"],function(BTViews){
			    			var redrawAndReady = function() {
			    				var myAbC = ArtboardController.getArtboardController(self._cnvContainerNodeId);
	            				self._redraw(newVal,true,null,myAbC.get("navZoomMode_")).then(function(){
	            					// If this is a redraw in response to a reload (from a session expiring or a new model), then
	            					// the Canvas will have been flagged unready and should be re-readied.
	            					if(!self._canvasIsReady) {
	            						self._canvasIsReady = true;
	                    				self._canvasReady.resolve();
	            					}
	            				},function(err){
	            					if(self._canvasIsReady) {
	            						self._canvasIsReady = false;
	            						self._canvasReady.reject();
	            					}
	            				});
			    			};
			    			if(self._isPrimaryCanvas) {
			    				BTViews.getTreeResize(myAbC.get("tabId_")).then(redrawAndReady);
			    			} else {
	            				redrawAndReady();
			    			}
			    		});
		    		}
				});
		    	self.own(self.watchers_["model"]);
		    	self.watchers_["overlay"] = ArtboardController.getArtboardController(self._cnvContainerNodeId).setWatch("overlay_",function(name,oldVal,newVal){
		    		if(self._drawEventsGo) {
		    			self.currentModel_ && self._redraw(self.currentModel_.get("modelId_"));
		    		}
				});
		    	self.own(self.watchers_["overlay"]);
		    	self.watchers_["toggledRegions"] = ArtboardController.getArtboardController(self._cnvContainerNodeId).setWatch("toggledRegions_",function(name,oldVal,newVal){
		    		if(self._drawEventsGo) {
		    			self.currentModel_ && self._redraw(self.currentModel_.get("modelId_"));
		    		}
				});
		    	self.own(self.watchers_["toggledRegions"]);			    	
		    	
			},function(err){
				console.error(ErrMsgs.CanvasReadyErr + " setup!");
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
			this._workspaceDimensions = {width: params.wsWidth, height: params.wsHeight};
			this._drawEventsGo = true;
			this._bufferedCanvases = !!params.bufferedCanvases;
			this._cnvContainerNodeId = params.cnvContainerDomNodeId;
			this._cnvWrapperNodeId = params.cnvWrapperDomNodeId;
			this._willDrawWorkspace = params.drawWorkspace;
			this.id_ = params.id;
			this.watchers_ = {};
			this._scrollHandlers = {
				scrollv: {
					enabled: false,
					th: null,
					db: null
				},
				scrollh: {
					enabled: false,
					th: null,
					db: null
				}
			};
			this.zoomStates_ = params.zoomStates;
			this._zoomController = new ZoomController(DEFAULT_ZOOM_LEVEL);
			this._currentZoomLevel = this._zoomController.getDefaultZoom(); 
			this.actionClickPending_ = false;
			this._isPrimaryCanvas = !!params.primaryCanvas;
			
			// Top-level object for easy access to the mouse's current situation during event handling
			this._mouseStatus = new MouseStatus({});
			
			this._mouseHandlers = new MouseHandlers({});
			this._selexBox = new SelexBox({});
			this._tooltip = new BTTooltip({});
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
			_btCanvases[containerDomNodeId]._actionClickPending(isPending);
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
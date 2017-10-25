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
    "dojo/dom",
    "dojo/domReady!"
],function(
	dom
){
	
	return declare([],{
			
		scrollHandlers_: null,
		
		
		/**
		 * Set up the vertical virtual scroll element.
		 * 
		 * 
		 * 
		 * @param zoomScale
		 */
		_initScrollV: function(params) {
			var scrollv = dom.byId("scrollv_" + params.cnvContainerNodeId_);
			var self=this;
			
        	scrollv.scrollTop = Math.round(((params.workspaceDimensions_.height*params.zoomScale)-params.canvas_.height)/2);
        	
        	this.scrollHandlers_.scrollv=on(scrollv,"scroll",function(e) {
        		if(self.rendererIsValid_) {
        			self._drawCanvas();
        		}
        	});
        	
        	if(!this.scrollHandlers_.dragToScroll) {
        		this._initDragToScroll();
        	}
		},

		/**
		 * Set up the horizontal virtual scroll element.
		 * 
		 * 
		 * 
		 * @param zoomScale
		 */
		_initScrollH: function(params) {
			
			var scrollh = dom.byId("scrollh_" + params.cnvContainerNodeId_);
			var self=this;
			
        	scrollh.scrollLeft = Math.round(((params.workspaceDimensions_.width*zoomScale)-params.canvas_.width)/2);
        	
        	this.scrollHandlers_.scrollh=on(scrollh,"scroll",function(e) {
        		if(self.rendererIsValid_) {
        			self._drawCanvas();
        		}
        	});
        	if(!this.scrollHandlers_.dragToScroll) {
        		this._initDragToScroll();
        	}
		},

		/**
		 * Disable the horizontal scroll element's event
		 * 
		 * 
		 */
		_disableScrollH: function() {
			if(this.scrollHandlers_.scrollh) {
				this.scrollHandlers_.scrollh.remove();
				this.scrollHandlers_.scrollh = null;
			}
			if(!this.scrollHandlers_.scrollv) {
				this._disableDragToScroll();
			}
		},
		
		/**
		 * Disable the vertical scroll element's event
		 * 
		 * 
		 */
		_disableScrollV: function() {
			if(this.scrollHandlers_.scrollv) {
				this.scrollHandlers_.scrollv.remove();
				this.scrollHandlers_.scrollv = null;
			}
			if(!this.scrollHandlers_.scrollh) {
				this._disableDragToScroll();
			}			
		},
		
		
		constructor: function(workspaceDimensions,canvas) {
			
			var scrollHandlers_ = null;
			
			var handlerScrollH_ = null;
			var handlerScrollV_ = null;
			
			var workspaceDimensions_ = workspaceDimensions;
			var canvas_ = canvas;

			this.disableScrollV = function() {
				handlerScrollV_.remove();
			};
			
			this.disableScrollH = function() {
				handlerScrollH_.remove();
			};
			
			this.initScrollV = function(zoomScale,scrollCallback) {
				var scrollv = dom.byId("scrollv");
				
	        	scrollv.scrollTop = Math.round(((workspaceDimensions_.height*zoomScale)-canvas_.height)/2);
	        	
	        	console.debug("Init scroll v: " + scrollv.scrollTop);
	        	
	        	handlerScrollV_=on(scrollv,"scroll",function() {
					scrollCallback();        		
	        	});
			};
			
			this.initScrollH = function(zoomScale,scrollCallback) {
				var scrollh = dom.byId("scrollh");
				
	        	scrollh.scrollLeft = Math.round(((workspaceDimensions_.width*zoomScale)-canvas_.width)/2);
	        	
	        	console.debug("Init scroll h: " + scrollh.scrollLeft);
	        	
	        	handlerScrollH_=on(scrollh,"scroll",function() {
					scrollCallback();        		
	        	});				
			};
			
			this.disableScrolling = function() {
				this.disableScrollH();
				this.disableScrollV();
			};
			
			this.isScrollEnabledH = function() {
				return (handlerScrollH_ !== null);
			};

			this.isScrollEnabledV = function() {
				return (handlerScrollV_ !== null);
			};
			
			this.initScrolling = function(zoomScale,scrollCallback) {
				this.initScrollV(zoomScale,scrollCallback);
				this.initScrollH(zoomScale,scrollCallback);
			};
		}
	});
});
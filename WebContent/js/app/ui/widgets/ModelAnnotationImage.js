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
	"static/XhrUris",
	"app/utils",
	"dijit/layout/ContentPane",
    "dojo/dom-construct",
    "dojo/dom-style",
    "dojo/dom",
    "dojo/on",
    "dojo/domReady!"
],function(
	XhrUris,
	utils,
	ContentPane,
	domConstruct,
	domStyle,
	dom,
	on
) {

	// Disabling DOM element
	var disablingOverlay_;
	
	var imgPane_ = null;
	var imgPaneLastSize_ = null;
	var enabled_ = false;
	var loaded_ = false;
	
	var images_ = {
			
	};
	
	var currImgNode_ = null;
	
	var DEFAULT_REGION = "bottom";
	
	var PREFERRED_PANE_HEIGHT = 205;
	var IMG_MAX_HEIGHT = 200;
	var IMG_MAX_WIDTH = 200;
	
	function calculateImgSize(thisImg) {
		require(["dojo/dom-style"],function(domStyle){
			// Don't run this calculation if the original image sizing is not available
			// (this will also fail on the sizes being 0 but that's fine)
			if(images_[thisImg].imgHeight && images_[thisImg].imgWidth) {
				if(images_[thisImg].imgHeight < IMG_MAX_HEIGHT && images_[thisImg].imgWidth < IMG_MAX_WIDTH) {
					domStyle.set(images_[thisImg].node,"margin",(Math.abs(images_[thisImg].node.height-IMG_MAX_HEIGHT)/2)+"px auto auto");				
				} else {
					if(images_[thisImg].imgHeight/IMG_MAX_HEIGHT > images_[thisImg].imgWidth/IMG_MAX_WIDTH) {
						images_[thisImg].node.height = IMG_MAX_HEIGHT;
						domStyle.set(images_[thisImg].node,"margin","auto");
					} else {
						images_[thisImg].node.width = IMG_MAX_WIDTH;
						domStyle.set(images_[thisImg].node,"margin",(Math.abs(images_[thisImg].node.height-IMG_MAX_HEIGHT)/2)+"px auto auto");
					}
				}
			}
		});		
	};
	
	return {
		load: function(params) {
			
			var region = (params && params.region) ? params.region : DEFAULT_REGION; 
						
			if(!imgPane_) {
				imgPane_ = new ContentPane({
					id: "annotimg_pane",
					region: region
				});
			}
			
			if(!disablingOverlay_) {
				disablingOverlay_ = domConstruct.create("div",{id: "annotimg_pane_disabling","class": "DisablingOverlay"},imgPane_.domNode,"first");
			} else {
				domStyle.set(disablingOverlay_,"display","none");
			}
			
			if(params) {
				var prevImgNode = currImgNode_;
				currImgNode_ = params.modelId;
				
				if(!images_[currImgNode_]) {
					images_[currImgNode_] = {};
					images_[currImgNode_].node = domConstruct.create(
						"img",
						{id: "modelannotimg_" + utils.makeId(), "class":"ModelAnnotImg"}
					);
					
					on(images_[currImgNode_].node,"load",function(e){
						
						images_[currImgNode_].imgHeight = images_[currImgNode_].node.height; 
						images_[currImgNode_].imgWidth = images_[currImgNode_].node.width;
						
						currImgNode_ && calculateImgSize(currImgNode_);
					});
					
					images_[currImgNode_].node.src= XhrUris.modelannotimg + currImgNode_;				
				}
				
				require(["dojo/aspect"],function(aspect){
					aspect.after(imgPane_,"resize",function(e){
						IMG_MAX_WIDTH = imgPane_.domNode.clientWidth;
						if(!imgPaneLastSize_ || (imgPaneLastSize_.w !== imgPane_.domNode.clientWidth) || (imgPaneLastSize_.h !== imgPane_.domNode.clientHeight)) {
							if(!imgPaneLastSize_) {
								imgPaneLastSize_ = {};
							}
							imgPaneLastSize_.w = imgPane_.domNode.clientWidth;
							imgPaneLastSize_.h = imgPane_.domNode.clientHeight;

							currImgNode_ && calculateImgSize(currImgNode_);
						}
					});				
				});
				
				domConstruct.place(images_[currImgNode_].node,imgPane_.domNode.firstChild,"replace");
			}

		    enabled_ = true;
		    loaded_ = true;

		    return imgPane_;
		},

		isLoaded: function() {
			return loaded_;
		},
		
		remove: function() {
			domConstruct.empty(imgPane_.domNode);
			currImgNode_ = null;
			enabled_ = false;
			loaded_ = false;
		},

		isEnabled: function() {
			return enabled_;
		},
		
		prefHeight: function() {
			return PREFERRED_PANE_HEIGHT;
		},
		
		resize: function(newSize) {
			if(!newSize) {
				newSize = {h: PREFERRED_PANE_HEIGHT};
			}
			imgPane_ && imgPane_.resize(newSize);
		},
		
		start: function() {

		},
		
		disable: function() {
			if(imgPane_.domNode.firstChild) {
				domConstruct.place(disablingOverlay_,imgPane_.domNode.firstChild,"replace");
			} else {
				domConstruct.place(disablingOverlay_,imgPane_.domNode,"first");	
			}
			domStyle.set(disablingOverlay_,"display","block");
			enabled_ = false;
		},
		
		enable: function() {
			domConstruct.place(images_[currImgNode_].node,imgPane_.domNode.firstChild,"replace");
			domStyle.set(disablingOverlay_,"display","none");
			enabled_ = true;
		}
	};	
});
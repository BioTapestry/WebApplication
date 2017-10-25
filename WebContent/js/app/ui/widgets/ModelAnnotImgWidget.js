define([
    "dojo/_base/declare",
	"dijit/layout/ContentPane",
	"dojo/_base/array",
    "dojo/dom-construct",
    "dojo/on",
    "app/utils",
	"static/XhrUris"
],function(
	declare,
	ContentPane,
	DojoArray,
	domConstruct,
	on,
	utils,
	XhrUris
){

	///////////////////////////////////////////////
	// ModelAnnotImgWidget
	///////////////////////////////////////////////
	//
	// An extended content pane which displays an img node when a model contains
	// a model annotation image. 
	
	var DEFAULT_REGION = "bottom";
	
	var PREFERRED_PANE_HEIGHT = 205;
	var IMG_MAX_HEIGHT = 200;
	var IMG_MAX_WIDTH = 200;
	var MAX_ANNOT_IMGS = 10;
	
	
	return declare([ContentPane],{
		// When there is no image to display, we show this node instead
		_disablingOverlay: null,
		
		// Our img nodes; we store up to MAX_ANNOT_IMGS (for memory management purposes)
		_annotImgs: null,
		
		// To help us check for actual changes in pane size ('resize' is often emitted when no
		// actual resizing has occurred)
		_imgPaneLastSize: null,
		
		// The tab index of the controller that spawned you
		_index: null,
		
		currImg: null,
		disabled: null,		
		
		resize: function(newSize) {
			if(!newSize) {
				newSize = {};
			}
			newSize.h = PREFERRED_PANE_HEIGHT;
			this.inherited(arguments);
		},
		
		prefHeight: function() {
			return PREFERRED_PANE_HEIGHT;
		},
		
		_setDisabledAttr: function(val){
			var self=this;
			require(["dojo/dom-style"],function(domStyle){
				if(val) {
					if(self.domNode.firstChild) {
						domConstruct.place(self._disablingOverlay,self.domNode.firstChild,"replace");
					} else {
						domConstruct.place(self._disablingOverlay,self.domNode,"first");	
					}	
				} else {
					domConstruct.place(self._annotImgs[self.currImg].node,self.domNode.firstChild,"replace");
				}
				domStyle.set(self._disablingOverlay,"display",val ? "block" : "none");
			});
		},
		
		_setCurrImgAttr: function(val) {
			var self=this;
			if(!val) {
				this.set("disabled",true);
				return;
			}
			if(!this._annotImgs[val]) {
				if(Object.keys(this._annotImgs).length >= MAX_ANNOT_IMGS) {
					// We're at or past our max allowed annotation image set 
					// so remove one before adding this one
					delete this._annotImgs[Object.keys(this._annotImgs)[0]];
				}
				this._annotImgs[val] = {};
				this._annotImgs[val].node = domConstruct.create(
					"img",
					{id: "img_" + this.id, "class":"ModelAnnotImg"}
				);
				
				this.own(on(this._annotImgs[val].node,"load",function(e){
					
					self._annotImgs[val].imgHeight = self._annotImgs[val].node.height; 
					self._annotImgs[val].imgWidth = self._annotImgs[val].node.width;
					
					val && self._calculateImgSize(val);
				}));
				
				self._annotImgs[val].node.src = XhrUris.modelannotimg(val,self._index);
			}
			if(!this.domNode.firstChild) {
				domConstruct.place(this._annotImgs[val].node,this.domNode,"first");
			} else {
				domConstruct.place(this._annotImgs[val].node,this.domNode.firstChild,"replace");	
			}
		},

		_calculateImgSize: function(thisImg) {
			var self=this;
			require(["dojo/dom-style"],function(domStyle){
				// Don't run this calculation if the original image sizing is not available
				// (this will also fail on the sizes being 0 but that's fine)
				var annotImg = self._annotImgs[thisImg];
				if(annotImg.imgHeight && annotImg.imgWidth) {
					if(annotImg.imgHeight < IMG_MAX_HEIGHT && annotImg.imgWidth < IMG_MAX_WIDTH) {
						domStyle.set(annotImg.node,"margin",(Math.abs(annotImg.node.height-IMG_MAX_HEIGHT)/2)+"px auto auto");				
					} else {
						if(annotImg.imgHeight/IMG_MAX_HEIGHT > annotImg.imgWidth/IMG_MAX_WIDTH) {
							annotImg.node.height = IMG_MAX_HEIGHT;
							domStyle.set(annotImg.node,"margin","auto");
						} else {
							annotImg.node.width = IMG_MAX_WIDTH;
							domStyle.set(annotImg.node,"margin",(Math.abs(annotImg.node.height-IMG_MAX_HEIGHT)/2)+"px auto auto");
						}
					}
				}
			});		
		},

		remove: function() {
			var self=this;
			DojoArray.forEach(Object.keys(this._annotImgs),function(annotImg){
				domConstruct.destroy(self._annotImgs[annotImg].node);
				delete self._annotImgs[annotImg];
			});
			domConstruct.destroy(this._disablingOverlay);
			this.destroyRecursive();
		},
		
		postCreate: function() {
			var self=this;
			this.inherited(arguments);
						
			this._disablingOverlay = domConstruct.create("div",{id: "disabling_"+this.id,"class": "DisablingOverlay"},this.domNode,"first");
			
			require(["dojo/aspect"],function(aspect){
				self.own(aspect.after(self,"resize",function(e){
					IMG_MAX_WIDTH = self.domNode.clientWidth;
					if(!self._imgPaneLastSize || (self._imgPaneLastSize.w !== self.domNode.clientWidth) || (self._imgPaneLastSize.h !== self.domNode.clientHeight)) {
						if(!self._imgPaneLastSize) {
							self._imgPaneLastSize = {};
						}
						self._imgPaneLastSize.w = self.domNode.clientWidth;
						self._imgPaneLastSize.h = self.domNode.clientHeight;

						self.currImg && self._calculateImgSize(self.currImg);
					}
				}));
				self.set("currImg",self.currImg);
			});
		},
		
		constructor: function(params) {
			params.id = "annotimg_pane_"+(params.id || utils.makeId());
			params.region = (params.region || DEFAULT_REGION);
			params["class"] = "AnnotImgPane";
			this.currImg = params.modelId;
			this._index = params.index;
			this._annotImgs = {};
			this.inherited(arguments);
		}
	});
	
	
	
});
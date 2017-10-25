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
    "dojo/_base/declare",
    "dijit/Tree",
    "dojo/Deferred",
    "dojo/store/Memory",
    "dojo/store/Observable",
    "dijit/tree/ObjectStoreModel",
    "dojo/on",
    "dojo/dom-style",
    "dojo/dom-construct",
    "app/utils"
],function(
	declare,
	Tree,
	Deferred,
	Memory,
	Observable,
	ObjectStoreModel,
	on,
	domStyle,
	domConstruct,
	utils
) {
	
	// We define an 'empty tree' for initial Editor loading
	var EMPTY_TREE = {
		root: {
			hasImage: false,
			hasOverlays: false,
			modelType: "SUPER_ROOT",
			name: "",
			nodeKey: {modType:"SUPER_ROOT"},
			modType: "SUPER_ROOT",
			childNodes: [{
				ID: "bioTapA",
				childNodes: [],
				hasImage: false,
				hasOverlays: false,
				modelType: "DB_GENOME",
				name: "Full Genome",
				nodeKey: {id:"bioTapA", modType:"DB_GENOME"},
				overlayDefs: []
			}],
			overlayDefs: []
		}	
	};
	
	// The action from ActionCollection which will trigger
	// whenever the currently selected tree node is changed
	var ONCHANGE_ACTION = "CLIENT_SET_MODEL";
	
	////////////////////////
	// _buildModelStore
	///////////////////////
	//
	// Given a data object, construct an ObjectStoreModel which can be used by this Tree. This
	// does NOT set the resulting ObjectStoreModel as the store; that must be performed separately
	//
	function _buildModelStore(data) {
		if(!data) {
			data = EMPTY_TREE;
		}
		var treeStore = new Memory({
			data: [{ID: "root", childNodes: data.root.childNodes}],
	        getChildren: function(object){
	        	return(object.childNodes || []);
	        },
	        getIdentity: function(item) {
	        	return item.ID;
	        }
		});
		
		treeStore = new Observable(treeStore);					
		
		var treeModel = new ObjectStoreModel({
			store: treeStore,
	        query: {ID: 'root'},
	        mayHaveChildren: function(item) {
	        	return (item.childNodes && item.childNodes.length > 0);
	        }
	    });
		
		return treeModel;
	};
	
	///////////////////////////////////
	// ModelTree
	//////////////////////////////////
	//
	// Extension of dijit/Tree:
	// 
	// - Event emitted when _adjustWidths is called
	// - Method for being set disabled which will render the tree unclickable
	// - Refresh method which will reload the tree with new data
	// - Work-arounds for node selection/clicking bug
	// - Special resizing event to ensure the tree isn't initially scrolled in the horizontal direction
	//
	return declare([Tree],{
		_tabId: null,
		// Mark a right-clicked node for later use
		_rightClickedNode: null,
		// DIV to disable the tree in cases of masking
		_disablingOverlay: null,
		// Deferred indicating if the tree is done resizing
		_resizeDeferred: null,
		// Deferred indicating if the tree is done being loaded
		_asyncLoadTree: null,
		
		disabled: null,
		
		_adjustWidths: function() {
			this.inherited(arguments);
			this.emit("widthsadjusted",{cancelable: true, bubbles: true});
		},

		_setDisabledAttr: function(val) {
			domStyle.set(this._disablingOverlay,"display",val ? "block" : "none");
			this.disabled = val;
		},
		
		////////////////////////
		// refresh
		///////////////////////
		//
		// Delete the current tree contents and rebuild it from the data source
		//
		refresh: function(data){
			var self=this;
			this._resizeDeferred = new Deferred();
			// We need to resize the container that holds the model tree any time the
			// tree is rebuilt, because otherwise the tree will simply overflow. We
			// do this only once, after reloading is completed.
			self.own(
				on.once(self,"widthsadjusted",function(e){
					require(["dojo/query","views"],function(query,BTViews){
						var containerNode = query(".dijitTreeContainer",this.id)[0];
						self.treeRenderWidth = containerNode.clientWidth+10+(self.domNode.scrollHeight > self.domNode.clientHeight ? 15 : 0);
						BTViews.resizeLeftContainer({w: self.treeRenderWidth+10},self._tabId);
						self._resizeDeferred.resolve();
					});
				})
	    	);
			self.dndController.selectNone();
			
			// If our store is JsonRest, close it so the model
			// will call fetch() when we reload it.
			//
			// this.model.store.clearOnClose = true;
		    // this.model.store.close();
		    
		    // Remove all nodes and their children
		    delete self._itemNodesMap;
		    self._itemNodesMap = {};
		    self.rootNode.state = "UNCHECKED";
		    delete self.model.root.childNodes;
		    self.model.root.childNodes = null;
		    self.rootNode.destroyRecursive();
		    
		    self.model = _buildModelStore(data);
		    self.postMixInProperties();
		    self._load();
		},
		
		///////////////////////
		// selectNodeOnTree
		//////////////////////
		//
		//
		selectNodeOnTree: function(modelId) {
			var self=this;
			var selectAsync = new Deferred();
			this._asyncLoadedTree.promise.then(function(){
				var thisNode = self.getNodesByItem(modelId)[0];
				self.focusNode(thisNode);
				self._setSelectedItemAttr(modelId);
				selectAsync.resolve();
			});
			return selectAsync.promise;
		},
		
		////////////
		// getRoot
		///////////
		//
		//
		getRoot: function() {
			return this.model.root.childNodes[0].ID;
		},
	
		getResizeDeferred: function() {
			return this._resizeDeferred.promise;
        },

		postCreate: function() {
			var self=this;
			this.inherited(arguments);
			this._disablingOverlay = domConstruct.create("div",{
				id: "modeltree_disabling_"+this.id,
				style: "display: none;",
				"class":"DisablingOverlay"
			},self.domNode,"first");
			
			// The ModelTree does not support multiple selection
			this.dndController.singular = true;
			
			// Auto-widen the left container after we're done loading the ModelTree, so it will
			// not be scrolled; we want to only do this once.
			this.own(
				on.once(self,"load",function(e){
					require(["dojo/query","dojo/dom-style","views"],function(query,domStyle,BTViews){
						var containerNode = query(".dijitTreeContainer",this.id)[0];
						self.treeRenderWidth = containerNode.clientWidth+10+(self.domNode.scrollHeight > self.domNode.clientHeight ? 15 : 0);
						BTViews.resizeLeftContainer({w: self.treeRenderWidth},self._tabId);
						self._resizeDeferred.resolve();
					});
				})
	    	);	
			
			self._asyncLoadedTree.resolve();
		},
		
		//////////////
		// maskTree
		/////////////
		//
		// Mask (disable) the tree
		maskTree: function(maskOn) {
			var self=this;
			self._asyncLoadedTree.promise.then(function(){
				self.set("disabled",!!maskOn);
			});
		},
		
		constructor: function(params) {
			
			params.id = "modeltree_"+(params.id || utils.makeId());
			
	        params.showRoot = false;
	        params.style = "overflow: auto;";
	        params.openOnClick = false;
	        
	        // Sometimes a click event will fail when a node press will not.
	        // We don't want both click and nodepress to both fire, however, because
	        // that could cause multiple model sets. For now, bind to node press
	        // and not click.
	        /*
	        params.onClick = function(item,node,event) {
	        	console.debug("onclick for tree",item,node,event);
	        	if(!this.disabled && !this.nodePressed) {
	        		treeController.modelTreeOnClick(item);
	        	}
	        },
	        */
	        params._onNodePress = function(nodeWidget,e) {
	        	if(!this.disabled) {
	    			if(nodeWidget && nodeWidget.item && nodeWidget.item.ID) {
	    				require(["controllers/ActionCollection"],function(ActionCollection){
	    					ActionCollection[ONCHANGE_ACTION]({modelId: nodeWidget.item.ID});	
	    				});
	    			}
	        	}
	        };
	        params.getIconClass = function(item,opened){
	            return ((item.childNodes && (item.childNodes.length > 0)) ? 
            		(opened ? "dijitFolderOpened" : "dijitFolderClosed") : "dijitLeaf");
	        };
	        params.treeRenderWidth = 0;

	        params.autoExpand = true;
	        
	        params.model = _buildModelStore(params.rawTreeData);
			
			this._tabId = params.tabId || "0";
			
			this._resizeDeferred = new Deferred();
												
			this._asyncLoadedTree = new Deferred();
			
			this.disabled = false;
	        
			// super()
			this.inherited(arguments);
		}
	});
});  // define 
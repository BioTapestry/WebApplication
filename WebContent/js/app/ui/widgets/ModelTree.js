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
    "dojo/_base/lang",
    "dojo/_base/declare",
    "dojo/mouse",
    "dojo/dom",
    "dijit/Tree",
    "dijit/Menu",
    "dijit/MenuItem",
    "dojo/Deferred",
    "dojo/on",
    "controllers/ModelTreeController"
],function(
	lang,
	declare,
	Mouse,
	dom,
	Tree,
	Menu,
	MenuItem,
	Deferred,
	on,
	treeController
) {
	
	///////////////////////////////////
	// ModelTree
	//////////////////////////////////
	//
	// Wrapper with an extension of dijit/Tree which emits a special event when _adjustWidths is called.
	
	return declare([],{
				
		constructor: function() {
			
			////////////////////// PRIVATE MEMBERS ///////////////////////
			
			var resizeDeferred = new Deferred();
												
			var treeContextMenu,modelHierarchyTree,treeModel,treeDisablingOverlay;
			
			var asyncLoadedTree = null;
			
			var modelTree = declare([Tree],{
				_adjustWidths: function() {
					this.inherited(arguments);
					this.emit("treeload",{cancelable: true, bubbles: true});
				}
			});

			var loadTree = function() {
				asyncLoadedTree = new Deferred();
				treeController.getModel().then(function(modelForTree){
					treeModel = modelForTree;
					modelHierarchyTree = new modelTree({
						model: modelForTree,
						id: "ModelTree",
				        showRoot: false,
				        style: "overflow: auto;",
				        openOnClick: false,
				        // Sometimes a click event will fail when a node press will not.
				        // We don't want both click and nodepress to both fire, however, because
				        // that could cause multiple model sets. For now, bind to node press
				        // and not click.
				        /*
				        onClick: function(item,node,event) {
				        	console.debug("onclick for tree",item,node,event);
				        	if(!this.disabled && !this.nodePressed) {
				        		treeController.modelTreeOnClick(item);
				        	}
				        },
				        */
				        _onNodePress: function(nodeWidget,e) {
				        	if(!this.disabled) {
				        		treeController.modelTreeOnClick(nodeWidget.item);
				        	}
				        },
				        getIconClass: function(item,opened){
				            return ((item.childNodes && (item.childNodes.length > 0)) ? 
			            		(opened ? "dijitFolderOpened" : 
			            		"dijitFolderClosed") : "dijitLeaf");
				        },
				        getResizeDeferred: function() {
							return resizeDeferred.promise;
				        },
				        treeRenderWidth: 0,
						refresh: function(){
							var self=this;
							resizeDeferred = new Deferred();
							var refreshAsync = new Deferred();
							// We need to resize the container that holds the model tree any time the
							// tree is rebuilt, because otherwise the tree will simply overflow. We
							// do this only once, after reloading is completed.
							require(["dojo/query","dojo/dom-style","views"],function(query,domStyle,BTViews){
								self.own(
									on.once(self,"treeload",function(e){
										modelHierarchyTree.treeRenderWidth = query(".dijitTreeContainer","ModelTree")[0].clientWidth;
										BTViews.resizeLeftContainer({w: modelHierarchyTree.treeRenderWidth+10});
										console.debug("done resizing");
										resizeDeferred.resolve();
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
							    
							    treeController.reloadModel().then(function(modelForTree){
								    self.model = modelForTree;
								    self.postMixInProperties();
								    self._load();
								    refreshAsync.resolve();
							    });
							});
							return refreshAsync.promise;
						},
						autoExpand: true
					});
					
					modelHierarchyTree.dndController.singular = true;
										
					// Auto-widen the left container after we're done loading the ModelTree, so it will
					// not be scrolled; we want to only do this once.
					modelHierarchyTree.own(
						on.once(modelHierarchyTree,"load",function(e){
							require(["dojo/query","dojo/dom-style","views","dojo/dom-construct"],function(query,domStyle,BTViews,domConstruct){								
								if(!treeDisablingOverlay) {
									treeDisablingOverlay = domConstruct.create("div",
										{
											id: "modeltree_disabling",
											style: "display: none;",
											"class":"DisablingOverlay"
										},modelHierarchyTree.domNode,"first"
									);
								}
								modelHierarchyTree.treeRenderWidth = query(".dijitTreeContainer","ModelTree")[0].clientWidth;
								BTViews.resizeLeftContainer({w: modelHierarchyTree.treeRenderWidth+10});
								console.debug("done resizing");
								resizeDeferred.resolve();
							});
						})
			    	);	
					asyncLoadedTree.resolve(modelHierarchyTree);
				},function(err){
					console.error("[ERROR] During tree load: " + err);
				});
			};
			
			////////////////////// PRIVILEGED MEMBERS ///////////////////////
			
			this.maskTree = function(maskOn) {
				asyncLoadedTree.promise.then(function(tree){
					require(["dojo/dom-style"],function(domStyle){
						tree.set("disabled",!!maskOn);
						treeDisablingOverlay && domStyle.set(treeDisablingOverlay,"display",maskOn ? "block" : "none");
					});
				});
			};
		    
		    this.getModelHierarchyTree = function() {
		    	if(!asyncLoadedTree) {
		    		loadTree();
		    	}
		    	return asyncLoadedTree.promise;
		    };
		    
		    this.setTreeWidget = function() {
		    	treeController.setTreeWidget(modelHierarchyTree);
		    };
		} // constructor
	});  // declare
});  // define 
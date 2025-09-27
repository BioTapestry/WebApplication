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
    "dojo/_base/declare",
    "dojo/Deferred",
    "models/ModelHierarchyStore",
    "static/XhrUris",
	"dojo/domReady!"
],function(
	declare,
	Deferred,
	ModelHierarchyStore,
	XhrUris
){
	
	var modelHierarchyStore = new ModelHierarchyStore();
	
	var treeWidget,rightClickedNode;
	
	var treeLoaderDeferred = new Deferred();
	
	var ONCHANGE_ACTION = "CLIENT_SET_MODEL";

//////////////////////////////////////////////////
// Module Interface
//////////////////////////////////////////////////
	
	return {
		
		changeNode: function(item) {
			// This would actually do a server POST followed by
			// a tree refresh
			modelHierarchyStore.change(item,{id: item.id, overwrite: true});
		},
	
		addNode: function(item,parentItem) {
			// This would actually do a server POST followed by
			// a tree refresh
			modelHierarchyStore.put(item,{overwrite: false,parent: parentItem});
		},
    
		insertSubmodel: function(modelName) {
			if(!rightClickedNode) {
				return false;
			}
			var item = {name: modelName, id: Math.random()};
			var parentItem = rightClickedNode.item;
			this.addNode(item,parentItem);
			
			/*
			 * There is currently a bug in dijit/Tree where leaves don't behave properly
			 * when converted to branches. There are 2 workarounds:
			 * 
			 * 1. Destroy the whole tree widget and remake it.
			 * 2. Force-expand the leaf after it's been converted to a branch.
			 * 
			 * Either method is valid and works fine. In our case, since our tree's 
			 * store actually pulling from a server, there's no harm in destroying it;
			 * we'll need to refetch it off the server after a new node is added anyways.
			 * 
			 * The other method is left here in case it's needed.
			 * 
			 */
			
			treeWidget.refresh();
				
			/*************************
			 * Force-expand method
			 *************************
			 * 
			if(!rightClickedNode.isExpanded) {
				treeWidget._expandNode(rightClickedNode);
			}
			*/		
			
			rightClickedNode = null;
			
			return true;
		},

		modelTreeOnClick: function(item) {
			if(item.ID) {
				require(["controllers/ActionCollection"],function(ActionCollection){
					ActionCollection[ONCHANGE_ACTION]({modelId: item.ID});	
				});
			}
		},
		
		selectNodeOnTree: function(modelId) {
			var selectAsync = new Deferred();
			treeLoaderDeferred.promise.then(function(){
				var thisNode = treeWidget.getNodesByItem(modelId)[0];
				treeWidget.focusNode(thisNode);
				treeWidget._setSelectedItemAttr(modelId);
				selectAsync.resolve();
			});
			return selectAsync.promise;
		},
		
		getTreeRoot: function() {
			return modelHierarchyStore.getModel().root.childNodes[0].ID;
		},
	
		getModel: function() {
			var loadAsync = new Deferred();
			var treeModel = modelHierarchyStore.getModel();
			if(!treeModel) {
				return modelHierarchyStore.loadTreeData();
			} else {
				loadAsync.resolve(treeModel);
			}
			return loadAsync.promise;
		},
		
		reloadModel: function() {
			return modelHierarchyStore.loadTreeData();
		},
	

		// Define the tree widget this controller interacts with

		setTreeWidget: function(thisTreeWidget) {
			treeWidget = thisTreeWidget;
			treeLoaderDeferred.resolve(treeWidget);
		},
		
		getTreeWidget: function() {
			return treeLoaderDeferred.promise;
		},

		// Tell the tree to rebuild itself (probably needs
		// to also tell the Model to re-fetch itself)

		refreshTree: function() {
			return treeWidget.refresh();
		},
		
		// Right-clicking and popping context menus is managed outside of
		// this controller, but we have to know what was clicked on in
		// order to act on it. To solve this, we expose a method to
		// set a reference to the right-clicked node for later use.
		// 
		// This can be handled more elegantly (and should be)
		setRightClickNode: function(thisNode) {
			rightClickedNode = thisNode;
		}
	};

});
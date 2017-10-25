/*
**    Copyright (C) 2003-2015 Institute for Systems Biology 
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
    "dojo/on",
    "dojo/_base/array",
    "dojo/Deferred",
    "dijit",
    "app/utils"
],function(
	on,
	DojoArray,
	Deferred,
	dijit,
	utils
) {
	
	// The currently selected tab. This will *only* be set for the app/main instance
	// of the webapp, and not for any sub-window (expdata, pathing) spawned from it. 
	// In order to have have access to the current tab in those windows, it must be
	// provided at launch
	var CURRENT_TAB;
	
	////////////////////////////
	// RELOAD
	///////////////////////////
	//
	// Module-wide access to the view method which loads a new model 
	//
	function RELOAD(e) {
		require(["views"],function(viewsMain){
			viewsMain.loadNewModel(e);
		});
	};
	
	///////////////////
	// NEW_TAB
	//////////////////
	//
	// 
	function NEW_TAB(e) {
		require(["views"],function(viewsMain){
			viewsMain.addNewTab();
		});
	};
	
	///////////////////
	// EDIT_TAB
	//////////////////
	//
	// 
	function EDIT_TAB(e) {
		require(["views"],function(viewsMain){
			viewsMain.setTabTitle(e.title,e.index);
			viewsMain.setTabTooltip(e.fullTitle,e.index);
			viewsMain.setTabTooltip(e.desc,e.index);
		});
	};
	
	/////////////////
	// DROP_TAB
	////////////////
	//
	//
	function DROP_TAB(e) {
		require(["views"],function(viewsMain){
			viewsMain.closeTab(e.index,e.allButThisTab,e.fromBtn);
		});		
	};
	
	///////////////////////////
	// DELETE_GENOME_INSTANCE
	///////////////////////////
	//
	// 
	// 
	function DELETE_GENOME_INSTANCE(e) {
		require(["views","controllers/GrnModelController","controllers/ArtboardController"],
			function(BTViews,GrnModelController,ArtboardController){
			var myGrnMC = GrnModelController.getModelController(CURRENT_TAB);
			var model = e.id;
			BTViews.refreshModelTree().then(function(){
				if(myGrnMC.get("currentModel_") === model) {
					var treeRoot = BTViews.getTreeRoot(CURRENT_TAB);
					BTViews.selectOnTree(treeRoot,CURRENT_TAB);
					myGrnMC.set("currentModel_",treeRoot);
				}
				
				var abController = ArtboardController.getArtboardController(myGrnMC.get("cnvContainerNodeId_"));
				
				var deleteModels = function(modelId,deleteSelf) {
					var subModels = myGrnMC.getSubmodels_(modelId);

					DojoArray.forEach(subModels,function(submodel){
						deleteModels(submodel,true);
					});
					
					if(deleteSelf) {
						myGrnMC.deleteModel(modelId);	
					}
					
					abController.flushCache(modelId);								
				};
				
				deleteModels(model,!e.kidsOnly);

			});
		});
	};
	
	////////////////////////////////////
	// CLIENT_EXPIRE_KIDS_RELOAD_CURR
	////////////////////////////////////
	//
	//
	function CLIENT_EXPIRE_KIDS_RELOAD_CURR(e) {
		require(["controllers/ActionCollection"],function(ActionCollection){
			ActionCollection.CLIENT_EXPIRE_KIDS_RELOAD_CURR(e);
		});
	};
	
	////////////////////////////////////
	// CLIENT_EXPIRE_ALL_RELOAD_CURR
	////////////////////////////////////
	//
	//
	function CLIENT_EXPIRE_ALL_RELOAD_CURR(e) {
		require(["controllers/ActionCollection"],function(ActionCollection){
			ActionCollection.CLIENT_EXPIRE_ALL_RELOAD_CURR(e);
		});
	};

	////////////////////////////////////
	// CLIENT_EXPIRE_BRANCH_RELOAD_CURR
	////////////////////////////////////
	//
	//
	function CLIENT_EXPIRE_BRANCH_RELOAD_CURR(e) {
		require(["controllers/ActionCollection"],function(ActionCollection){
			ActionCollection.CLIENT_EXPIRE_BRANCH_RELOAD_CURR(e);
		});
	};
	
	////////////////////////
	// CLIENT_RELOAD_CURR
	////////////////////////
	//
	//
	function CLIENT_EXPIRE_RELOAD_CURR(e) {
		require(["controllers/ActionCollection"],function(ActionCollection){
			ActionCollection.CLIENT_EXPIRE_RELOAD_CURR(e);
		});
	};
	
	/////////////////////
	// MODEL_TREE_POPUP
	/////////////////////
	//
	// Unified method for handling model tree popup/context menu actions
	//
	function MODEL_TREE_POPUP(key,stepData,onSucc,postSucc,postDiag,resMap,persArgs) {
		require(["controllers/ActionController"],function(ActionController){			
			var widget = dijit.getEnclosingWidget(stepData.target);
			var hit = widget ? widget.getParent().currentTarget.item : null;
			var id = hit ? hit.ID : stepData.id;
			var nodeType = hit ? hit.modelType : stepData.nodeType;
			stepData.currTab = CURRENT_TAB;
			stepData.id = id;
			stepData.nodeType = nodeType;
			stepData.action = {cmdClass: "MODEL_TREE",cmdKey: key, args: {model: id, nodeType: nodeType}};
			stepData.postDialogStep = postDiag;
			stepData.persistentArgs = persArgs;
			stepData.onSuccess = onSucc;
			stepData.resultsMap = resMap;
			stepData.postSuccessStep = postSucc;
			ActionController.runAction(stepData);
		});
	};
	
	///////////////////////
	// MODEL_ENTITY_POPUP
	///////////////////////
	//
	// Unified method for handling GRN model entity popup/context menu actions
	// (node, link, region, etc.)
	//
	function MODEL_ENTITY_POPUP(key,stepData,onSucc,postSucc,postDiag,resMap,persArgs) {
		require(["controllers/ActionController"],function(ActionController){
			var widget = dijit.getEnclosingWidget(stepData.target);
			var hit = widget ? widget.getParent().hitObj : null;
			var id = hit ? hit.id : stepData.id;
			stepData.currTab = CURRENT_TAB;
			stepData.id = id;
			stepData.action = {cmdClass: "POP",cmdKey: key, args: (widget && widget.actionArgs) ? {uri: widget.actionArgs.uri, objID: widget.actionArgs.id} : {objID: id}};
			stepData.postDialogStep = postDiag;
			stepData.persistentArgs = persArgs;
			stepData.onSuccess = onSucc;
			stepData.resultsMap = resMap;
			stepData.postSuccessStep = postSucc;
			ActionController.runAction(stepData);
		});	
	};
	
	//////////////
	// TAB_POPUP
	//////////////
	//
	// Unified method for handling tab popup/context menu actions
	//
	function TAB_POPUP(key,stepData,onSucc,postSucc,postDiag,resMap,persArgs) {
		require(["controllers/ActionController"],function(ActionController){
			var menuSrc = stepData.target ? dijit.getEnclosingWidget(dijit.getEnclosingWidget(stepData.target).getParent().currentTarget) : null;
			var tabId = menuSrc && (menuSrc.tabId !== null && menuSrc.tabId !== undefined) ? menuSrc.tabId : CURRENT_TAB;
			stepData.currTab = CURRENT_TAB;
			stepData.popObj = tabId;
			stepData.action = {cmdClass: "MAIN",cmdKey: key, args:{popObj: tabId}};
			stepData.postDialogStep = postDiag;
			stepData.persistentArgs = persArgs;
			stepData.onSuccess = onSucc;
			stepData.resultsMap = resMap;
			stepData.postSuccessStep = postSucc;
			ActionController.runAction(stepData);
		});
	};
	
	
	
	return {
		
	/////////////////////////////////
	// MAIN
	////////////////////////////////
	//
	//
		MAIN_ADD: function(stepData) {
			require(["controllers/AddController"],function(AddController){
				stepData.currentTab = CURRENT_TAB;
				AddController.drawGene(stepData);
			});
		},
		MAIN_CANCEL_ADD_MODE: function(stepData) {
			require(["controllers/AddController"],function(AddController){
				AddController.cancelAdd(stepData);
			});
		},
		MAIN_LOAD: function(stepData) {
			require(["controllers/ActionController"],function(ActionController){
				stepData.action = {cmdClass: "MAIN",cmdKey: "LOAD"};
				stepData.postDialogStep = "SEND_DIALOG_RESULT";
				stepData.onSuccess = RELOAD;
				stepData.resultsMap = {
					tabs: "tabs",
					currTab: "currTab"
				};
				stepData.postSuccessStep = "CLOSE";
				ActionController.runAction(stepData);
			});
		},
		
		// MAIN Tab actions
		MAIN_NEW_TAB: function(stepData) {
			require(["controllers/ActionController"],function(ActionController){
				stepData.action = {cmdClass: "MAIN",cmdKey: "NEW_TAB"};
				stepData.onSuccess = NEW_TAB;
				ActionController.runAction(stepData);
			});
		},
		MAIN_RETITLE_TAB: function(e) {
			TAB_POPUP("RETITLE_TAB",e,EDIT_TAB,"CLOSE","SEND_DIALOG_RESULT",
				{
					title: "title",
					fullTitle: "fullTitle",
					desc: "desc"
				},["tabId","userInputs"]
			);
		},
		MAIN_DROP_ALL_BUT_THIS_TAB: function(e) {
			TAB_POPUP("DROP_ALL_BUT_THIS_TAB",e,DROP_TAB);
		},
		MAIN_DROP_THIS_TAB: function(e) {
			TAB_POPUP("DROP_THIS_TAB",e,DROP_TAB);
		},
		// relays to views/main that a tab has been closed outside of the primary
		// action set (eg. by clicking on the X in the corner)
		MAIN_CLOSE_TAB: function(e) {
			DROP_TAB(e);
		},
		
		
	/////////////////////////////////////
	// MODEL_TREE
	/////////////////////////////////////	
	//
	//

		MODEL_TREE_EDIT_MODEL_PROPERTIES: function(e) {
			MODEL_TREE_POPUP("EDIT_MODEL_PROPERTIES",e,CLIENT_EXPIRE_BRANCH_RELOAD_CURR,"CLOSE","SEND_DIALOG_RESULT",{},["id","nodeType"]);
		},
		MODEL_TREE_DELETE_GENOME_INSTANCE: function(e) {
			MODEL_TREE_POPUP("DELETE_GENOME_INSTANCE",e,DELETE_TREE_NODE,"CLOSE","SEND_DIALOG_RESULT",{},["id","nodeType"]);
		},
		MODEL_TREE_DELETE_GENOME_INSTANCE_KIDS_ONLY: function(e) {
			e.kidsOnly = true;
			MODEL_TREE_POPUP("DELETE_GENOME_INSTANCE_KIDS_ONLY",e,DELETE_TREE_NODE,"CLOSE","SEND_DIALOG_RESULT",{},["id","nodeType"]);
		},
		
	
	////////////////////////////////////////
	// POP
	///////////////////////////////////////
	//
	//
		// POP Note actions
		POP_EDIT_NOTE: function(stepData) {
			MODEL_ENTITY_POPUP("EDIT_NOTE",stepData,CLIENT_EXPIRE_RELOAD_CURR,"CLOSE","SEND_DIALOG_RESULT",{},["id"]);
		},
		
		// POP Node actions
		POP_DELETE_NODE: function(e) {
			require(["controllers/ActionController"],function(ActionController){
				var widget = dijit.getEnclosingWidget(stepData.target);
				var hit = widget ? widget.getParent().hitObj : null;
				var id = hit ? hit.id : stepData.id;
				stepData.id = id;
				stepData.action = {cmdClass: "POP",cmdKey: "DELETE_NODE", args:{objID: id}};
				stepData.postDialogStep = "SEND_DIALOG_RESULT";
				stepData.persistentArgs = ["id"];
				stepData.onSuccess = CLIENT_EXPIRE_BRANCH_RELOAD_CURR;
				stepData.resultsMap = {
						
				};
				stepData.postSuccessStep = "CLOSE";
				ActionController.runAction(stepData);
			});
		},
		
		// POP Region (Group) actions
		POP_GROUP_PROPERTIES: function(stepData) {
			MODEL_ENTITY_POPUP("GROUP_PROPERTIES",stepData,CLIENT_EXPIRE_BRANCH_RELOAD_CURR,"CLOSE","SEND_DIALOG_RESULT",{},["id"]);
		},
		POP_GROUP_DELETE: function(stepData) {
			MODEL_ENTITY_POPUP("GROUP_DELETE",stepData,CLIENT_EXPIRE_KIDS_RELOAD_CURR,"CLOSE","SEND_DIALOG_RESULT",{},["id"]);
		},
		POP_DELETE_REGION_MAP: function(stepData) {
			MODEL_ENTITY_POPUP("DELETE_REGION_MAP",stepData,CLIENT_EXPIRE_ALL_RELOAD_CURR,"CLOSE","SEND_DIALOG_RESULT",{},["id"]);	
		},
		
		
	//////////////////
	// CLIENT
	/////////////////
	//
	//
		CLIENT_LAUNCH_COLOR_EDITOR: function(e) {
			require(["dialogs/DialogFactory","dijit/registry"],function(DialogFactory,registry){
				var colorEdDialog;
				if(!registry.byId("color_editor_dialog")) {
					colorEdDialog = DialogFactory.makeColorEdDialog({clientMode: "EDITOR", openVal: e.color, colorChoices: e.colorChoices});
				} else {
					colorEdDialog = registry.byId("color_editor_dialog");
				}
				colorEdDialog.show().then(function(){
					registry.byId("btColorEd_sortBtn").focus();
				});
			});
		},
		
		
		SET_CURRENT_TAB: function(tabId) {
			CURRENT_TAB = tabId;
		}
		
		
	};
});
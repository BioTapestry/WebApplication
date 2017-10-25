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
    "app/utils",
    "dojo/_base/array",
    "dojo/on",
    "dojo/_base/declare"
],function(
	utils,
	DojoArray,
	on,
	declare
){
	
	var uriBase_ = null;
	var layoutFrame = null;
	var postBuildLoadElements = null;
	var dialog = null;
	
	function LOAD_PATH(args) {
		require([
	         "controllers/pathing/PathingModelController",
	         "views/pathing/main"
         ],
         function(
    		 networkModelController,
    		 PathingView
		 ){
			var myNMC = networkModelController.getModelController();
			(args.canvasId !== null && args.canvasId !== undefined) && myNMC.set("cnvContainerDomNodeId_",args.canvasId);
			
			myNMC.set("postBuildLoadElements_",postBuildLoadElements);
			myNMC.setModel(args).then(function(){
				require(["models/conditions/ElementConditions"],function(ElementConditions){
					if(!ElementConditions.get("havePath")) {
						ElementConditions.set("havePath",true);
						ElementConditions.set("neverAPath",false);
					}
				});
				if(args.pathInit) {
					PathingView.finishLoad(layoutFrame || dialog);
				}
				myNMC.setTitle(args.pathSrc,args.pathTrg);
			},function(err){
				if(!err.havePath) {
					require(["models/conditions/ElementConditions"],function(ElementConditions){
						ElementConditions.set("havePath",false);
						ElementConditions.set("neverAPath",err.neverAPath);
					});
				}
				if(args.pathInit) {
					PathingView.finishLoad(layoutFrame || dialog);
				}
				myNMC.setTitle();
			});
		});
	};
	
	
	return {
		
		SET_ONCLOSE: function(args,source) {
			window.onbeforeunload = function(e){
				source.postMessage({cmd: "CLIENT_CLOSED_WINDOW",args: {windowId: args.id}},window.location.origin);
			};
		},
		
		SET_TITLE: function(args) {
			if(dialog) {
				dialog.set("title",args.title);
			} else {
				window.document.title = args.title;	
			}
		},

		LOAD_PATH: function(args) {
			LOAD_PATH(args);
		},
		
		LOAD_PATH_FRAME: function(args) {
			dialog = args.dialog;
			var layout = args.resultsMap.dialog.dialogElementCollections.main;
			var windowFrame = args.resultsMap.dialog;
			var pathInfo = windowFrame.parameters;
			postBuildLoadElements = pathInfo.postBuildDataLoadElements;
			
			var abaParams = args.clientMode === "EDITOR" ? {
				attachTooltipEvent: {
					callback: function(abController) {
						return function(thisNode) {
							return abController.getTooltip(thisNode,true);
						};
					},
					fetchField: "id"
				}
			} : {};
												
			declare.safeMixin(layout,{
				"LocalElementParams": {
					"DRAWING_AREA": {
						networkModelController: "controllers/pathing/PathingModelController",
						delayedLoad: true,
						drawWorkspace: false,
						artboardAttachmentParams: abaParams
					}
				}
			});
			declare.safeMixin(layout,{
				"GridRenderers": {
					sign: function(object, data, td, options) {
						var iconClass = "iconContainer BioTapIcons524 ";
						switch(object.sign) {
							case 1:
								iconClass += "BioTapIcons524LinkPlus";
								break;
							case -1: 
								iconClass += "BioTapIcons524LinkMinus";
								break;
							case 0:
								iconClass += "BioTapIcons524LinkQuestion";
								break;								
						}
						td.innerHTML = '<span class="' + iconClass + '"></span>';
					}
				}
			});
						
			if(dialog) {
				require(["dialogs/DialogFactory"],function(DialogFactory){
					if(dialog.getChildren().length > 0) {
						dialog.destroyImmediates();
						dialog.getChildren()[0].destroyRecursive();
					}
					layout.parameters.style = "height: 700px; width: 900px;";
					DialogFactory.buildDialogContents({
						dialogDef: {dialogElementCollections: { mainPane: layout}, dialogType: dialog.dialogType}, 
						dialog: dialog
					});
					pathInfo.pathInit = true;
					LOAD_PATH(pathInfo);
				});					
			} else {
				require(["ui/FrameFactory"],function(FrameFactory){
					if(layoutFrame) {
						layoutFrame.destroyRecursive();
					}
					layoutFrame = FrameFactory.buildFrame(layout);
					pathInfo.pathInit = true;
					LOAD_PATH(pathInfo);
				});	
			}
			
			
			// If any elements are turned on or off via element-specific stating events,
			// we will need to register them with the ElementConditions model for watching
			if(windowFrame.defaultConditionStates) {
				require(["models/conditions/ElementConditions"],function(BTElemConditions){
					DojoArray.forEach(windowFrame.defaultConditionStates,function(state){
						utils.stringToBool(state);
						BTElemConditions.set(state.conditionName,state.conditionValue);
					});
				});
			}
		}
	};
});
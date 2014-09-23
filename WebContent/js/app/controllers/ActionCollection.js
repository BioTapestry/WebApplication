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
    "dojo/on",
    "dojo/_base/array",
    "dojo/Deferred",
    "app/utils"
],function(
	on,
	DojoArray,
	Deferred,
	utils
) {
	
	///////////////////////////////////////
	// ActionCollection
	//////////////////////////////////////
	//
	// A module for collecting the main action sets of the application: MAIN, POP, MODEL_TREE, OTHER, and CLIENT
	

	// The DOM node ID of the node which contains the canvas. This must be set by views/main during initialization
	// so the various actions can request the correct Controllers (Artboard, GrnModel) and BTCanvas.
	var APP_CANVAS_CONTAINER_NODE_ID;
	
	/////////////////////////////////////
	// WARN_RESTART_SESSION
	////////////////////////////////////
	//
	// Warn a user that the server has returned a NEW_SESSION response, and we need
	// to reload the client. If the user chooses to proceed via the OK button, the
	// CLIENT_RESTART_SESSION action will be run.
	//
	function WARN_RESTART_SESSION() {
		require(["dialogs/DialogFactory"],function(DialogFactory){
			var nsDialog = DialogFactory.makeBasicErrorDialog({
				title: "Session Expired",
				content: "The session appears to have expired. The client will now reload.",
				okCmdAction: "CLIENT_RESTART_SESSION"
			});
			nsDialog.show();
		});		
	};	
	
	////////////////////////////
	// PARSE_AND_SEL_ZOOM
	////////////////////////////
	//
	// Aggregate method which, given a 'newVal' in e, will parse the entities to select 
	// using GET_SELECTION_OBJECTS, then select and zoom using either ZOOM_TO_MODULES
	// (for overlays) or SELECT_AND_ZOOM.
	//
	function PARSE_AND_SEL_ZOOM(e) {
		require(["views/BioTapestryCanvas"],function(BTCanvas){
			GET_SELECTION_OBJECTS(e.newVal,BTCanvas.getBtCanvas(e.drawingAreaId || APP_CANVAS_CONTAINER_NODE_ID)).then(function(nodes){
				if(e.newVal.set) {
					require(["widgets/LowerLeftComponents"],function(LowerLeftComponents){
						SET_NETWORK_MODULES({
							overlay: null,modules: nodes, enable: true, enable_other: "INVERSE", reveal: "NO_CHANGE"
						}).then(function(){
							e.moduleZoom = "ACTIVE";
							ZOOM_TO_MODULES(e);	
						});
					});
				} else {
					e.newVal = nodes;
					SELECT_AND_ZOOM(e);	
				}
			});
		});
	};
	
	////////////////////////////////
	// ZOOM_TO_MODULES
	////////////////////////////////
	//
	//
	function ZOOM_TO_MODULES(e) {
		require(["views/BioTapestryCanvas"],function(BTCanvas){
			var btCanvas = BTCanvas.getBtCanvas((e && e.drawingAreaId) || APP_CANVAS_CONTAINER_NODE_ID);
			if(e.moduleZoom !== "ACTIVE") {
				btCanvas.zoomToModules(e.modules);
			} else {
				btCanvas.zoomToActiveModules();	
			}
		});		
	};
		
	/////////////////////////////////////
	// SET_NETWORK_MODULES
	////////////////////////////////////
	//
	//
	function SET_NETWORK_MODULES(e) {
		var asyncAction = new Deferred();
		require(["widgets/LowerLeftComponents"],function(LowerLeftComponents){
			LowerLeftComponents.getModule("overlay").toggleModules(e).then(function(){
				asyncAction.resolve();
			});
		});
		return asyncAction.promise;
	};
	
	/////////////////////////////////
	// CHECKBOX_TOGGLE
	/////////////////////////////////
	//
	//
	function CHECKBOX_TOGGLE(key,id) {
		require(["static/XhrUris","controllers/XhrController"],function(XhrUris,XhrController){
			XhrController.xhrRequest(
				XhrUris.cmd("POP",key,{objID: id}),{method: "POST"}).then(function(response){
			},function(err){
				if(err.status === "NEW_SESSION") {
					WARN_RESTART_SESSION();
				}
			});
		});			
	};
	
	
	////////////////////////////////
	// MAIN_TREE_PATH
	//////////////////////////////
	//
	// Aggregate method for user-defined paths
	//
	function MAIN_TREE_PATH(which) {
		require(["controllers/XhrController","static/XhrUris"],function(XhrController,XhrUris){
			var args = which.uri ? { uri: which.uri } : null;
			XhrController.xhrRequest(XhrUris.cmd("MAIN",which.key,args),{method: "POST"}).then(function(data){
				if(data.resultType === "SUCCESS") {
					if(!which.noPath) {
						var mods = [];
						DojoArray.forEach(data.resultsMap.currModules,function(mod){
							mods.push({id: mod, show: _.indexOf(data.resultsMap.revModules,mod) >= 0});
						});
						var overlay = (
							data.resultsMap.overlay ? 
							{id: data.resultsMap.overlay, enabled_modules: mods, revealed_modules: data.resultsMap.revModules} : 
							null
						);
						CLIENT_GOTO_MODEL({modelId: data.resultsMap.currModel, onPath:!which.noPath, overlay: overlay});
					}
					require(["views"],function(BTViews){
						BTViews.updateViewStates(data.resultsMap);
					});
				}
			},function(err){
				if(err.status === "NEW_SESSION") {
					WARN_RESTART_SESSION();
				}
			});
		});
	};
	
	/////////////////////////
	// ANALYZE_PATHS
	/////////////////////////
	//
	// Aggregate method for parallel pathing windows
	//
	function ANALYZE_PATHS(cmdKey,argsObj,click) {
		require(["static/XhrUris","controllers/XhrController"],function(XhrUris,XhrController){			
			XhrController.xhrRequest(XhrUris.cmd("POP",cmdKey,argsObj),{method:"POST"}).then(function(data){
				switch(data.resultType) {
					case "XPLAT_FRAME":
						click && click(data.resultsMap);
						require(["controllers/WindowController","app"],function(WindowController,appMain){
							WindowController.openWindow({
								id: "pathing", uri: XhrUris.pathing, title: "Pathing Display", 
								failoverType: "PATH_DISPLAY", controllerName: "controllers/pathing/PathingController",
								dimensions: { h: 500, w: 900}
							}).then(function(){
								data.clientMode = appMain.getClientMode();
								WindowController.sendCmdToWindow("pathing","LOAD_PATH_FRAME",data);
							});
						});

						break;
					case "ILLEGAL_CLICK_PROCESSED":
						// TODO: Make this a real error message
						alert("That click didn't work! Please try again!");
						break;
					default: 
						console.error("[ERROR] Received an unexpected response from the server!");
				}
			},function(err){
				if(err.status === "NEW_SESSION") {
					WARN_RESTART_SESSION();
				}
			});
		});		
	};
	

	///////////////////////////////////////////////////////////
	// GET_SELECTION_OBJECTS
	//////////////////////////////////////////////////////////
	//
	// Produces a list of selection objects based on a collection of:
	// 	-> array of strings containing entity IDs
	// 	-> array of entity objects
	// 	-> Object of IDs as property strings
	// 	-> Object of entity objects
	// 
	// This method converts any of these collections into the format needed for entity selection.
	// Requires an asynchronous call to the Canvas to get the node list for the current model.
	//
	function GET_SELECTION_OBJECTS(nodesToSelect,btCanvas) {
		var nodes = {};
		var nodesToSelectObj;
		
		var asyncGetObjs = new Deferred();
		
		btCanvas.getAllNodes().then(function(canvasNodes){
			if(nodesToSelect instanceof String) {
				var nodeId = nodesToSelect;
				nodesToSelect = new Array();
				nodesToSelect.push(nodeId);
			// Sets are lists of modules and can just be returned
			} else if(nodesToSelect.set && nodesToSelect.set instanceof Array) {
				asyncGetObjs.resolve(nodesToSelect.set);
			} else if(nodesToSelect instanceof Object && !(nodesToSelect instanceof Array)) {
				nodesToSelectObj = nodesToSelect;
				nodesToSelect = Object.keys(nodesToSelectObj);
			}
			
			DojoArray.forEach(nodesToSelect,function(node) {
				var nodeObj;
				var nodeId = node;
				if(node instanceof Object && !(node instanceof String)) {
					nodeId = node.id || node.itemId;
				}
				nodeObj = canvasNodes[nodeId];
				if(!nodeObj) {
					nodeObj = canvasNodes[btCanvas.getSharedIds(nodeId)];
				}
				
				if(nodeObj) { // squelch not-founds for now
					if(nodeObj.getType() === "linkage" && (nodesToSelectObj || (node instanceof Object && !(node instanceof String)))) {
						var linkages = nodesToSelectObj ? nodesToSelectObj[nodeId] : node.segments;
						if(linkages instanceof Array) {
							var origNode = nodeObj;
							nodeObj = _.clone(origNode);
							var segMap = _.object(
								nodeObj.segments.map(
									function(e) { return e.label+":"+e.islink+":"+e.isonly; }
								),nodeObj.segments
							);
							nodeObj.segments = new Array();
							DojoArray.forEach(linkages,function(seg){
								if(segMap[seg.label+":"+seg.islink+":"+seg.isonly]) {
									nodeObj.segments.push(segMap[seg.label+":"+seg.islink+":"+seg.isonly]);
								}
							});	
						}
					}
					nodes[nodeObj.id] = nodeObj;
				}
			});
			asyncGetObjs.resolve(nodes);
		});
		return asyncGetObjs.promise;
	};
	
	/////////////////////////////////
	// DISPLAY_EXPERIMENTAL_DATA
	////////////////////////////////
	//
	// Opens an experimental data window and sends the commend to load experimental data for display.
	// The args object must contain:
	//		-> FrameTitle: String, alternative window title from the server response
	//		-> ExperimentalData: Server response object
	// 		-> action: an object containing the command class and key of the server-side control flow
	// 		-> id: String of the ID of the request entity
	// 		-> linkUri (links only): the URI used to run the control flow for a link
	// 		-> name (nodes only): String, name of the entity
	//
	function DISPLAY_EXPERIMENTAL_DATA(args) {
		require(["controllers/WindowController","static/XhrUris"],function(WindowController,XhrUris){
			WindowController.openWindow({
				id: args.id + "_expdata", uri: XhrUris.expData, title: "Experimental Data for " + args.name, 
				failoverType: "EXP_DATA", controllerName: "controllers/expdata/ExpDataController"
			}).then(function(result){		
				WindowController.sendCmdToWindow(
					args.id + "_expdata","LOAD_DATA",{
						windowLink: "<p><a href=\"expdata/#/expd/" + args.action.cmdClass + "/" + args.action.cmdKey + "/"+args.id
							// If this is a link, it might be from an ambiguous hit that needed to be resolved, and we will
							// need to reproduce that response if a new window is opened. Store that ID here instead of the
							// name (because links use FrameTitles which are supplied by the server, not names)
							+"/"+(args.linkUri ? args.ExperimentalData.ID : args.name)
							+(args.linkUri ? "/" + args.linkUri.replace(/\"/g,"%22") : "")
							+"\" target=\"_blank\">Open in separate window</a></p>",
						queryString: "*[id^=\"exp_data_container\"]", preFetched: !args.ExperimentalData.incomplete, 
						expData: args.ExperimentalData.HTML, title: args.FrameTitle || "Experimental Data for " + args.name,
						objId: args.ExperimentalData.ID, genomeKey: args.ExperimentalData.genomeKey, 
						cmdKey: args.ExperimentalData.flowKey, cmdClass: "OTHER"
					}
				);
			},function(err){
				console.error("[ERROR] Failed to open a new window or dialog: "+ err);
			});
		});
	};
	
	//////////////////////////////
	// PATH_MODEL_GENERATION
	////////////////////////////
	//
	// Sends a request to load a given model to the existing model path window. args is the object describing the
	// model path to open per the requirements of the OTHER_PATH_MODEL_GENERATION command flow on the server
	//
	function PATH_MODEL_GENERATION(args) {
		var loadAsync = new Deferred();
		require(["controllers/XhrController","static/XhrUris"],function(xhrController,XhrUris){	
			xhrController.xhrRequest(XhrUris.cmd("OTHER","PATH_MODEL_GENERATION",args)).then(function(response){
				loadAsync.resolve(response);	
			});
		},function(err){
			if(err.status === "NEW_SESSION") {
				WARN_RESTART_SESSION();
			}
		});
		return loadAsync;	
	};
			
	
	////////////////////////////////////////
	// SELECT_AND_ZOOM
	///////////////////////////////////////
	//
	// Aggregate method for all selecting on the ArtboardController. Zooming is optional
	// via sending truthy noZoom in e
	// 
	//
	function SELECT_AND_ZOOM(e) {
		require(["controllers/ArtboardController"],function(ArtboardController){
			var thisController = ArtboardController.getArtboardController(e.drawingAreaId || APP_CANVAS_CONTAINER_NODE_ID);
			if(e.noZoom) {
				thisController.selectNodes(e.newVal,e.AppendToSelection);
			} else {
				thisController.selectNodesOnCanvasAndZoom(e.newVal,e.AppendToSelection);
			}
		});			
	};
	
	//////////////////////////////////
	// CLIENT_GOTO_MODEL
	//////////////////////////////////
	//
	// Change the current application model state (via the GrnModelController) 
	//
	function CLIENT_GOTO_MODEL(e) {
		var asyncModelChange = new Deferred();
		require(["controllers/GrnModelController","controllers/ModelTreeController"],
			function(GrnModelController,ModelTreeController){
			var modelId = (!e.isGrnId ? GrnModelController.splitModelId(e.modelId) : {modelId: e.modelId,state: e.state});
			ModelTreeController.selectNodeOnTree(modelId.modelId);
			GrnModelController.setModel(modelId.modelId,modelId.state,e.overlay,e.onPath).then(function(){
				asyncModelChange.resolve();
			});
		});
		return asyncModelChange.promise;
	};
	
	//////////////////////////////////
	// CLIENT_GOTO_MODEL_AND_SELECT
	//////////////////////////////////
	//
	// Change the current application model state (via the GrnModelController) 
	// and select the node list supplied
	// 
	// e.newVal: single object or Array of entities to select and the models 
	// they are found in
	//
	function CLIENT_GOTO_MODEL_AND_SELECT(e) {
		require(["controllers/ArtboardController","controllers/GrnModelController",
	         "controllers/ModelTreeController","dialogs/DialogFactory"],
			function(ArtboardController,GrnModelController,ModelTreeController,DialogFactory){
			
			var modelId = (e.newVal instanceof Array ? e.newVal[0].modelId : e.newVal.modelId);			
			
			var goToModelAndSel = function(clickEvent) {
				var entities = (e.newVal instanceof Array ? e.newVal : [e.newVal]);
				
				if(modelId && GrnModelController.get("currentModel_") !== modelId) {
					ModelTreeController.selectNodeOnTree(modelId);
					GrnModelController.set("currentModel_",modelId);
					if(clickEvent.disableOverlays) {
						GrnModelController.setModelOverlay("None");	
					}
				}
						
				GrnModelController.getCurrentModel().then(function(){
					if(e.mapLinks) {
						require(["controllers/XhrController","static/XhrUris"],function(XhrController,XhrUris){
							var linkIds = [];
							DojoArray.forEach(entities,function(link){
								linkIds.push(link.itemId);
							});
							XhrController.xhrRequest(XhrUris.mapLinks(linkIds,modelId)).then(function(response){
								e.newVal = response.resultsMap.LINKS;
								PARSE_AND_SEL_ZOOM(e);
							});
						});
					} else {
						e.newVal = entities;
						PARSE_AND_SEL_ZOOM(e);
					}				
				});
			};
			
			GrnModelController.getModel(modelId).then(function(model){
				var activeOpaqueOverlay = false;
				var hasOpaquetStart = false;
				if(model.overlayDefs_) {
					var abModel = ArtboardController.getArtboardController(e.drawingAreaId || APP_CANVAS_CONTAINER_NODE_ID).getModel(modelId,true);
					// If this artboard model has never been loaded, we need to see what the start view will be
					// when we DO load it--if it's an opaque overlay, we'll need to shut that off
					if(!abModel) {
						DojoArray.forEach(model.overlayDefs_,function(overlayDef){
							if(overlayDef.isOpaque && overlayDef.isStartView) {
								hasOpaquetStart = true;
							}
						});
					} else {
						var overlay = abModel.get("overlay_");
						if(overlay) {
							DojoArray.forEach(overlay.enabled_modules,function(mod){
								if(mod.show !== null && mod.show !== undefined) {
									activeOpaqueOverlay = true;	
								}
							});
						}
					}
				}
				
				if(activeOpaqueOverlay || hasOpaquetStart) {
					var yesNoDialog = DialogFactory.makeYesNoDialog({
						content: "Opaque network overlay will be turned off to ensure node visibility. Continue?",
						title: "Need to Turn Off Opaque Overlay",
						yesCmdFunction: goToModelAndSel,
						yesCmdParameters: {disableOverlays: true}
					});
					yesNoDialog.show();
				} else {
					goToModelAndSel({disableOverlays:false});
				}
			});
		});
	};
	
	///////////////////////////////////////
	// POP_SELECT
	///////////////////////////////////////
	//
	// Aggregate method for POP_SELECTION events, which all do the same thing:
	// post a POP_SELECT command to the server, receive results and select+zoom
	//
	function POP_SELECT(entity,cmdKey) {
		return function(e) {
			require([
		         "dijit","views/BioTapestryCanvas","controllers/XhrController","static/XhrUris","controllers/StatesController"
	         ],function(dijit,BTCanvas,XhrController,XhrUris,StatesController){
				var args = (cmdKey === "SELECT_LINK_TARGETS" ? 
					{uri: XhrUris.linkIdUri(dijit.getEnclosingWidget(e.target).getParent().hitObj)} : {objID: entity});

				XhrController.xhrRequest(XhrUris.cmd("POP",cmdKey,args)).then(function(response){
					if(response.resultsMap.SearchResults) {
						GET_SELECTION_OBJECTS(
							response.resultsMap.SearchResults,BTCanvas.getBtCanvas(
								e.drawingAreaId || APP_CANVAS_CONTAINER_NODE_ID
							)
						).then(function(nodes) {
							SELECT_AND_ZOOM(
								{newVal: nodes, AppendToSelection: StatesController.getState("POP_APPEND_TO_CURRENT_SELECTION")}
							);
						});
					}
				},function(err){
					if(err.status === "NEW_SESSION") {
						WARN_RESTART_SESSION();
					}
				});
			});
		};		
	};
	
		
	return {
		
		////////////////////////////////////////
		// SET_CANVAS_CONTAINER_NODE_ID
		////////////////////////////////////////
		//
		//
		SET_CANVAS_CONTAINER_NODE_ID: function(id) {
			APP_CANVAS_CONTAINER_NODE_ID = id;
		},
		
		//////////////////////////////////////
		// DO_NOTHING
		/////////////////////////////////////
		//
		// Empty stub method when one must be provided
		//
		DO_NOTHING: function(e) {
			// Does nothing
		},
		

	/////////////////////////////////////////////////////////////////////
	// MAIN
	/////////////////////////////////////////////////////////////////////
	//
	// Actions from the server-side MAIN flow
	//
		
		///////////////////////////////
		// MAIN Editor Only actions
		///////////////////////////////
		//
		// Editor-specific functionality is kept in the EditorActions module, which is not available in Viewer builds.
		// None of these methods should be called in the viewer; if they are, they will produce a failed module load
		// error.
		MAIN_ADD: function(stepData) {
			require(["controllers/EditorActions"],function(EditorActions){
				EditorActions.MAIN_ADD(stepData);
			});
		},
		
		MAIN_CANCEL_ADD_MODE: function(e) {
			require(["controllers/EditorActions"],function(EditorActions){
				EditorActions.MAIN_CANCEL_ADD_MODE();
			});
		},
		
		MAIN_LOAD: function(stepData) {
			require(["controllers/EditorActions"],function(EditorActions){
				EditorActions.MAIN_LOAD(stepData);
			});
		},
		
		/////////////////
		// MAIN_ABOUT
		////////////////
		//
		// Opens the 'About' Dialog
		MAIN_ABOUT: function() {
			require(["dialogs/DialogFactory","dijit/registry","app"],function(DialogFactory,registry,appMain){
				if(!registry.byId("about_dialog")) {
					var aboutDialog = DialogFactory.makeAboutDialog({clientMode: appMain.getClientMode()});
					aboutDialog.show();
				}
			});
		},
		
		
		//////////////////////////////
		// MAIN_ZOOM actions
		//////////////////////////////
		//
		//
		MAIN_ZOOM_TO_ALL_MODELS: function(e) {
			require(["controllers/GrnModelController","views/BioTapestryCanvas"],function(GrnModelController,BTCanvas){
				BTCanvas.getBtCanvas(e.drawingAreaId || APP_CANVAS_CONTAINER_NODE_ID).zoomToAllModels(GrnModelController.get("completeModelBounds_"));
			});
		},	
		MAIN_ZOOM_OUT: function(e) {
			require(["views/BioTapestryCanvas","dojo/dom"],function(BTCanvas,dom){
				BTCanvas.getBtCanvas(e.drawingAreaId || APP_CANVAS_CONTAINER_NODE_ID).zoomOut();
			});
		},
		MAIN_ZOOM_IN: function(e) {
			require(["views/BioTapestryCanvas"],function(BTCanvas){
				BTCanvas.getBtCanvas(e.drawingAreaId || APP_CANVAS_CONTAINER_NODE_ID).zoomIn();
			});
		},
		MAIN_ZOOM_TO_CURRENT_MODEL: function(e) {
			require(["views/BioTapestryCanvas"],function(BTCanvas){
				BTCanvas.zoomToShowModel(e.drawingAreaId || APP_CANVAS_CONTAINER_NODE_ID);
			});				
		},
		MAIN_ZOOM_TO_SHOW_WORKSPACE: function(e) {
			require(["views/BioTapestryCanvas"],function(BTCanvas){
				BTCanvas.zoomToShowWorkspace(e.drawingAreaId || APP_CANVAS_CONTAINER_NODE_ID);
			});				
		},
		MAIN_ZOOM_TO_ALL_SELECTED: function(e) {
			require(["views/BioTapestryCanvas"],function(BTCanvas){
				BTCanvas.zoomToSelected(e.drawingAreaId || APP_CANVAS_CONTAINER_NODE_ID);
			});				
		},
		MAIN_ZOOM_TO_CURRENT_SELECTED: function(e) {
			require(["controllers/ArtboardController"],function(ArtboardController){
				ArtboardController.getArtboardController(e.drawingAreaId || APP_CANVAS_CONTAINER_NODE_ID).zoomToCurrSel();
			});
		},
			
		////////////////////////////
		// MAIN_SELECT actions
		////////////////////////////
		//
		//
		MAIN_SELECT_NONE: function(e) {
			require(["controllers/ArtboardController"],function(ArtboardController){
				ArtboardController.getArtboardController(e.drawingAreaId || APP_CANVAS_CONTAINER_NODE_ID).deselectAllNodes();
			});	
		},
		MAIN_SELECT_ALL: function(e) {
			require(["controllers/ArtboardController"],function(ArtboardController){
				ArtboardController.getArtboardController(e.drawingAreaId || APP_CANVAS_CONTAINER_NODE_ID).selectAllNodes();
			});	
		},		
		MAIN_CENTER_ON_NEXT_SELECTED: function(e) {
			require(["controllers/ArtboardController"],function(ArtboardController){
				ArtboardController.getArtboardController(e.drawingAreaId || APP_CANVAS_CONTAINER_NODE_ID).centerOnNextSel();
			});
		},
		MAIN_CENTER_ON_PREVIOUS_SELECTED: function(e) {
			require(["controllers/ArtboardController"],function(ArtboardController){
				ArtboardController.getArtboardController(e.drawingAreaId || APP_CANVAS_CONTAINER_NODE_ID).centerOnPrevSel();
			});
		},
		
		///////////////////////////////////
		// MAIN_NETWORK_SEARCH
		//////////////////////////////////
		//
		//
		MAIN_NETWORK_SEARCH: function(stepData) {
			require(["controllers/ActionController","controllers/ArtboardController"],function(ActionController,ArtboardController){
				ArtboardController.getArtboardController(APP_CANVAS_CONTAINER_NODE_ID).getCurrentModel().then(function(model){
					var overlay = model.get("overlay_");
					var args = (overlay && (overlay.id !== null) ? {clientstate:true} : null);
					stepData.action = {cmdClass: "MAIN",cmdKey: "NETWORK_SEARCH", args: args}; 
					stepData.postDialogStep = "SEND_DIALOG_RESULT";
					stepData.onSuccess = PARSE_AND_SEL_ZOOM;
					stepData.postSuccessStep = "CLOSE";
					stepData.resultsMap = {
						SearchResults: "newVal",
						AppendToSelection: "AppendToSelection"
					};
					stepData.overlay = (overlay && (overlay.id !== null) ? overlay : null);
					ActionController.runAction(stepData);
				});
			});
		},
		
		//////////////////////////////
		// MAIN_TREE_PATH actions
		/////////////////////////////
		//
		// a.k.a. User Paths
		MAIN_TREE_PATH_FORWARD: function(e) {
			MAIN_TREE_PATH({key: "TREE_PATH_FORWARD"});
		},
		MAIN_TREE_PATH_BACK: function(e) {
			MAIN_TREE_PATH({key: "TREE_PATH_BACK"});
		},
		MAIN_TREE_PATH_SET_CURRENT_USER_PATH: function(e) {
			require(["controllers/StatesController"],function(StatesController){
				if(e.value === "No Path") {
					StatesController.setState(e.tag,null);
					StatesController.setState("ON_PATH",null);
				} else {
					StatesController.setState(e.tag,e.value);
					StatesController.setState("ON_PATH",e.tag);	
				}
				MAIN_TREE_PATH({key: "TREE_PATH_SET_CURRENT_USER_PATH",uri: e.item.uri, noPath: (e.value === "No Path")});
			});
			
		},

		
	///////////////////////////////////////////////////////////////
	// DEBUG
	//////////////////////////////////////////////////////////////
	//
	// Debugging methods
	//		
			
		DEBUG_TOGGLE_BOUNDS_DEBUGGING: function(e) {
			require(["views/BioTapestryCanvas"],function(BTCanvas){
				BTCanvas.getBtCanvas(e.drawingAreaId || APP_CANVAS_CONTAINER_NODE_ID).toggleBoundsDebug();
			});				
		},
		
	///////////////////////////////////////////////////////////////
	// POP
	//////////////////////////////////////////////////////////////
	//
	// Server-side "POP" actions, which are run from context menus opened
	// by right-clicking on the GRN's elements
		
		// POP for Network Modules
		POP_ZOOM_TO_NET_MODULE: function(id) {
			return function(e) {
				e.modules = [id];
				ZOOM_TO_MODULES(e);
			}
		},
		POP_TOGGLE_NET_MODULE_CONTENT_DISPLAY: function(id) {
			return function(e) {
				e.modules = [id];
				e.reveal = "TOGGLE";
				e.enable = "NO_CHANGE";
				e.reveal_other = "NO_CHANGE";
				SET_NETWORK_MODULES(e);
			}
		},
		POP_SET_AS_SINGLE_CURRENT_NET_MODULE: function(id) {
			return function(e) {
				e.modules = [id];
				e.reveal = "NO_CHANGE";
				e.enable = true;
				e.enable_other = "INVERSE";
				SET_NETWORK_MODULES(e);
			}
		},
		POP_DROP_FROM_CURRENT_NET_MODULES: function(id) {
			return function(e) {
				e.modules = [id];
				e.reveal = "NO_CHANGE";
				e.enable = false;
				e.enable_other = "NO_CHANGE";
				SET_NETWORK_MODULES(e);
			}
		},
		
		// POP checkbox items
		POP_SELECT_LINKS_TOGGLE: function(id) {
			return function(e) {
				CHECKBOX_TOGGLE("SELECT_LINKS_TOGGLE",id);
			};
		},
		POP_SELECT_QUERY_NODE_TOGGLE: function(id) {
			return function(e) {
				CHECKBOX_TOGGLE("SELECT_QUERY_NODE_TOGGLE",id);
			};
		},
		POP_APPEND_TO_CURRENT_SELECTION_TOGGLE: function(id) {
			return function(e) {
				CHECKBOX_TOGGLE("APPEND_TO_CURRENT_SELECTION_TOGGLE",id);
				require(["controllers/StatesController"],function(StatesController){
					StatesController.setState("POP_APPEND_TO_CURRENT_SELECTION",e);
				});
			};
		},
			
		// POP Experimental Data display actions
		POP_DISPLAY_LINK_DATA: function(id) {
			var uniqueId = utils.makeId();
			return function(stepData) {
				require(["controllers/ActionController","dijit","static/XhrUris"],function(ActionController,dijit,XhrUris){
					var widget = dijit.getEnclosingWidget(stepData.target);
					var link = widget ? widget.getParent().hitObj : null;
					var linkUri = link ? XhrUris.linkIdUri(link) : "";
					stepData.id = id;
					stepData.linkUri = linkUri;
					stepData.persistentArgs = ["linkUri"];
					stepData.label = stepData.label || (link ? (link.getName() || link.label) : null) || id; 
					stepData.name = stepData.label;
					stepData.action = {cmdClass: "POP",cmdKey: "DISPLAY_LINK_DATA",args: {uri: linkUri},uniqueId: uniqueId};
					stepData.postDialogStep = "SEND_DIALOG_RESULT";
					stepData.postSuccessStep = "END";
					stepData.onSuccess = DISPLAY_EXPERIMENTAL_DATA;
					stepData.resultsMap = {
						ExperimentalData: "ExperimentalData",
						FrameTitle: "FrameTitle"
					};
					ActionController.runAction(stepData);
				});
			};	
		},
		POP_DISPLAY_DATA: function(id) {
			var uniqueId = utils.makeId();
			return function(stepData) {
				require(["controllers/ActionController","dijit"],function(ActionController,dijit){
					var widget = dijit.getEnclosingWidget(stepData.target);
					var hit = widget ? widget.getParent().hitObj : null;
					var name = hit ? (hit.getName() || hit.label || id) : id;
					
					stepData.id = id;
					stepData.label = stepData.label || name || id; 
					stepData.name = stepData.label;
					stepData.action = {cmdClass: "POP",cmdKey: "DISPLAY_DATA",args: {objID: id},uniqueId: uniqueId};
					stepData.postSuccessStep = "END";
					stepData.onSuccess = DISPLAY_EXPERIMENTAL_DATA;
					stepData.resultsMap = {
						ExperimentalData: "ExperimentalData"
					}
					ActionController.runAction(stepData);
				});
			};				
		},
		
		// POP Usage dialogs
		POP_LINK_USAGES: function(id) {
			var uniqueId = utils.makeId();
			return function(stepData) {
				require(["controllers/ActionController","dijit","static/XhrUris"],function(ActionController,dijit,XhrUris){
					var link = dijit.getEnclosingWidget(stepData.target).getParent().hitObj;
					var linkUri = link ? XhrUris.linkIdUri(link) : "";
					stepData.action = {cmdClass: "POP",cmdKey: "LINK_USAGES",args: {uri: linkUri},uniqueId: uniqueId};
					stepData.postDialogStep = "PARSE_DIALOG_RESULT";
					stepData.postSuccessStep = "PARSE_DIALOG_RESULT";
					stepData.onSuccess = CLIENT_GOTO_MODEL_AND_SELECT;
					ActionController.runAction(stepData);
				});
			};			
		},
		POP_NODE_USAGES: function(id) {
			var uniqueId = utils.makeId();
			return function(stepData) {
				require(["controllers/ActionController"],function(ActionController){
					stepData.action = {cmdClass: "POP",cmdKey: "NODE_USAGES",args: {objID: id},uniqueId: uniqueId};
					stepData.postDialogStep = "PARSE_DIALOG_RESULT";
					stepData.postSuccessStep = "PARSE_DIALOG_RESULT";
					stepData.onSuccess = CLIENT_GOTO_MODEL_AND_SELECT;
					ActionController.runAction(stepData);
				});
			};
		},	

		// POP region actions
		POP_TOGGLE: function(id) {
			return function(e) {
				require(["controllers/ArtboardController"],function(abController){
					abController.getArtboardController(e.drawingAreaId || APP_CANVAS_CONTAINER_NODE_ID).toggleRegion(id);
				});
			};			
		},
		POP_ZOOM_TO_GROUP: function(id) {
			return function(e) {
				require(["views/BioTapestryCanvas"],function(BTCanvas){
					BTCanvas.getBtCanvas(e.drawingAreaId || APP_CANVAS_CONTAINER_NODE_ID).zoomToNode(id);
				});
			};			
		},
		
		POP_DELETE_NODE: function(id) {
			return function(e) {
				require(["controllers/EditorActions"],function(EditorActions){
					EditorActions.POP_DELETE_NODE(id);
				});
			};
		},		
		
		// POP selection actions
		POP_SELECT_SOURCES_GENE_ONLY: function(id) {
			return POP_SELECT(id,"SELECT_SOURCES_GENE_ONLY");
		},
		POP_SELECT_TARGETS_GENE_ONLY: function(id) {
			return POP_SELECT(id,"SELECT_TARGETS_GENE_ONLY");
		},		
		POP_SELECT_SOURCES: function(id) {
			return POP_SELECT(id,"SELECT_SOURCES");
		},
		POP_SELECT_TARGETS: function(id) {
			return POP_SELECT(id,"SELECT_TARGETS");
		},
		POP_SELECT_LINK_TARGETS: function(id) {
			return POP_SELECT(id,"SELECT_LINK_TARGETS");	
		},
		POP_SELECT_LINK_SOURCE: function(id) {
			return function(e) {
				require(["dijit"],function(dijit){
					e.newVal = [dijit.getEnclosingWidget(e.target).getParent().hitObj.srctag];
					PARSE_AND_SEL_ZOOM(e);
				});
			};
		},
		POP_FULL_SELECTION: function(id) { 		// Select all the segments in a link
			return function(e) {
				e.newVal = [dijit.getEnclosingWidget(e.target).getParent().hitObj.id];
				PARSE_AND_SEL_ZOOM(e);
			};
		},
		
		// POP_ANALYZE_PATHS actions
		POP_ANALYZE_PATHS_FROM_USER_SELECTED: function(id) {
			var clickId = "popAnalyzePathsFromUserSel";
			return function(e) {
				require(["static/XhrUris","controllers/XhrController","app","controllers/ClickWaitController"],
					function(XhrUris,XhrController,appMain,ClickWaitController){
					
					XhrController.xhrRequest(XhrUris.cmd("POP","ANALYZE_PATHS_FROM_USER_SELECTED",{objID: id})).then(function(data){
						if(data.resultType === "WAITING_FOR_CLICK") {
							var pathClick = function(e){
								require(["views/BioTapestryCanvas","controllers/WindowController"],function(BTCanvas,WindowController){
									var translatedClick = BTCanvas.translateHit({x: e.clientX, y: e.clientY},e.drawingAreaId || APP_CANVAS_CONTAINER_NODE_ID);
									translatedClick.x = Math.round(translatedClick.x);
									translatedClick.y = Math.round(translatedClick.y);
									ANALYZE_PATHS(
										"ANALYZE_PATHS_FROM_USER_SELECTED"
										,{objID: id, x: Math.round(translatedClick.x), y: Math.round(translatedClick.y)}
										,function(resultsMap){
											ClickWaitController.uninstallClick(clickId,resultsMap);
										}
									);
								});
							};
							ClickWaitController.installClick({
								clickId: clickId, 
								callback: pathClick, 
								canvasId: e.drawingAreaId || APP_CANVAS_CONTAINER_NODE_ID,
								type: "ACTION",
								statesAndMasks: data.resultsMap
							});			
						} else {
							console.error("[ERROR] Unexpected response from the server: "+data.resultType);
						}
					},function(err){
						ClickWaitController.uninstallClick(clickId);
						if(err.status === "NEW_SESSION") {
							WARN_RESTART_SESSION();
						}
					});
				});
			};
		},
		POP_ANALYZE_PATHS: function(id) {
			return function(e) {
				require(["dijit","static/XhrUris"],function(dijit,XhrUris){
					ANALYZE_PATHS("ANALYZE_PATHS",{uri: XhrUris.linkIdUri(dijit.getEnclosingWidget(e.target).getParent().hitObj)});
				});
			};			
		},
		POP_ANALYZE_PATHS_FOR_NODE: function(args) {
			return function(e) {
				ANALYZE_PATHS("ANALYZE_PATHS_FOR_NODE",{uri: args.uri, objID: args.id});
			};
		},
		
		
	///////////////////////////////////////////////////////////////////////////////////////
	// OTHER
	//////////////////////////////////////////////////////////////////////////////////////
	//
	// 
		
		OTHER_PATH_MODEL_GENERATION: function(args) {
			return PATH_MODEL_GENERATION(args);
		},
		

	///////////////////////////////////////////////////////////////////////////////////////
	// CLIENT
	//////////////////////////////////////////////////////////////////////////////////////
	//
	// Actions that are specific to client implementation and functionality
		
		////////////////////////////////////////
		// CLIENT_SET_MODEL
		////////////////////////////////////////
		//
		//
		CLIENT_SET_MODEL: function(e) {
			return CLIENT_GOTO_MODEL({isGrnId: true, modelId: e.modelId, state: e.state});
		},
		
		///////////////////////////////////
		// CLIENT_LOAD_EXP_DATA_WINDOW
		///////////////////////////////////
		//
		// Experimental Data defaults to a dialog, but can be pushed into a window if desired. This
		// method is used by the main module of the Experimenta Data window to reproduce the data
		// request and send it back into the new Experimental Data window's controller.
		//
		CLIENT_LOAD_EXP_DATA_WINDOW: function(e) {
			require(["static/XhrUris","controllers/XhrController","controllers/expdata/ExpDataController"],
				function(XhrUris,XhrController,BTExpDataController){
				var args = {};
				if(e.cmdKey === "DISPLAY_LINK_DATA") {
					args.uri = e.linkUri.replace(/%22/g,"\"");
				} else {
					args.objID = e.id;
				}
				XhrController.xhrRequest(XhrUris.cmd(e.cmdClass,e.cmdKey,args),{method:"POST"}).then(function(response){
					var loadArgs = {
						queryString: "*[id^=\"exp_data_container\"]",
						cmdClass: "OTHER"
					};
					
					var loadData = function(resultsMap) {
						var ExperimentalData = resultsMap.ExperimentalData;
						loadArgs.preFetched = !ExperimentalData.incomplete;
						loadArgs.expData = ExperimentalData.HTML;
						loadArgs.title = resultsMap.FrameTitle ? resultsMap.FrameTitle : "Experimntal Data for " + e.name; 
						loadArgs.objId = ExperimentalData.ID;
						loadArgs.genomeKey = ExperimentalData.genomeKey;
						loadArgs.cmdKey = ExperimentalData.flowKey;
						
						BTExpDataController.LOAD_DATA(loadArgs);							
					};
					
					// If our response is an XPLAT_DIALOG, there was ambiguity in the initial request for a link segment,
					// and it needs to be resolved. That information will have been stored in the segId variable.
					if(response.resultType === "XPLAT_DIALOG") {
						var userInputs = response.resultsMap.dialog.userInputs;
						userInputs.linkID = e.segId;
						var reqArgs = {
							headers: {"Content-Type":"application/json"},
							data: JSON.stringify(userInputs),
							method: "POST"
						};
						
						XhrController.xhrRequest(XhrUris.cmd(e.cmdClass,e.cmdKey),reqArgs).then(function(response){
							loadData(response.resultsMap);
						},function(err){
							console.err("[ERROR] "+err);
						});
					} else {
						loadData(response.resultsMap);
					}
				});
			});
		},
		
		/////////////////////////////////
		// CLIENT_ZOOM_TO_MODULES
		////////////////////////////////
		//
		// Zoom to either a list of modules, or all active modules if no list is specified
		CLIENT_ZOOM_TO_MODULES: function(e) {
			ZOOM_TO_MODULES(e || {moduleZoom: "ACTIVE"});
		},		
		
		//////////////////////////////
		// CLIENT_SET_OVERLAY
		//////////////////////////////
		//
		// Store an overlay object in the Artboard Controller (this will apply it to the current model)
		CLIENT_SET_OVERLAY: function(e) {
			var setAsync = new Deferred();
			require(["controllers/ArtboardController","controllers/StatesController","dijit"],function(ArtboardController,StatesController,dijit){
				if(!e.onPath && StatesController.getState("ON_PATH")) {
					var pathCombo = dijit.byId(StatesController.getState("ON_PATH"));
					pathCombo.set("value", "No Path");
				}
				ArtboardController.getArtboardController(e && e.drawingAreaId || APP_CANVAS_CONTAINER_NODE_ID).set("overlay_",e);
				setAsync.resolve();
			});
			return setAsync.promise;
		},
				
		///////////////////////////
		// CLIENT_PATH_SET_DEPTH
		///////////////////////////
		//
		// Adjust the depth on a pathing window/dialog, which will cause the path to reload
		CLIENT_PATH_SET_DEPTH: function(e) {
			require(["controllers/pathing/PathingController"],function(PathingController){
				PathingController.LOAD_PATH({
					pathDepth: e.newVal.id,
					pathSrc: e.pathSrc,
					pathTrg: e.pathTrg,
					pathInit: e.pathInit ? e.pathInit : false
				});
			});
		},
		
		//////////////////////////////////////
		// CLIENT_SELECT_BY_PATH
		//////////////////////////////////////
		//
		// Builds a selection object for use by SELECT_AND_ZOOM based on a pathing window's
		// list control, which produces a specialized selection object
		//
		CLIENT_SELECT_BY_PATH: function(e) {
			require(["views/BioTapestryCanvas"],function(BTCanvas){
				var btCanvas = BTCanvas.getBtCanvas(e.drawingAreaId || APP_CANVAS_CONTAINER_NODE_ID);
				btCanvas.getAllNodes().then(function(canvasNodes){
					var nodes = null;
					DojoArray.forEach(e.rows,function(row){
						if(!nodes) {
							nodes = {};
						}
						nodes[row.data.start] = true;
						nodes[row.data.end] = true;
						if(row.data.links && row.data.links.length > 0) {
							DojoArray.forEach(row.data.links,function(link){
								nodes[link.trg] = true;
								nodes[link.src] = true;
								var useTag = link.tag;
								if(!canvasNodes[link.tag]) {
									useTag = btCanvas.getSharedIds(link.tag);
								}
								var linkClone = _.clone(canvasNodes[useTag]);
								if(linkClone) {
									if(row.data.allSegs[link.tag]) {
										var segMap = _.object(
											linkClone.segments.map(
												function(e) { return e.label+":"+e.islink+":"+e.isonly; }
											),linkClone.segments
										);
										linkClone.segments = new Array();
										DojoArray.forEach(row.data.allSegs[link.tag],function(seg){
											if(segMap[seg.label+":"+seg.islink+":"+seg.isonly]) {
												linkClone.segments.push(segMap[seg.label+":"+seg.islink+":"+seg.isonly]);
											}
										});
										nodes[useTag] = linkClone;
									}
								}
							});	
						}
					});
					
					// If we've made it to here and there are no nodes, just don't do anything.
					if(nodes) {
						e.newVal = nodes;
						e.noZoom = false;
						
						SELECT_AND_ZOOM(e);
					}
				});
			});
		},
		
		/////////////////////////////////////
		// CLIENT_SET_ELEMENT_CONDITION
		///////////////////////////////////
		//
		// Element Conditions are conditions that elements check to determine various
		// state settings (eg. types of available values, activation). This action
		// sets them according to values saved in the event object it receives
		//
		//
		CLIENT_SET_ELEMENT_CONDITION: function(e) {
			require(["models/conditions/ElementConditions"],function(ElementConditions){
				if(e.conditionValueLoc === "ELEMENT_VALUES") {
					for(var i in e.values) {
						if(e.values.hasOwnProperty(i)) {
							ElementConditions.set(i,e.values[i]);
						}
					}
				}
				if(e.conditionValueLoc === "ELEMENT_NEWVAL") {
					ElementConditions.set(e.conditionName,e.newVal[e.conditionCol]);
				}				
				if(e.conditionValueLoc === "ELEMENT_ROWS") {
					for(var i in e.rows) {
						if(e.rows.hasOwnProperty(i)) {
							ElementConditions.set(e.conditionCol,(e.rows[i].data[e.conditionCol] === "true"));
						}
					}
				}
				if(e.conditionValueLoc === "EVENT") {
					ElementConditions.set(e.conditionCol,e.conditionValue);
				}				
			});
		},
		
		
		////////////////////////////////
		// CLIENT_SELECT_AND_ZOOM
		////////////////////////////////
		//
		// e.newVal: nodes to be selected
		// e.modelId: model containing the nodes to act on
		// 
		// Unlike CLIENT_GOTO_MODEL_AND_SELECT, this method does not change the application model state,
		// it only changes the Artboard Controller model state. This is intended for use with floating
		// artboards, which use the GrnModelController to obtain model data but do not use it to
		// synchronize their state. (For example, dialog boxes with model displays which need to mirror
		// the application but not track it.)
		//
		CLIENT_SELECT_AND_ZOOM: function(e) {
			require(["controllers/ArtboardController"],function(ArtboardController){
				var nodes = (e.newVal instanceof Array ? e.newVal : [e.newVal]);
				var modelId = (e.newVal instanceof Array ? e.newVal[0].modelId : e.newVal.modelId);
				var abController = ArtboardController.getArtboardController(e.drawingAreaId || APP_CANVAS_CONTAINER_NODE_ID);
								
				if(modelId && abController.get("currentModel_") !== modelId) {
					abController.setModel(modelId).then(function(){
						e.newVal = nodes;
						PARSE_AND_SEL_ZOOM(e);						
					});
				} else {
					e.newVal = nodes;
					PARSE_AND_SEL_ZOOM(e);
				}
			});
		},
		
		///////////////////////////
		// CLIENT_CANCEL_COMMAND
		//////////////////////////
		//
		// Cancels the current executing command as represented by an instance on the
		// ActionController's private set and informs the server
		//
		CLIENT_CANCEL_COMMAND: function(e) {
			require(["controllers/ActionController"],function(ActionController){
				ActionController.cancel(e.actionId);
			});
		},
		
		//////////////////////////////
		// CLIENT_END_COMMAND 
		//////////////////////////////
		//
		//
		// Kills the current executing command as represented by an instance on the
		// ActionController's private collection
		//
		CLIENT_END_COMMAND: function(e) {
			require(["controllers/ActionController"],function(ActionController){
				ActionController.end(e.actionId);
			});
		},	
		
		///////////////////////////////
		// CLIENT_RELOAD
		/////////////////////////////
		//
		// Reloads this instance of the application and resets any states
		CLIENT_RELOAD: function(e) {
			RELOAD(e);
		},
		
		///////////////////////////////////
		// CLIENT_WARN_RESTART_SESSION
		///////////////////////////////////
		//
		// Pops up a modal dialog warning the user the session has expired, and if
		// OK is clicked, initiates a reload.
		//
		CLIENT_WARN_RESTART_SESSION: function(e) {
			WARN_RESTART_SESSION(e);
		},		
		
		///////////////////////////////
		// CLIENT_RESTART_SESSION
		///////////////////////////////
		//
		// Reloads the client after a session expiration
		//
		CLIENT_RESTART_SESSION: function(e) {
			require(["views"],function(BTViews){
				BTViews.sessionRestart();
			});	
		},

		/////////////////////////////
		// CLIENT_CLOSE_WINDOW
		/////////////////////////////
		//
		// An action for the server to assign to widgets which encompasses closing both
		// failover dialogs, which will need to be cleaned out of the WindowController,
		// and periphary windows
		//
		CLIENT_CLOSE_WINDOW: function(e) {
			if(e.isWindow) {
				window.close();	
			} else {
				require(["controllers/WindowController"],function(WindowController){
					WindowController.closeWindow(e.windowId);
				});
			}
		},		
		
		//////////////////////////////////////////
		// CLIENT_CLOSED_WINDOW
		/////////////////////////////////////////
		//
		// Signals to this window that one of its associated open frames has closed, and
		// that it should perform any relevant cleanup in the WindowController
		//
		CLIENT_CLOSED_WINDOW: function(e) {
			require(["controllers/WindowController"],function(WindowController){
				WindowController.closeWindow(e.windowId);
			});
		}
	};

});
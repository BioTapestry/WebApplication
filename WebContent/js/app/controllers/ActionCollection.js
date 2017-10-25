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
    "dojo/on",
    "dojo/_base/array",
    "dojo/Deferred",
    "dijit",
    "app/utils",
    "static/BTConst"
],function(
	on,
	DojoArray,
	Deferred,
	dijit,
	utils,
	BTConst
) {
	
	///////////////////////////////////////
	// ActionCollection
	//////////////////////////////////////
	//
	// A module for collecting the main action sets of the application: MAIN, POP, MODEL_TREE, OTHER, and CLIENT
	//
	// Module-wide variables
	//----------------------
	// The currently selected tab's database ID. This will *only* be set for the app/main instance of the webapp, 
	// and not for any sub-window (expdata, pathing) spawned from it. In order to have have access to the current 
	// tab in those windows, it must be provided in any arguments to methods
	var CURRENT_TAB;
	//
	// The DOM node ID of the node on the current tab which contains the canvas. This will *only* be 
	// set for the app/main instance of the webapp, and not for any sub-window (expdata, pathing) 
	// spawned from it.
	var APP_CANVAS_CONTAINER_NODE_ID;
	//
	// The current mode of the client. This defaults to VIEWER, and is set by views/main when it is first loaded
	var CLIENT_MODE = BTConst.CLIENTMODE_VIEWER;
		
	
	///////////////////////////////////
	// LAUNCH_ERROR_DIALOG
	////////////////////////////
	//
	//
	function LAUNCH_ERROR_DIALOG(msg,title,action) {
		require(["dialogs/DialogFactory"],function(DialogFactory){
			var nsDialog = DialogFactory.makeBasicErrorDialog({
				title: title || "Error!",
				content: msg,
				okCmdAction: action || "DO_NOTHING"
			});
			nsDialog.show();
		});			
	};
	
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
					SET_NETWORK_MODULES({
						overlay: null,modules: nodes, enable: true, enable_other: "INVERSE", reveal: "NO_CHANGE"
					}).then(function(){
						e.moduleZoom = "ACTIVE";
						ZOOM_TO_MODULES(e);	
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
			LowerLeftComponents.getLowerLeftComponents(CURRENT_TAB).toggleModules(e).then(function(){
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
	function CHECKBOX_TOGGLE(key,e) {
		var id = dijit.getEnclosingWidget(e.target).getParent().hitObj.id;
		require(["static/XhrUris","controllers/XhrController"],function(XhrUris,XhrController){
			XhrController.xhrRequest(
				XhrUris.cmd("POP",key,{objID: id, currentTab: CURRENT_TAB}),{method: "POST"}).then(function(response){
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
			var args = which.uri ? { uri: which.uri } : {};
			args.currentTab = CURRENT_TAB;
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
						windowLink: "<p><a href=\"expdata/#/expd/" + args.action.cmdClass +"/"+ args.action.cmdKey 
							+"/"+ args.id +"/"+ CURRENT_TAB
							// If this is a link, it might be from an ambiguous hit that needed to be resolved, and we will
							// need to reproduce that response if a new window is opened. Store that ID here instead of the
							// name (because links use FrameTitles which are supplied by the server, not names)
							+"/"+(args.linkUri ? args.ExperimentalData.ID : args.name)
							+(args.linkUri ? "/" + args.linkUri.replace(/\"/g,"%22") : "")
							+"\" target=\"_blank\">Open in separate window</a></p>",
						queryString: "*[id^=\"exp_data_container\"]", preFetched: !args.ExperimentalData.incomplete, 
						expData: args.ExperimentalData.HTML, title: args.FrameTitle || "Experimental Data for " + args.name,
						objId: args.ExperimentalData.ID, genomeKey: args.ExperimentalData.genomeKey, 
						cmdKey: args.ExperimentalData.flowKey, cmdClass: "OTHER",
						currentTab: CURRENT_TAB
					}
				);
			},function(err){
				console.error("[ERROR] Failed to open a new window or dialog: "+ err);
			});
		});
	};
	
	//////////////////
	// ANALYZE_PATHS
	/////////////////
	//
	// Aggregator method for the POP_ANALYZE_PATHS actions
	function ANALYZE_PATHS(cmdClass,stepData,uriArgs) {
		require(["static/XhrUris","controllers/ActionController"],function(XhrUris,ActionController){
			stepData.currTab = CURRENT_TAB;
			stepData.action = {cmdClass: "POP",cmdKey: cmdClass,args: uriArgs};
			stepData.drawingAreaId = stepData.drawingAreaId || APP_CANVAS_CONTAINER_NODE_ID;
			stepData.frame = {
				id: "pathing",
				uri: XhrUris.pathing,
				title: "Pathing Display",
				failOver: "PATH_DISPLAY",
				controller: "controllers/pathing/PathingController",
				h: 500, w: 900,
				postOpen: "LOAD_PATH_FRAME",
				clientMode: CLIENT_MODE
			};
			stepData.clickAction = "POP_"+cmdClass;
			stepData.persistentArgs = ["id","uri","clickId","frame"];		

			ActionController.runAction(stepData);		
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
			if(!args.currentTab) {
				args.currentTab = CURRENT_TAB;
			}
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
	function SELECT_AND_ZOOM(e) {
		require(["controllers/ArtboardController"],function(ArtboardController){
			var thisController = ArtboardController.getArtboardController(e.drawingAreaId || APP_CANVAS_CONTAINER_NODE_ID);
			if(e.noZoom) {
				thisController.selectNodes(e.newVal,e.AppendToSelection);
			} else {
				thisController.selectNodesOnCanvasAndZoom(e.newVal,e.AppendToSelection,true);
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
		require(["controllers/GrnModelController","views"],function(GrnModelController,BTViews){
			var grnMC = GrnModelController.getModelController(CURRENT_TAB);
			var modelId = (!e.isGrnId ? grnMC.splitModelId(e.modelId) : {modelId: e.modelId,state: e.state});
			BTViews.selectOnTree(modelId.modelId);
			grnMC.setModel(modelId.modelId,modelId.state,e.overlay,e.onPath,e.isSliderChange).then(function(){
				asyncModelChange.resolve();
			},function(err){
				console.debug("[WARNING] Unable to set model to "+modelId.modelId+". Model is now "+err.modelId_);
				// Resolve the chain here, because nothing waits asynchronously on a success of this method
				asyncModelChange.resolve("[WARNING] Unable to set model to "+modelId.modelId+". Model is now "+err.modelId_);
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
		require(["controllers/ArtboardController","controllers/GrnModelController","views","dialogs/DialogFactory"],
			function(ArtboardController,GrnModelController,BTViews,DialogFactory){
			
			var grnMC = GrnModelController.getModelController(CURRENT_TAB);
			var modelId = (e.newVal instanceof Array ? e.newVal[0].modelId : e.newVal.modelId);
			
			var goToModelAndSel = function(clickEvent) {
				var entities = (e.newVal instanceof Array ? e.newVal : [e.newVal]);
				
				if(modelId && grnMC.get("currentModel_") !== modelId) {
					BTViews.selectOnTree(modelId);
					grnMC.set("currentModel_",modelId);
					if(clickEvent.disableOverlays) {
						grnMC.setModelOverlay("None");	
					}
				}
						
				grnMC.getCurrentModel().then(function(){
					if(e.mapLinks) {
						require(["controllers/XhrController","static/XhrUris"],function(XhrController,XhrUris){
							var linkIds = [];
							DojoArray.forEach(entities,function(link){
								linkIds.push(link.itemId);
							});
							XhrController.xhrRequest(XhrUris.mapLinks(linkIds,modelId),{currentTab: CURRENT_TAB}).then(function(response){
								e.newVal = response.resultsMap.LINKS;
								PARSE_AND_SEL_ZOOM(e);
							});
						});
					} else {
						e.newVal = entities;
						PARSE_AND_SEL_ZOOM(e);
					}				
				},function(err){
					console.error("[Error] Unable to get the current model to select entities!");
					LAUNCH_ERROR_DIALOG("[Error] Unable to get the current model to select entities!");
				});
			};
			
			grnMC.getModel(modelId).then(function(model){
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
	function POP_SELECT(e,cmdKey) {
		var entity = dijit.getEnclosingWidget(e.target).actionArgs.id;
		require([
	         "views/BioTapestryCanvas","controllers/XhrController","static/XhrUris","controllers/StatesController"
         ],function(BTCanvas,XhrController,XhrUris,StatesController){
			var args = (cmdKey === "SELECT_LINK_TARGETS" ? 
				{uri: XhrUris.linkIdUri(dijit.getEnclosingWidget(e.target).getParent().hitObj)} : {objID: entity});
			args.currentTab = CURRENT_TAB;
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
	
	///////////////////////////
	// EDIT_WIDGET_SETTINGS
	//////////////////////////
	//
	//
	function EDIT_WIDGET_SETTINGS(widgets) {
		require(["dijit/registry","dojo/dom"],function(registry,dom){
			DojoArray.forEach(Object.keys(widgets),function(id){
				var widg = registry.byId(id);
				
				DojoArray.forEach(Object.keys(widgets[id]),function(adjustment){
					switch(adjustment) {
						case "TEXT_CONTENT_REPLACE":
							dom.byId(id).innerHTML = dom.byId(id).innerHTML.replace(
								widgets[id][adjustment].oldVal,widgets[id][adjustment].newVal
							); 
							break;
					
						case "CHOICE_LABEL_STRING_REPLACE":
							DojoArray.forEach(widg.getChildren(),function(child){
								child.set("label",child.get("label").replace(widgets[id][adjustment].oldVal,widgets[id][adjustment].newVal));
							});
							break;
						case "INVALID_CHOICES":
							widg && widg.removeChoices && widg.removeChoices(widgets[id][adjustment]);
							break;
					}
				});
			});
		});
	}
	
	/////////////////////////
	// EDITOR_PASS_THROUGH
	////////////////////////
	//
	// All Editor-specific functionality is present in EditorActions,
	// which is only available in Editor builds
	//
	function EDITOR_PASS_THROUGH(e,cmdClassAndKey) {
		if(CLIENT_MODE === BTConst.CLIENTMODE_EDITOR) {
			require(["controllers/EditorActions"],function(EditorActions){
				e.currTab = CURRENT_TAB;
				EditorActions[cmdClassAndKey](e);
			});		
		} else {
			require(["ErrorMessages"],function(ErrMsgs){
				console.error(ErrMsgs.ActionFailModeNotEd);
			});
		}
	};
	
	///////////////////
	// EXPIRE_RELOAD
	///////////////////
	//
	// Aggregate method for expiring and reloading a specified model, and optionally expiring some of its relatives
	function EXPIRE_RELOAD(modelId,kids,branch,drawingAreaId) {
		require(["controllers/GrnModelController","controllers/ArtboardController"],function(GrnModelController,ArtboardController){
			GrnModelController.getModelController(CURRENT_TAB).expireAndReloadCurrent(modelId,kids,branch).then(function(){
				ArtboardController.getArtboardController(drawingAreaId).redrawCurrent();	
			});
		});			
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

		////////////////////////////////////////
		// SET_CURRENT_TAB
		////////////////////////////////////////
		//
		//
		SET_CURRENT_TAB: function(tabId) {
			CURRENT_TAB = tabId;
			if(CLIENT_MODE === BTConst.CLIENTMODE_EDITOR) {
				require(["controllers/EditorActions"],function(EditorActions){
					EditorActions.SET_CURRENT_TAB(tabId);
				});
			}
		},

		////////////////////////////////////////
		// GET_CURRENT_TAB
		////////////////////////////////////////
		//
		//
		GET_CURRENT_TAB: function() {
			return CURRENT_TAB;
		},
		
		////////////////////
		// SET_CLIENT_MODE
		////////////////////
		//
		//
		SET_CLIENT_MODE: function(mode) {
			CLIENT_MODE = mode;
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
		// Convenience method to pass through any calls to Editor-specific functions which
		// may arise from widgets built in a mixed Viewer/Editor context (eg. popup menus which
		// have varying action sets in eaither mode). These methods pass Editor-specific
		// calls on to the EditorActions module.
		// 
		// None of these methods should be called in the viewer; if they are, they will error
		MAIN_ADD: function(e) {
			EDITOR_PASS_THROUGH(e,"MAIN_ADD");
		},
		MAIN_CANCEL_ADD_MODE: function(e) {
			EDITOR_PASS_THROUGH(e,"MAIN_CANCEL_ADD_MODE");
		},
		MAIN_LOAD: function(e) {
			EDITOR_PASS_THROUGH(e,"MAIN_LOAD");
		},
		MAIN_NEW_TAB: function(e) {
			EDITOR_PASS_THROUGH(e,"MAIN_NEW_TAB");
		},
		MAIN_CLOSE_TAB: function(e) {
			EDITOR_PASS_THROUGH(e,"MAIN_CLOSE_TAB");
		},
		MAIN_REDESC_TAB: function(e) {
			EDITOR_PASS_THROUGH(e,"MAIN_REDESC_TAB");
		},
		MAIN_RETITLE_TAB: function(e) {
			EDITOR_PASS_THROUGH(e,"MAIN_RETITLE_TAB");
		},
		MAIN_DROP_ALL_BUT_THIS_TAB: function(e) {
			EDITOR_PASS_THROUGH(e,"MAIN_DROP_ALL_BUT_THIS_TAB");
		},
		MAIN_DROP_THIS_TAB: function(e) {
			EDITOR_PASS_THROUGH(e,"MAIN_DROP_THIS_TAB");
		},
		
		
		/////////////////
		// MAIN_ABOUT
		////////////////
		//
		// Opens the 'About' Dialog
		MAIN_ABOUT: function() {
			require(["dialogs/DialogFactory","dijit/registry"],function(DialogFactory,registry){
				if(!registry.byId("about_dialog")) {
					var aboutDialog = DialogFactory.makeAboutDialog({clientMode: CLIENT_MODE});
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
			require(["controllers/ArtboardController","views/BioTapestryCanvas"],function(ArtboardController,BTCanvas){
				var myAbC = ArtboardController.getArtboardController(e.drawingAreaId || APP_CANVAS_CONTAINER_NODE_ID);
				BTCanvas.getBtCanvas(e.drawingAreaId || APP_CANVAS_CONTAINER_NODE_ID).zoomToAllModels(myAbC.get("completeModelBounds_"));
			});
		},	
		MAIN_ZOOM_OUT: function(e) {
			require(["views/BioTapestryCanvas","controllers/StatesController"],function(BTCanvas,StatesController){
				if(e.drawingAreaId || StatesController.getState("MAIN_ZOOM_OUT")) {
					BTCanvas.getBtCanvas(e.drawingAreaId || APP_CANVAS_CONTAINER_NODE_ID).zoomOut();
				}
			});
		},
		MAIN_ZOOM_IN: function(e) {
			require(["views/BioTapestryCanvas","controllers/StatesController"],function(BTCanvas,StatesController){
				if(e.drawingAreaId || StatesController.getState("MAIN_ZOOM_IN")) {
					BTCanvas.getBtCanvas(e.drawingAreaId || APP_CANVAS_CONTAINER_NODE_ID).zoomIn();
				}
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
		MAIN_ZOOM_WARN: function(e) {
			require(["dialogs/DialogFactory","dijit/registry","app"],function(DialogFactory,registry,appMain){
				if(!registry.byId("zoom_warning_dialog")) {
					var zwDialog = DialogFactory.makeZoomWarnDialog({type: e.zoomType});
					zwDialog.show();
				}
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
					stepData.currTab = CURRENT_TAB;
					stepData.action = {cmdClass: "MAIN",cmdKey: "NETWORK_SEARCH", args: {clientstate:true}}; 
					stepData.postDialogStep = "SEND_DIALOG_RESULT";
					stepData.onSuccess = PARSE_AND_SEL_ZOOM;
					stepData.postSuccessStep = "CLOSE";
					stepData.resultsMap = {
						SearchResults: "newVal",
						AppendToSelection: "AppendToSelection"
					};
					stepData.overlay = (overlay && (overlay.id !== null) ? overlay : null);
					ActionController.runAction(stepData);
				},function(err){
					console.error("[ERROR] Unable to retrieve the current model for searching!");
					LAUNCH_ERROR_DIALOG("Unable to retrieve the current model for searching!");
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
					StatesController.setState(e.tag,null,CURRENT_TAB);
					StatesController.setState("ON_PATH",null,CURRENT_TAB);
				} else {
					StatesController.setState(e.tag,e.value,CURRENT_TAB);
					StatesController.setState("ON_PATH",e.tag,CURRENT_TAB);	
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
	// Server-side "POP" actions, which are run from context/popup menus opened
	// by right-clicking on the model's elements
		
		// POP for Network Modules
		POP_ZOOM_TO_NET_MODULE: function(e) {
			e.modules = [dijit.getEnclosingWidget(e.target).getParent().hitObj.id];
			ZOOM_TO_MODULES(e);
		},
		POP_TOGGLE_NET_MODULE_CONTENT_DISPLAY: function(e) {
			e.modules = [dijit.getEnclosingWidget(e.target).getParent().hitObj.id];
			e.reveal = "TOGGLE";
			e.enable = "NO_CHANGE";
			e.reveal_other = "NO_CHANGE";
			SET_NETWORK_MODULES(e);
		},
		POP_SET_AS_SINGLE_CURRENT_NET_MODULE: function(e) {
			e.modules = [dijit.getEnclosingWidget(e.target).getParent().hitObj.id];
			e.reveal = "NO_CHANGE";
			e.enable = true;
			e.enable_other = "INVERSE";
			SET_NETWORK_MODULES(e);
		},
		POP_DROP_FROM_CURRENT_NET_MODULES: function(e) {
			e.modules = [dijit.getEnclosingWidget(e.target).getParent().hitObj.id];
			e.reveal = "NO_CHANGE";
			e.enable = false;
			e.enable_other = "NO_CHANGE";
			SET_NETWORK_MODULES(e);
		},
		
		// POP checkbox items
		POP_SELECT_LINKS_TOGGLE: function(e) {
			CHECKBOX_TOGGLE("SELECT_LINKS_TOGGLE",e);
		},
		POP_SELECT_QUERY_NODE_TOGGLE: function(e) {
			CHECKBOX_TOGGLE("SELECT_QUERY_NODE_TOGGLE",e);
		},
		POP_APPEND_TO_CURRENT_SELECTION_TOGGLE: function(e) {
			var checkVal = dijit.getEnclosingWidget(e.target).get("checked");
			CHECKBOX_TOGGLE("APPEND_TO_CURRENT_SELECTION_TOGGLE",e);
			require(["controllers/StatesController"],function(StatesController){
				StatesController.setState("POP_APPEND_TO_CURRENT_SELECTION", checkVal);
			});
		},
			
		// POP Experimental Data display actions
		POP_DISPLAY_LINK_DATA: function(stepData) {
			require(["controllers/ActionController","static/XhrUris"],function(ActionController,XhrUris){
				var widget = dijit.getEnclosingWidget(stepData.target);
				var link = widget ? widget.getParent().hitObj : null;
				var id = link ? link.id : stepData.id;
				var linkUri = link ? XhrUris.linkIdUri(link) : "";
				stepData.id = id;
				stepData.linkUri = linkUri;
				stepData.persistentArgs = ["linkUri", "id", "name"];
				stepData.label = stepData.label || (link ? (link.getName() || link.label) : null) || id; 
				stepData.name = stepData.label;
				stepData.currTab = stepData.currentTab || CURRENT_TAB;
				stepData.action = {cmdClass: "POP",cmdKey: "DISPLAY_LINK_DATA",args: {uri: linkUri},uniqueId: (widget ? widget.uniqueId : null)};
				stepData.postDialogStep = "SEND_DIALOG_RESULT";
				stepData.postSuccessStep = "END";
				stepData.onSuccess = DISPLAY_EXPERIMENTAL_DATA;
				stepData.resultsMap = {
					ExperimentalData: "ExperimentalData",
					FrameTitle: "FrameTitle"
				};
				ActionController.runAction(stepData);
			});
		},
		POP_DISPLAY_DATA: function(stepData) {
			require(["controllers/ActionController"],function(ActionController){
				var widget = dijit.getEnclosingWidget(stepData.target);
				var hit = widget ? widget.getParent().hitObj : null;
				var id = hit ? hit.id : stepData.id;
				var name = hit ? (hit.getName() || hit.label || id) : id;
				stepData.currTab = CURRENT_TAB;
				stepData.id = id;
				stepData.label = stepData.label || name || id; 
				stepData.name = stepData.label;
				stepData.action = {cmdClass: "POP",cmdKey: "DISPLAY_DATA",args: {objID: id, clientstate:true},uniqueId: (widget ? widget.uniqueId : null)};
				stepData.postSuccessStep = "END";
				stepData.onSuccess = DISPLAY_EXPERIMENTAL_DATA;
				stepData.resultsMap = {
					ExperimentalData: "ExperimentalData"
				}
				ActionController.runAction(stepData);
			});
		},
		
		// POP Usage dialogs
		POP_LINK_USAGES: function(stepData) {
			require(["controllers/ActionController","static/XhrUris"],function(ActionController,XhrUris){
				var widget = dijit.getEnclosingWidget(stepData.target);
				var link = widget.getParent().hitObj;
				var linkUri = link ? XhrUris.linkIdUri(link) : stepData.linkUri;
				stepData.action = {cmdClass: "POP",cmdKey: "LINK_USAGES",args: {uri: linkUri},uniqueId: (widget ? widget.uniqueId : null)};
				stepData.postDialogStep = "PARSE_DIALOG_RESULT";
				stepData.linkUri = linkUri;
				stepData.currTab = CURRENT_TAB;
				stepData.postSuccessStep = "PARSE_DIALOG_RESULT";
				stepData.onSuccess = CLIENT_GOTO_MODEL_AND_SELECT;
				ActionController.runAction(stepData);
			});
		},
		POP_NODE_USAGES: function(stepData) {
			require(["controllers/ActionController"],function(ActionController){
				var widget = dijit.getEnclosingWidget(stepData.target);
				var hit = widget ? widget.getParent().hitObj : null;
				var id = hit ? hit.id : stepData.id;
				stepData.action = {cmdClass: "POP",cmdKey: "NODE_USAGES",args: {objID: id},uniqueId: (widget ? widget.uniqueId : null)};
				stepData.id = id;
				stepData.currTab = CURRENT_TAB;
				stepData.postDialogStep = "PARSE_DIALOG_RESULT";
				stepData.postSuccessStep = "PARSE_DIALOG_RESULT";
				stepData.onSuccess = CLIENT_GOTO_MODEL_AND_SELECT;
				ActionController.runAction(stepData);
			});
		},	

		// POP region actions
		POP_TOGGLE: function(e) {
			require(["controllers/ArtboardController"],function(abController){
				abController.getArtboardController(e.drawingAreaId || APP_CANVAS_CONTAINER_NODE_ID).toggleRegion(
					dijit.getEnclosingWidget(e.target).getParent().hitObj.id
				);
			});
		},
		POP_ZOOM_TO_GROUP: function(e) {
			require(["views/BioTapestryCanvas"],function(BTCanvas){
				BTCanvas.getBtCanvas(e.drawingAreaId || APP_CANVAS_CONTAINER_NODE_ID).zoomToNode(
					dijit.getEnclosingWidget(e.target).getParent().hitObj.id
				);
			});
		},
		POP_GROUP_PROPERTIES: function(e) {
			EDITOR_PASS_THROUGH(e,"POP_GROUP_PROPERTIES");
		},
		POP_GROUP_DELETE: function(e) {
			EDITOR_PASS_THROUGH(e,"POP_GROUP_DELETE");
		},
		POP_DELETE_REGION_MAP: function(e) {
			EDITOR_PASS_THROUGH(e,"POP_DELETE_REGION_MAP");
		},
		
		// POP Node actions
		POP_DELETE_NODE: function(e) {
			require(["controllers/EditorActions"],function(EditorActions){
				EditorActions.POP_DELETE_NODE(e);
			});
		},		
		
		// POP selection actions
		POP_SELECT_SOURCES_GENE_ONLY: function(e) {
			POP_SELECT(e,"SELECT_SOURCES_GENE_ONLY");
		},
		POP_SELECT_TARGETS_GENE_ONLY: function(e) {
			POP_SELECT(e,"SELECT_TARGETS_GENE_ONLY");
		},		
		POP_SELECT_SOURCES: function(e) {
			POP_SELECT(e,"SELECT_SOURCES");
		},
		POP_SELECT_TARGETS: function(e) {
			POP_SELECT(e,"SELECT_TARGETS");
		},
		POP_SELECT_LINK_TARGETS: function(e) {
			POP_SELECT(e,"SELECT_LINK_TARGETS");
		},
		POP_SELECT_LINK_SOURCE: function(e) {
			e.newVal = [dijit.getEnclosingWidget(e.target).getParent().hitObj.srctag];
			PARSE_AND_SEL_ZOOM(e);
		},
		POP_FULL_SELECTION: function(e) {
			e.newVal = [dijit.getEnclosingWidget(e.target).getParent().hitObj.id];
			PARSE_AND_SEL_ZOOM(e);
		},
		
		// POP_ANALYZE_PATHS actions
		POP_ANALYZE_PATHS_FROM_USER_SELECTED: function(stepData) {
			var widget = dijit.getEnclosingWidget(stepData.target);
			var hit = widget ? widget.getParent().hitObj : null;
			var id = hit ? hit.id : stepData.id;
			stepData.id = id;
			stepData.clickId = "popAnalyzePathsFromUserSel";
			ANALYZE_PATHS("ANALYZE_PATHS_FROM_USER_SELECTED",stepData,{objID: id});
		},
		POP_ANALYZE_PATHS_WITH_QPCR: function(stepData) {
			require(["static/XhrUris"],function(XhrUris){
				var widget = dijit.getEnclosingWidget(stepData.target);
				var hit = widget ? widget.getParent().hitObj : null;
				var id = hit ? hit.id : stepData.id;
				stepData.id = id;
				stepData.uri = XhrUris.linkIdUri(hit);
				ANALYZE_PATHS("ANALYZE_PATHS_WITH_QPCR",stepData,{uri: stepData.uri});
			});		
		}, 
		POP_ANALYZE_PATHS: function(stepData) {
			require(["static/XhrUris"],function(XhrUris){
				var widget = dijit.getEnclosingWidget(stepData.target);
				var hit = widget ? widget.getParent().hitObj : null;
				var id = hit ? hit.id : stepData.id;
				stepData.id = id;
				stepData.uri = XhrUris.linkIdUri(hit);
				ANALYZE_PATHS("ANALYZE_PATHS",stepData,{uri: stepData.uri});
			});		
		},
		POP_ANALYZE_PATHS_FOR_NODE: function(stepData) {
			var menuItem = dijit.getEnclosingWidget(stepData.target);
			var id = menuItem ? menuItem.actionArgs.id : stepData.id;
			var uri = menuItem ? menuItem.actionArgs.uri : stepData.uri;
			stepData.id = id;
			stepData.uri = id;
			ANALYZE_PATHS("ANALYZE_PATHS_FOR_NODE",stepData,{uri: uri, objID: id});
		},
		
		POP_EDIT_NOTE: function(e) {
			EDITOR_PASS_THROUGH(e,"POP_EDIT_NOTE");
		},
		
		
	///////////////////////////////////////////////////////////////////////////////////////
	// OTHER
	//////////////////////////////////////////////////////////////////////////////////////
	//
	// 
		
		OTHER_PATH_MODEL_GENERATION: function(args) {
			args.currentTab = CURRENT_TAB;
			return PATH_MODEL_GENERATION(args);
		},
		

	///////////////////////////////////////////////////////////////////////////////////////
	// CLIENT
	//////////////////////////////////////////////////////////////////////////////////////
	//
	// Actions that are specific to client implementation and functionality
		
		//////////////////////////////////////
		// CLIENT_KEYMAP
		//////////////////////////////////////
		//
		//
		CLIENT_KEYMAP: function(e) {
			require(["dialogs/DialogFactory","dijit/registry"],function(DialogFactory,registry){
				if(!registry.byId("keymap_dialog")) {
					var keymapDialog = DialogFactory.makeKeymapDialog({clientMode: CLIENT_MODE});
					keymapDialog.show();
				}
			});
		},
		
		///////////////////////////////////
		// CLIENT_SHOW_STACKPAGE
		//////////////////////////////////
		//
		//
		CLIENT_SHOW_STACKPAGE: function(e) {
			require(["dijit/registry"],function(registry){
				var stackContainer = registry.byId(e.containerId);
				var stackPage = registry.byId(e.pageId);
				
				if(e.widgetSettings) {
					EDIT_WIDGET_SETTINGS(e.widgetSettings);
				}
				
				if(e.elementConditions) {
					console.debug("Totally swapping out these:",e.elementConditions);
				}
				
				stackContainer && stackPage && stackContainer.selectChild(stackPage);
			});			
		},

		///////////////////////////////////
		// CLIENT_EXPIRE actions
		///////////////////////////////////
		//
		//
		CLIENT_EXPIRE_ALL_RELOAD_CURR: function(e) {
			EXPIRE_RELOAD("root",true,null,(e && e.drawingAreaId || APP_CANVAS_CONTAINER_NODE_ID));
		},
		CLIENT_EXPIRE_BRANCH_RELOAD_CURR: function(e) {
			EXPIRE_RELOAD(e.modelId,null,true,(e && e.drawingAreaId || APP_CANVAS_CONTAINER_NODE_ID));
		},
		CLIENT_EXPIRE_KIDS_RELOAD_CURR: function(e) {
			EXPIRE_RELOAD(e.modelId,true,false,(e && e.drawingAreaId || APP_CANVAS_CONTAINER_NODE_ID));
		},
		CLIENT_EXPIRE_RELOAD_CURR: function(e) {
			EXPIRE_RELOAD(e.modelId,false,false,(e && e.drawingAreaId || APP_CANVAS_CONTAINER_NODE_ID));
		},
		
		////////////////////////////////////////
		// CLIENT_SET_MODEL
		////////////////////////////////////////
		//
		//
		CLIENT_SET_MODEL: function(e) {
			return CLIENT_GOTO_MODEL({isGrnId: true, modelId: e.modelId, state: e.state, isSliderChange: e.isSliderChange});
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
				var args = {
					currentTab: e.currentTab || CURRENT_TAB
				};
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
						loadArgs.title = resultsMap.FrameTitle ? resultsMap.FrameTitle : "Experimental Data for " + e.name; 
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
						
						XhrController.xhrRequest(XhrUris.cmd(e.cmdClass,e.cmdKey,{currentTab: args.currentTab || CURRENT_TAB}),reqArgs).then(function(response){
							loadData(response.resultsMap);
						},function(err){
							console.error("[ERROR] "+err.error,sg);
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
			require(["controllers/ArtboardController","controllers/StatesController"],function(ArtboardController,StatesController){
				if(!e.onPath && StatesController.getState("ON_PATH",CURRENT_TAB)) {
					var pathCombo = dijit.byId(StatesController.getState("ON_PATH",CURRENT_TAB));
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
					pathInit: e.pathInit ? e.pathInit : false,
					canvasId: e.drawingAreaId
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
					if(e.values) {
						for(var i in e.values) {
							if(e.values.hasOwnProperty(i)) {
								ElementConditions.set(i,e.values[i]);
							}
						}
					}
					if(e.newVal != undefined && e.newVal != null) {
						ElementConditions.set(e.thisElement,e.newVal);
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
		},
		
		///////////////////////////////////
		// CLIENT_LAUNCH_COLOR_EDITOR
		////////////////////////////////////
		//
		// Launch the BTColorEditorDialog, which is an Editor action
		//
		CLIENT_LAUNCH_COLOR_EDITOR: function(e) {
			EDITOR_PASS_THROUGH(e,"CLIENT_LAUNCH_COLOR_EDITOR");
		}
	};

});
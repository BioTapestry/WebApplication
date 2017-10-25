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
    "./XhrController",
    "static/XhrUris",
    "static/TextMessages",
    "models/ClientState",
    "dojo/_base/declare",
    "dojo/_base/array"
],function(
	XhrController,
	XhrUris,
	TxtMsgs,
	ClientState,
	declare,
	DojoArray
) {
	
	///////////////////////////////////
	// ActionController
	//////////////////////////////////
	//
	// A module for stepping through a series of action steps based on user and server events.
	//
	// The module maintains a private set of current 'live' actions (in progress or paused)
	// based on their action name. Actions which can have multiple versions of themselves in 
	// process must provide a unique ID when instantiated.
	
	var ActionControllers = {};
	var actionCounts = {};
	
	var ActionController = declare([],{
		
		// Some actions may have arguments which
		persistentArgs_: null,
		
		// For actions which can have multiple instances running at the same time,
		// this allows them to be differentiated
		actionId_: null,
		
		// If this action has a dialog, a reference to it is kept here
		currentDialog_: null,
		
		// Data of the currentStep in this action
		currentStep_: null,
		
		// Object which identifies the Action from the ActionCollection which is being
		// executed
		action_: null,
				
		// Function which will run if a success state is reached
		onSuccess_: null,
		
		// Map of key-value pairs which will indicate how to map a server's results response 
		// to a stepData object which will be sent to the onSuccess_ function
		resultsMap_: null,
		
		// If there is a dialog, the default step to be taken after one of the dialog's action buttons is clicked
		// is to report the findings to the server
		postDialogStep_: "SEND_DIALOG_RESULT",
		
		// Frames are independent windows or dialogs, so we always end the action after launching them
		postFrameStep_: "END",
		
		// By default we end if the server tells us we were successful
		postSuccessStep_: "END",
		
		/////////////////////////////
		// _resultsBundler
		/////////////////////////////
		//
		// Collect data from a dialog
		//
		_resultsBundler: function(stepData) {
			
			var selections,selectionBundlers = {};
			
			// If there was a list-selection widget, collect all the selections into
			// an array of objects and note their bundleAs properties (if there are any)
			if(stepData.selection) {
				var selections = new Array();
				for(var i in stepData.selection) {
					if(stepData.selection.hasOwnProperty(i)) {
						if(i !== "selectionMode" && stepData.selection[i] instanceof Object) {
							var bundle = {};
							for(var j in stepData.selection[i]) {
								if(stepData.selection[i].hasOwnProperty(j)) {
									if(stepData.bundleMap && stepData.bundleMap[j] === "selection") {
										selectionBundlers[j] = true;
									}
									bundle[j] = stepData.selection[i][j];
								}
							}
							selections.push(bundle);
						}
					}
				}
			}	
			if(!stepData.bundleMap && selections) {
				if(stepData.selection.selectionMode === "single") {
					stepData.newVal = selections[0];
				} else {
					stepData.newVal = selections;
				}
			}
			
			// Go through the bundleMap, attempting to bundle results from
			// various sources
			for(var i in stepData.bundleMap) {
				// Form data bundler
				if(stepData.form[stepData.bundleMap[i]]) {
					var uiStore = stepData.userInputs;
					// If this needs to be further sub-bundled, do that
					if(stepData.bundleIn && stepData.bundleIn[i]) {
						uiStore = stepData.userInputs[stepData.bundleIn[i]];
					}
					
					// 1- or 0-length arrays whose value equals the bundler name are
					// actually stand-alone checkboxes in disguise
					if(stepData.form[stepData.bundleMap[i]] instanceof Array
						&& stepData.form[stepData.bundleMap[i]].length <= 1) {
						uiStore[i] = stepData.form[stepData.bundleMap[i]].length === 1;
					} else {
						uiStore[i] = stepData.form[stepData.bundleMap[i]];	
					}	
					
				// list-select widget bundler
				} else if(selectionBundlers[i]) {						

					// If this is for returning via a userInputs object
					if(stepData.userInputs) {
						
						if(stepData.selection.selectionMode === "single") {
							stepData.userInputs[i] = selections[0][i];
						} else {
							stepData.userInputs.selections = selections;
						}	
					// otherwise, just store it in newval
					} else {
						stepData.newVal = selections;
					}
				// Extra-form, non-list widget bundler (eg. buttons)
				} else if(stepData[i]) {
					stepData.userInputs[i] = stepData[i];
				}
				
				// If, after these three checks, there is still nothing in userInputs
				// for this bundle, make sure to set it null so that on deserialization
				// the object is null
				if(stepData.userInputs[i] === undefined) {
					stepData.userInputs[i] = null;
				}
			}
			if(this.persistentArgs_) {
				this.persistentArgs_.userInputs = stepData.userInputs;
			}
		},
		
		////////////////////////////
		// _runAction
		////////////////////////////
		//
		// If the action already exists, any new args will be ignored unless they are set
		// as persistentArgs, in which case they are brought forward
		//
		_runAction: function(stepData) {
			var self=this;
			if(!this.action_) {
				if(stepData.persistentArgs) {
					this.persistentArgs_ = {};
					DojoArray.forEach(stepData.persistentArgs,function(arg){
						self.persistentArgs_[arg] = stepData[arg];
					});
				}
				this.action_ = stepData.action;
				this.resultsBundler_ = stepData.bundler;
				this.onSuccess_ = stepData.onSuccess;
				this.resultsMap_ = stepData.resultsMap;
				this.postSuccessStep_ = (stepData.postSuccessStep ? stepData.postSuccessStep : this.postSuccessStep_);
				this.postDialogStep_ = (stepData.postDialogStep ? stepData.postDialogStep : this.postDialogStep_);
				this.postFrameStep_ = (stepData.postFrameStep ? stepData.postFrameStep : this.postFrameStep_);
				
				var actionType = this.action_.cmdClass + "_" + this.action_.cmdKey;
				
				if(!actionCounts[actionType]) {
					actionCounts[actionType] = 0;
				}
				actionCounts[actionType]++;
			} else {
				for(var i in this.persistentArgs_) {
					if(!stepData[i]) {
						stepData[i] = this.persistentArgs_[i];
					}
				}
			}
			
			if(!this.currentStep_) {
				var reqArgs = {
					method: "POST"
				};
				var stateParams = {
					currentTab: stepData.currTab || 0
				};
				
				if(stepData.overlay) {
					stateParams.currOverlay = stepData.overlay.id;
					stateParams.enabledMods = stepData.overlay.enabled_modules;	
				}
				reqArgs.data = JSON.stringify(ClientState.getNewStateObject(stateParams));
				reqArgs.headers = {"Content-Type":"application/json"};
				if(!this.action_.args) {
					this.action_.args = {};
				}
				this.action_.args.currentTab = stepData.currTab;
				XhrController.xhrRequest(XhrUris.cmd(this.action_.cmdClass,this.action_.cmdKey,this.action_.args),reqArgs).then(function(response){
					if(response.reply) {
						alert(response.reply);
						return;
					} else {
						self.currentStep_ = {
							step: response.resultType,
							response: response
						};
						self._parseStep(stepData);
					}
				},function(err){
					if(err.status === "NEW_SESSION") {
						require(["controllers/ActionCollection"],function(ActionCollection){
							ActionCollection.CLIENT_WARN_RESTART_SESSION();
						});
					} else {
						alert("Error while trying to run " + self.action_.cmdClass+"_"+self.action_.cmdKey+"!");
						self._end();
					}
				});
			} else {
				this._parseStep(stepData);
			}
		},
		
		/////////////////////////
		// _end
		////////////////////////
		//
		// Stops the current command flow without cancelling (i.e. no feedback to the server)
		//
		_end: function() {
			this.currentDialog_ && this.currentDialog_.hide();
			actionCounts[this.action_.cmdClass + "_" + this.action_.cmdKey]--;			
			this.action_ = null;
			this.currentStep_ = null;
			this.currentDialog_ = null;
		},
		
		/////////////////////////
		// _cancel
		////////////////////////
		//
		//
		// Cancels the current command flow and informs the server
		//
		_cancel: function() {
			var self=this;
			XhrController.xhrRequest(XhrUris.cmd(self.action_.cmdClass,self.action_.cmdKey,{currentTab: self.action_.args.currentTab, cancel: true})).then(function(response){
				if(response.resultType === "CANCEL") {
					require(["views"],function(BTViews){
						BTViews.updateViewStates(response.resultsMap);
					});						
				} else {
					alert("Unexpected result type in ActionController._cancel(): " + response.resultType);
				}
			},function(err){
				if(err.status === "NEW_SESSION") {
					self._end();
					require(["controllers/ActionCollection"],function(ActionCollection){
						ActionCollection.CLIENT_WARN_RESTART_SESSION();
					});
				}
			});
			actionCounts[this.action_.cmdClass + "_" + this.action_.cmdKey]--;			
			this.action_ = null;
			this.currentStep_ = null;
			this.currentDialog_ = null;
		},
		
		////////////////////
		// _prepareClick
		///////////////////
		//
		// Attach a click event to the Canvas's containing DOM node
		//
		_prepareClick: function(stepData) {
			var self=this;
			require(["controllers/ClickWaitController"],function(ClickWaitController){				
				ClickWaitController.installClick({
					clickId: stepData.clickId, 
					callback: stepData.clickCallback,
					action: stepData.clickAction,
					canvasId: stepData.drawingAreaId,
					type: "ACTION",
					statesAndMasks: self.currentStep_.response.resultsMap,
					stepData: stepData
				});
			});
			self.currentStep_.step = "SEND_CLICK_RESULT";
		},
		
		/////////////////////
		// _sendClickResult
		////////////////////
		//
		// Report the results of a click event on the Canvas' containing DOM node
		//
		_sendClickResult: function(stepData) {
			var self=this;
			var args = {
				x: stepData.translatedClick.x,
				y: stepData.translatedClick.y,
				objID: stepData.id,
				currentTab: stepData.currTab
			};
			
			XhrController.xhrRequest(XhrUris.cmd(this.action_.cmdClass,this.action_.cmdKey,args),{
				method: "POST", 
				headers: {"Content-Type":"application/json"}
			}).then(function(response){
				self.currentStep_ = {
					step: response.resultType,
					response: response									
				};
				if(response.resultType !== "ILLEGAL_CLICK_PROCESSED") {
					require(["controllers/ClickWaitController"],function(ClickWaitController){
						ClickWaitController.uninstallClick(stepData.clickId,response);
					});
				}
				self._runAction(stepData);
			},function(err){
				if(err.status === "NEW_SESSION") {
					self._end();
					require(["controllers/ActionCollection"],function(ActionCollection){
						ActionCollection.CLIENT_WARN_RESTART_SESSION();
					});
				}
			});			
		},
		
		///////////////////////////
		// _buildAndShowStackPage
		///////////////////////////
		//
		// Given a server response which contains a stack page definition, build that page and display it 
		//
		_showStackPage: function() {
			var self=this;
			
			require(["controllers/ActionCollection"],function(ActionCollection){
				ActionCollection.CLIENT_SHOW_STACKPAGE(self.currentStep_.response.resultsMap.stackPage);
			});
		},
		
		//////////////////
		// _launchFrame
		//////////////////
		//
		// Given a server response which contains a frame definition, build that frame and display it
		//
		_launchFrame: function(stepData) {
			var self=this;
			if(!stepData || !stepData.frame) {
				console.error("[ERROR] Frame information was not provided!");
				return;
			}
			require(["controllers/WindowController"],function(WindowController){
				WindowController.openWindow({
					id: stepData.frame.id, uri: stepData.frame.uri, title: stepData.frame.title, 
					failoverType: stepData.frame.failOver, controllerName: stepData.frame.controller,
					dimensions: { h: stepData.frame.h, w: stepData.frame.w }
				}).then(function(){
					self.currentStep_.response.clientMode = stepData.frame.clientMode;
					WindowController.sendCmdToWindow(stepData.frame.id,stepData.frame.postOpen,self.currentStep_.response);
					self.currentStep_.step = self.postFrameStep_;
					self.currentStep_.response = null;
					self._runAction(stepData);
				});
			});
		},
		
		/////////////////////////
		// _buildAndShowDialog
		////////////////////////
		//
		//
		// Given a dialog type, uses a dialog definition to construct and show the dialog
		// The dialog definition can be stored in the currentStep_.response or obtained from the
		// DialogFactory 
		//
		_buildAndShowDialog: function(dialogType,msg,nextStep) {
			var self=this;
			dialogType = dialogType || this.currentStep_.response.resultsMap.dialog.dialogType;
			switch(dialogType) {
				case "PLAIN":
					require(["views"],function(BTViews){
						BTViews.updateViewStates(self.currentStep_.response.resultsMap);
					});
					
					if(!self.currentDialog_) {
						require(["dialogs/DialogFactory"],function(DialogFactory){
							var offsetIncrement = actionCounts[self.action_.cmdClass + "_" + self.action_.cmdKey] * 15;
							self.currentDialog_ = DialogFactory.buildDialog({
								type: self.action_.cmdKey,
								actionId: self.actionId_,
								definition: self.currentStep_.response.resultsMap.dialog,
								offset: {x: -10+(offsetIncrement),y: -10+(offsetIncrement)},
								isModal: true
							});
			
							self.currentDialog_.show();
							self.currentStep_.step = self.postDialogStep_;
							self.currentStep_.response = null;
						});
					} else {
						self.currentStep_.step = self.postDialogStep_;
						self.currentStep_.response = null;
					}
		
					break;
				case "YES_NO_OPTION":
				case "ERROR":
				case "WARNING":
					require(["views"],function(BTViews){
						BTViews.updateViewStates(self.currentStep_.response.resultsMap);
					});	
					
					require(["dialogs/DialogFactory"],function(DialogFactory){
						var errorDialog;
						if(!self.currentStep_.response.resultsMap.dialog) {
							errorDialog = DialogFactory.makeBasicErrorDialog({title: "Error",content: msg || TxtMsgs.GENERIC_ERROR});
						} else {
							errorDialog = DialogFactory.buildDialog({
								type: dialogType,
								definition: self.currentStep_.response.resultsMap.dialog,
								offset: {x: -10,y: -10},
								isModal: true
							});
						}
						
						errorDialog.show();
						self.currentStep_.step = nextStep || self.postDialogStep_ || "SEND_DIALOG_RESULT";
						self.currentStep_.response = null;
					});
					break;
				default:
					console.error("[ERROR] Did not recognize the dialog type '" + dialogType +"'");
			}
		},
		
		/////////////////////////////////
		// _parseDialogResult
		/////////////////////////////////
		//
		// Use the provided results bundler to parse the dialog's form(s), then parse the SUCCESS step
		//
		_parseDialogResult: function(stepData) {
			
			this._resultsBundler(stepData);
			
			this.currentStep_.step = "SUCCESS";
			this._parseStep(stepData);
		},
		
		///////////////////////////////////
		// _sendDialogResult
		//////////////////////////////////
		//
		// Use the results bundler to parse the dialog's form(s), then send the results to the 
		// server and receive its response
		//
		_sendDialogResult: function(stepData) {
			var self=this;

			this._resultsBundler(stepData);
			
			var args = {currentTab: stepData.currTab};
			
			switch(stepData.dialogType) {
				case "YES_NO_CANCEL_OPTION":
				case "YES_NO_OPTION":
					args.formButton= stepData.buttonClicked;
					break;
				case "QUESTION":
				case "OPTION_OPTION":
					break;
				default:
					break;			
			}
			
			XhrController.xhrRequest(XhrUris.cmd(this.action_.cmdClass,this.action_.cmdKey,args),{
				data: JSON.stringify(stepData.userInputs),
				method: "POST", 
				headers: {"Content-Type":"application/json"}
			}).then(function(response){
				self.currentStep_ = {
					step: response.resultType,
					response: response									
				};
				stepData.dialogType = null;
				self._runAction(stepData);
			},function(err){
				if(err.status === "NEW_SESSION") {
					self._end();
					require(["controllers/ActionCollection"],function(ActionCollection){
						ActionCollection.CLIENT_WARN_RESTART_SESSION();
					});
				}
			});	
			
		},
		
		
		///////////////////////////////////
		// _parseStep
		///////////////////////////////////
		//
		// 
		// Main action stepping function
		//
		_parseStep: function(stepData) {
			var self=this;
			switch(this.currentStep_.step) {
				case "XPLAT_DIALOG":
					this._buildAndShowDialog();
					break;				
				case "XPLAT_FRAME":
					this._launchFrame(stepData);
					break;
				case "STACK_PAGE":
					self.currentStep_.step = self.postDialogStep_;
					this._showStackPage();
					break;
				case "SEND_DIALOG_RESULT":
					this._sendDialogResult(stepData);
					break;
				case "SEND_CLICK_RESULT":
					this._sendClickResult(stepData);
					break;
				case "PARSE_DIALOG_RESULT":
					this._parseDialogResult(stepData);
					break;
				case "WAITING_FOR_CLICK":
					this._prepareClick(stepData);
					break;
				case "SUCCESS":
					require(["views"],function(BTViews){
						for(var i in self.resultsMap_) {
							stepData[self.resultsMap_[i]] = self.currentStep_.response.resultsMap[i];	
						}
						self.onSuccess_(stepData);
						if(self.currentStep_.response) {
							BTViews.updateViewStates(self.currentStep_.response.resultsMap);
						}
						
						self.currentStep_.step = stepData.forApply ? self.postDialogStep_ : self.postSuccessStep_;
						
						// END and CLOSE are processed immediately
						if(!stepData.forApply && (self.postSuccessStep_ === "END" || self.postSuccessStep_ === "CLOSE")) {
							self._end();
						}
					});
					break;
				case "CANCEL":
					this._cancel();
					break;
				case "CLOSE":
				case "END":
					this._end();				
					break;
				case "ILLEGAL_CLICK_PROCESSED":
					this._buildAndShowDialog("ERROR",TxtMsgs.BAD_CLICK,"SEND_CLICK_RESULT");
					break;					
				case "PROCESSING_ERROR":
				case "PARAMETER_ERROR":
					this._buildAndShowDialog("ERROR");		
					break;
				default:
					console.error("[ERROR] Reached default in _parseStep for '",this.currentStep_.step+"'");
					break;
			}
		},
		
		constructor: function(actionId) {
			this.actionId_ = actionId;
		}

	});
		
//////////////////////////////////////////////
// Module Interface
//////////////////////////////////////////////
	
	return {
		runAction: function(stepData) {
			// If an actionId was not provided, one will be generated
			var actionId = stepData.actionId ? 
				stepData.actionId : 
				(stepData.action.cmdClass + "_" + stepData.action.cmdKey + 
					(stepData.action.uniqueId ? "_"+stepData.action.uniqueId : ""));
			
			// If this action doesn't already exist, make one
			if(!ActionControllers[actionId]) {
				ActionControllers[actionId] = new ActionController(actionId);
			} 
			// Run the action
			// If it already exists under this Id, it's behavior will depend on the action and its current
			// state
			ActionControllers[actionId]._runAction(stepData);
		},
		end: function(action) {
			ActionControllers[action]._end();
			ActionControllers[action] = null;
		},
		cancel: function(action) {
			ActionControllers[action]._cancel();
			ActionControllers[action] = null;
		}
	};

});
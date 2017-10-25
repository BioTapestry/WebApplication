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
    "static/XhrUris",
    "controllers/XhrController"
],function(
	XhrUris,
	XhrController
) {

	var dialogStack = null;
	var currentStep_ = null;
	var currTab_ = null;
	
	
	function _sessionRestart(e) {
		dialogStack = null;
		_endPendingClick((e && e.resultsMap ? e.resultsMap.XPlatCurrentState : null));
		currentStep_ = null;
		require(["controllers/ActionCollection"],function(ActionCollection){
			ActionCollection.CLIENT_WARN_RESTART_SESSION();
		});		
	};
	
	function _drawGene(stepData) {
		if(!currentStep_) {
			currTab_ = stepData.currentTab;
			XhrController.xhrRequest(XhrUris.cmd("MAIN","ADD",{currentTab: currTab_})).then(function(response){
				if(response.reply) {
					alert(response.reply);
					return;
				} else {
					currentStep_ = {
						step: response.resultType,
						response: response
					};
					dialogStack = new Array();
					_parseStep(stepData);
				}
			},function(err){
				if(err.status === "NEW_SESSION") {
					_sessionRestart(err);
				}
			});
		} else {
			_parseStep(stepData);
		}		
	};
	
	function _cancelAdd(clientInitiated) {
		_endPendingClick();
		if(clientInitiated) {
			XhrController.xhrRequest(XhrUris.cmd("MAIN","CANCEL_ADD_MODE",{currentTab: currTab_})).then(function(response){
				if(response.resultType === "SUCCESS") {
					currentStep_ = null;
					dialogStack = null;
				} else {
					alert("Cancel failed!");
				}
			},function(err){
				if(err.status === "NEW_SESSION") {
					_sessionRestart(err);
				}
			});
		} else {
			currentStep_ = null;
			dialogStack = null;
		}
	};	
	
	function _drawErrorOnPendingClick() {
		require(["views","views/BioTapestryCanvas"],function(BTViews,BTCanvas){
			BTCanvas.drawClickError(BTViews.getCurrentTab().cnvContainerNodeId_);
		});
	};
	
	function _redrawPendingClick() {
		require(["views","views/BioTapestryCanvas"],function(BTViews,BTCanvas){
			BTCanvas.drawClickPending(BTViews.getCurrentTab().cnvContainerNodeId_);
		});		
	};
	
	function _endPendingClick(masks) {
		require(["controllers/ClickWaitController"],function(ClickWaitController){
			ClickWaitController.uninstallClick("clickToAddGene",masks);
		});
	}
	
	function _prepareClick(masks) {
		require(["views","controllers/ClickWaitController"],function(BTViews,ClickWaitController){
			var creationClick = function(e){
				require(["views/BioTapestryCanvas"],function(BTCanvas){
					var translatedClick = BTCanvas.translateHit({x: e.clientX, y: e.clientY},BTViews.getCurrentTab().cnvContainerNodeId_);
					translatedClick.x = Math.round(translatedClick.x);
					translatedClick.y = Math.round(translatedClick.y);
					translatedClick.currentTab = currTab_;
					XhrController.xhrRequest(XhrUris.cmd("MAIN","ADD",translatedClick)).then(function(response){
						currentStep_ = {
							step: response.resultType,
							response: response									
						};
						_drawGene();
					},function(err){
						if(err.status === "NEW_SESSION") {
							_sessionRestart(err);
						} else {
							console.error("[ERROR] " + err.msg);
							_cancelAdd(true);
						}
					});					
				});
			};
			
			ClickWaitController.installClick({
				canvasId: BTViews.getCurrentTab().cnvContainerNodeId_,
				clickId: "clickToAddGene",
				masks: masks,
				type: "DRAW",
				callback: creationClick
			});
		});
	};
	
	function _buildAndShowDialog(stepData) {
		switch(currentStep_.response.resultsMap.dialog.dialogType) {
			case "PLAIN":
				require(["views"],function(BTViews){
					BTViews.updateViewStates(currentStep_.response.resultsMap);
				});
								
				require(["dialogs/DialogFactory"],function(DialogFactory){
					dialogStack.push(DialogFactory.buildDialog({
						type: currentStep_.response.resultsMap.dialog.dialogType,
						definition: currentStep_.response.resultsMap.dialog,
						offset: {x: -10,y: -10},
						isModal: true,
						tabId: stepData.currentTab
					}));
	
					dialogStack[dialogStack.length-1].show();
					currentStep_.step = "SEND_DIALOG_RESULT";
					currentStep_.response = null;
				});
	
				break;
			case "ERROR":
				require(["views"],function(BTViews){
					BTViews.updateViewStates(currentStep_.response.resultsMap);
				});	
				
				require(["dialogs/DialogFactory"],function(DialogFactory){
					var errorDialog = DialogFactory.buildDialog({
						type: currentStep_.response.resultsMap.dialog.dialogType,
						definition: currentStep_.response.resultsMap.dialog,
						offset: {x: -10,y: -10},
						isModal: true
					});
					
					errorDialog.show();
				});
				currentStep_.step = "SEND_DIALOG_RESULT";
				currentStep_.response = null;					
				break;
		}			
	};
	
	function _sendDialogResult(stepData) {
		
		for(var i in stepData.bundleMap) {
			stepData.userInputs[i] = stepData.form[stepData.bundleMap[i]] == undefined ? null : stepData.form[stepData.bundleMap[i]];
		}		
		XhrController.xhrRequest(
			XhrUris.cmd("MAIN","ADD",{currentTab: currTab_}),
			{data: JSON.stringify(stepData.userInputs),method: "POST", headers: {"Content-Type":"application/json"}}
		).then(function(response){
			currentStep_ = {
				step: response.resultType,
				response: response									
			};
			_drawGene();
		},function(err){
			if(err.status === "NEW_SESSION") {
				_sessionRestart(err);
			}
		});
	};
	
	function _parseStep(stepData) {
		switch(currentStep_.step) {
			case "XPLAT_DIALOG":
				_buildAndShowDialog(stepData);
				break;
			case "SEND_DIALOG_RESULT":
				_sendDialogResult(stepData);
				break;
			case "WAITING_FOR_CLICK":
				var dialog = dialogStack.pop();
				dialog && dialog.hide();
				_prepareClick();
				break;
			case "SUCCESS":
				require(["controllers/ActionCollection","views"],function(ActionCollection,BTViews){
					_endPendingClick(currentStep_.response.resultsMap.XPlatMaskingStatus);
					ActionCollection.CLIENT_EXPIRE_RELOAD_CURR({modelId: stepData.modelId});
					BTViews.updateViewStates(currentStep_.response.resultsMap);
				},function(err){
					
				});					
				currentStep_ = null;
				break;
			case "CANCEL_ADD":
				_cancelAdd(true);
				break;
			case "PROCESSING_ERROR":
				_cancelAdd();
				break;
			case "ILLEGAL_CLICK_PROCESSED":
			case "PARAMETER_ERROR":
				_drawErrorOnPendingClick();
				setTimeout(function(){
					currentStep_.step = "WAITING_FOR_CLICK";
					_redrawPendingClick();
				},1750);
				break;
			default:
				console.debug("Reached default in switch: ",currentStep_);
				break;
		}
	};
	
	
	return {
		cancelAdd: function() {
			_cancelAdd(true);
		},
		
		
		drawGene: function(stepData) {
			_drawGene(stepData);
		}
	};
});
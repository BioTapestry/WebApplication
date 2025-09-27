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
    "dojo/dom",
    "dojo/on",
    "dojo/sniff",
    "dijit/Dialog",
    "dojo/Deferred",
	"dojo/domReady!"
],function(
	dom,
	on,
	sniff,
	Dialog,
	Deferred
){
			
	// Internet Explorer 8-10 support postMessage to a new window/tab only sporadically, and in IE11 not at all. 
	// To get around this, we check for the Trident engine, and immediately revert to dialogs.
	var isTrident = sniff("trident");
		
	on(window,"message",function(e){
		if(window.location.origin !== e.origin) {
			throw new Error("[ERROR] Origin mismatch in message! This might be an attack!");
		} else {
			if(e.data.cmd) {
				require(["controllers/ActionCollection"],function(ActionCollection){
					ActionCollection[e.data.cmd](e.data.args);
				});
			}
		}
	});
	
	var frameController;
	
	var windows_ = {};
			
	var popupsBlocked = new Boolean(false);
	
	var loadAsync = null;
	
	var lastLoadedPosition_ = {
		t: 50,
		l: 100
	};
	
	var defaultWindowDimensions_ = {
		w: 1000,
		h: 800
	};
	
	var userScreen = {
		h: window.screen.availHeight,
		w: window.screen.availWidth
	};
	
	var colCount = 0;
	var rowCount = 0;
	
	function _closeWindow(id) {
		if(windows_[id] && windows_[id].window) {
			if(windows_[id].isDialog) {
				windows_[id].window.hide().then(function(){
					windows_[id] && windows_[id].window && windows_[id].window.destroyRecursive(); 
				});
			} else {
				windows_[id].window.close();
			}
		}
		windows_[id] && delete windows_[id].window;
		delete windows_[id];
		
		if(Object.keys(windows_).length <= 0) {
			// reset the 'lastLoadedPosition_' variable if all of our dialogs are closed
			lastLoadedPosition_ = {
				t: 50,
				l: 100
			};
		}
	}
	
	function buildWindowParams_(dimensions) {
		if(dimensions) {
			return "height=" + dimensions.h 
			+ ",width=" + dimensions.w 
			+ ",left=" + lastLoadedPosition_.l
			+ ",top=" + lastLoadedPosition_.t;
		}
		return "height=" + defaultWindowDimensions_.h 
			+ ",width=" + defaultWindowDimensions_.w 
			+ ",left=" + lastLoadedPosition_.l
			+ ",top=" + lastLoadedPosition_.t;
	};
	
	function buildDialogParams_() {
		return {x: lastLoadedPosition_.l,y: lastLoadedPosition_.t};
	};
	
	function calcNextLoadPositions_() {
		if(lastLoadedPosition_.l+20 > (userScreen.w-defaultWindowDimensions_.w)) {
			rowCount++;
			lastLoadedPosition_.t = 100 + (20*rowCount);
			lastLoadedPosition_.l = 100;
		} else {
			lastLoadedPosition_.l += 20;
		}
		if(lastLoadedPosition_.t+20 > (userScreen.h-defaultWindowDimensions_.h-50)) {
			colCount++;
			lastLoadedPosition_.t = 100;
			lastLoadedPosition_.l = 100 + (20*colCount);
		} else {
			lastLoadedPosition_.t += 20;
		}		
	};
		
	
	//////////////////////////////////////////
	// loadWindow_
	/////////////////////////////////////////
	//
	// Note: IE does not allow postMessage between windows, only between embedded frames.
	// IE is currently set to always failover to dialog
	//
	function loadWindow_(params) {
		
		var load = new Deferred();
				
		if(!windows_[params.id] || (windows_[params.id].window && windows_[params.id].window.closed)) {
			windows_[params.id] = {};
			windows_[params.id].isDialog = false;
			if(isTrident || (params.id.indexOf("expdata") >= 0)) {
				popupsBlocked = new Boolean(true);
				load.resolve();
			} else {			
				windows_[params.id].window = window.open(params.uri,"_blank",buildWindowParams_(params.dimensions));
				calcNextLoadPositions_();
				if (!windows_[params.id].window) {
					popupsBlocked = new Boolean(true);
					load.resolve();
				} else {
					windows_[params.id].window.onload = function(e) {
						setTimeout(function() {
							if (windows_[params.id].window.outerWidth === 0) {
								popupsBlocked = new Boolean(true);
							} else {
								popupsBlocked = new Boolean(false);
							}
							load.resolve();
						}, 1000);
					};
				}
			}
		} else {
			load.resolve();
		}

		return load.promise;
	};
	
	function loadWindowAsDialog_(id,uri,title,type,windowCtrl) {
		var load = new Deferred();
		if(!isTrident && (id.indexOf("expdata") < 0)) {
			console.warn("Popups appear to be blocked in your browser! Reverting to dialogs...");	
		}
		if(!windows_[id] || !windows_[id].window) {
		    require(["dialogs/DialogFactory"],function(DialogFactory){
			    windows_[id].isDialog = true;
				windows_[id].window = DialogFactory.makeFailoverDialog({
					id: id,
					isModal: false,
					title: title,
					defName: type + "_" + id,
					type: type,
					frameController: frameController,
					offset: buildDialogParams_(),
					withErrorMsg: !isTrident &&  (id.indexOf("expdata") < 0),
					onCancel: function() {windowCtrl.closeWindow(id);}
				});
				calcNextLoadPositions_();
				require([frameController],function(controller){
					var uriBase = window.location.href;
					// Do not let any additional text on the window's URI (could be from iframe loading, etc.) 
					// get placed onto our URI Base!
					if(uriBase.indexOf("?")>= 0) {
						uriBase = window.location.href.substring(0,uriBase.indexOf("?"));
					}
				});
				if(windows_[id].window.showImmediately) {
					windows_[id].window.show();	
				}
				load.resolve();
		    });
		} else {
			load.resolve();
		}
		return load.promise;
	};
	
//////////////////////////////////////////
// Module Interface
//////////////////////////////////////////
		
	return {
				
		openWindow: function(params) {
			var self=this;
			frameController = params.controllerName;
			loadAsync = new Deferred();
			loadWindow_(params).then(function(){
				if(popupsBlocked.valueOf() === true) {
					loadWindowAsDialog_(params.id,params.uri,params.title,params.failoverType,self).then(function(){
						loadAsync.resolve();
					});
				} else {
					windows_[params.id] && windows_[params.id].window 
						&& windows_[params.id].window.postMessage({cmd: "SET_ONCLOSE", args: {id: params.id}},window.location.origin);
					if(params.title) {
						windows_[params.id] && windows_[params.id].window 
							&& windows_[params.id].window.postMessage({cmd: "SET_TITLE", args: {title: params.title}},window.location.origin);
					}
					loadAsync.resolve();
				}
				
			},function(err){
				console.error("[ERROR] " + err);
			});
			return loadAsync.promise;
		},
		
		closeWindow: function(id) {
			_closeWindow(id);
		},
		
		sendCmdToWindow: function(id,cmd,args) {
			if(windows_[id] && windows_[id].window) {
				if(!args) {
					args = {};
				}
				args.id = id;
				if(windows_[id].isDialog) {
					args.dialogDomNode = windows_[id].window.domNode;
					args.dialog = windows_[id].window;
					windows_[id].window.exec(cmd,args);
				} else {
					windows_[id] && windows_[id].window && windows_[id].window.postMessage({cmd: cmd, args: args},window.location.origin);	
				}
			}
		}
	};

});
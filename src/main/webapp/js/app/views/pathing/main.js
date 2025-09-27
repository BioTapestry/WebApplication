
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

//////////////////////////////////////////
// views/pathing/main
////////////////////////////////////////
//

define([
    "dojo/request",
	"dojo/Deferred",
	"dijit/layout/BorderContainer",
	"dijit/layout/ContentPane",
	"dojo/on",
    "dojo/dom",  
	"app/utils",
	"dojo/_base/array",
	"dojo/domReady!"
],function(
	request,
	Deferred,
	BorderContainer,
	ContentPane,
	on,
	dom,
	utils,
	DojoArray
) {
	
	var CANVAS_CONTAINER_NODE_ID = "path";
	var CANVAS_WRAPPER_NODE_ID = "pathWrapper";
	
	// This will be the primary container of our application.
	var pathingPane = new BorderContainer({
		id: "pathing_container"
	});
	    	
	
	var loadAsync = null;
	
	var loadScreen = null;
	
	return {	
		loadView: function(loadingOverlay) {
			
			loadScreen = loadingOverlay;
						
			if(!loadAsync) {
				loadAsync = new Deferred();

		        on(window,"message",function(e){
		    		if(window.location.origin !== e.origin) {
		    			throw new Error("[ERROR] Origin mismatch in message! This might be an attack!");
		    		} else {		        	
			        	require(["controllers/pathing/PathingController"],function(BioTapPathController){
			        		BioTapPathController[e.data.cmd](e.data.args,e.source);
			        	});
		    		}
		        });
		        
		        loadAsync.resolve();
			}
			return loadAsync.promise;
		},
		getAppCanvasContainerNodeId: function() {
			return CANVAS_CONTAINER_NODE_ID;
		},
		
		getAppCanvasWrapperNodeId: function() {
			return CANVAS_WRAPPER_NODE_ID;
		},
		
		finishLoad: function(builtFrame) {
			if(builtFrame.type !== "PATH_DISPLAY") {
				builtFrame.region = "center";
				if(pathingPane.getChildren().length > 0) {
					DojoArray.forEach(pathingPane.getChildren(),function(child){
						if(child.region === "center") {
							if(child.id !== builtFrame.id) {
								pathingPane.removeChild(child);
								pathingPane.addChild(builtFrame);
							}
						}
					});
				} else {
					pathingPane.addChild(builtFrame);
				}
				if(!builtFrame.isReload) {
					document.body.appendChild(pathingPane.domNode);	
				}
				pathingPane.startup();
				builtFrame.emit("built",{bubbles: true, cancelable: true});
			} else {
				var deferred = builtFrame.show();
				if(deferred) {
					deferred.then(function(){
						builtFrame.emit("built",{bubbles: true, cancelable: true});
					});
				} else {
					builtFrame.emit("built",{bubbles: true, cancelable: true});
				}
			}

			if(loadScreen) {
				loadScreen.endLoading();
				loadScreen = null;
			}			
		}
	};
});
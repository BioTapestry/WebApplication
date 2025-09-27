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

////////////////////////////////
// app/main
///////////////////////////////
//


define([
	"dojo/dom-construct",
	"static/ErrorMessages",
	"controllers/XhrController",
	"static/XhrUris",
	"./LoadingOverlay",
	"dojo/domReady!"
],function(
	domConstruct,
	errorMsgs,
	XhrController,
	XhrUris,
	LoadingOverlay
) {
	
	var location = window.location.href.match(/pathing|expdata|perturb/g);

	if(location && location.length > 0) {
		return null;
	}
	
	// Default to viewer mode unless the server tells us otherwise
	var CLIENT_MODE = "VIEWER";
	
	// Start up our loading screen
	var loading = new LoadingOverlay("loadingOverlay");
	
	try {
		
		// Are we in compatibility mode? If so, nothing is going
		// to work!		
		var canLoad = true;
		var errorMessage = "";
		
		if(document.documentMode && document.documentMode < 8) {
			canLoad = false;
			errorMessage = errorMsgs.comp_view;
		} 
		
		// Don't bother checking for Canvas element if we're in Compatibility View
		if(canLoad) {
			
			// Does this browser support Canvas? Let's find out!
			var canvasSupported = true;
			var test = domConstruct.create("canvas");
			canvasSupported = !!test.getContext;
			
			// Even if Canvas is supported, Canvas text might not be, and we need that too
			if(canvasSupported) {
				var test_context = test.getContext('2d');
				canvasSupported = (test_context && typeof test_context.fillText == 'function');
			}
					
			if(!canvasSupported) {
				canLoad = false;
				errorMessage = errorMsgs.no_canvas;
			}	
		}
		
		if(!canLoad) {
			domConstruct.create("div",{
				id: "error",		
				innerHTML: "<div id=\"header_pane\"><span>Error Loading BioTapestry Web Client</span></div>" + errorMessage
			},document.body);
			loading.endLoading();
			return;
		}
		
		// If we made it this far, we can now load the interface
						
		XhrController.xhrRequest(XhrUris.init).then(function(response){
			if(!(response.result === "SESSION_READY")) {
				throw new Error("Session did not return ready!");
			}
			
			CLIENT_MODE = response.clientMode.toUpperCase();
			require(["models/conditions/ActionConditions","views","models/ClientState"],function(ActionConditions,BTViews,ClientState){
				// Set down the client mode in the Action Conditions model so relevant Actions will be 
				// enabled/disabled
				ActionConditions.set(CLIENT_MODE.toUpperCase(),true);
				
				ClientState.defineStateObject(response.stateObject);
				
				// Load the UI and close the overlay
				BTViews.loadBioTapestry(response).then(function() {
					//Close the loading overlay
					loading.endLoading();
					
				},function(err){
					require(["dojo/dom"],function(dom){
						domConstruct.destroy(dom.byId("app_container"));
						domConstruct.create("div",{
							id: "error",		
							innerHTML: "<div id=\"header_pane\"><span>Error Loading BioTapestry Web Client</span></div>" 
								+ errorMsgs[err.type] + (err.msg ? "<p>" + err.msg + "</p>" : "")
						},document.body);
						loading.endLoading();					
					});
				});	
			});
		},function(err) {
			console.error(err);
			domConstruct.create("div",{
				id: "error",		
				innerHTML: "<div id=\"header_pane\"><span>Error Loading BioTapestry Web Client</span></div>" + errorMsgs.initFailed
			},document.body);	
			loading.endLoading();
		});	
	} catch(e) {
		console.error("Failed to start up BioTapestry Web: ");
		console.error(e);
		domConstruct.create("div",{
			id: "error",		
			innerHTML: "<div id=\"header_pane\"><span>Error Loading BioTapestry Web Client</span></div><p>Failed to start up BioTapestry Web:</p><p>" +
				e + "</p>"
		},document.body);
		loading.endLoading();
	}
	
	return {
		getClientMode: function() {
			return CLIENT_MODE;
		}
	};
});





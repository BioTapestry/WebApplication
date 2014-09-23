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

///////////////////////////////
// pathing/main
///////////////////////////////
//

define([
	"views/pathing/main",
	"static/XhrUris",
	"app/LoadingOverlay",
	"dojo/domReady!"
],function(
	PathingViews,
	XhrUris,
	LoadingOverlay
) {
		
	try {	
		// Application-startup specific things would go here
		
		// Start up our loading screen
		var loading = new LoadingOverlay("pathingLoadingOverlay");
		
		var location = window.location.href.match(/pathing/g);
		
		if(!location) {
			throw new Error("Cannot run the pathing window from a non-pathing URI! Location is: " + window.location.href);
		}
				
		XhrUris.setFullServletPath(window.location.href);
		XhrUris.setServletBaseToFullPath();
	
		// Load the interface
		PathingViews.loadView(loading);
	} catch(e) {
		console.error("Failed to start up Pathing Viewer: ");
		console.error(e);
	}	
});
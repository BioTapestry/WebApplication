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
// perturb/main
///////////////////////////////
//

define([
	"require",
	"views/perturb/main",
	"app/LoadingOverlay",
	"dojo/domReady!"
],function(
	require,
	PerturbViews,
	LoadingOverlay
) {
	
	/**
	 * 
	 * 
	 */ 
	
	try {
		// Application-startup specific things would go here
		
		// Start up our loading screen
		var loading = new LoadingOverlay("perturbLoadingOverlay");
	
		// Load the interface
		PerturbViews.loadView().then(function() {
			// Close the loading overlay
			loading.endLoading();
		});
	} catch(e) {
		console.error("Failed to start up Perturbation Data Viewer: ");
		console.error(e);
	}
	
});
///////////////////////////////
// expdata/main
///////////////////////////////
//

define([
	"views/expdata/main",
	"app/LoadingOverlay",
	"dojo/router",
	"dojo/domReady!"
],function(
	ExpDataViews,
	LoadingOverlay,
	router
) {
	
	try {	
		
		// All Experimental Data is initially loaded as a dialog
		var autonomousWindow = false;
		
		// Load the Experimental Data based on a hash request
		var loadExpData = function(e){
			// If the hash was used, we know this is not an autonomous window
			autonomousWindow = true;
        	require(["controllers/ActionCollection"],function(ActionCollection){
        		ActionCollection.CLIENT_LOAD_EXP_DATA_WINDOW({
        			id: e.params.id,
        			cmdKey: e.params.cmdkey,
        			cmdClass: e.params.cmdclass,
        			name: ((e.params.name && e.params.name.indexOf("%") >= 0) ? decodeURIComponent(e.params.name) : e.params.name),
        			linkUri: e.params.linkuri,
        			segId: e.params.segid
    			});
        	});
		};
		
		// It's possible this experimental data module was loaded as part of a window
		// to allow separate display of the data. If this is the case, we need to
		// launch the ExpData modules from here
		var nodeHandler = router.register("/expd/:cmdclass/:cmdkey/:id/:name",loadExpData);
		var linkHandler = router.register("/expd/:cmdclass/:cmdkey/:id/:segid/:linkuri",loadExpData);
		
		router.startup();
				
		// Application-startup specific things would go here
		
		// Start up our loading screen
		var loading = new LoadingOverlay("expDataLoadingOverlay");
	
		// Load the interface
		ExpDataViews.loadView(autonomousWindow).then(function() {
			// If this isn't an autonomous window, we don't need those router
			// handlers
			if(!autonomousWindow) {
				nodeHandler.remove();
				linkHandler.remove();
			}
			// Close the loading overlay
			loading.endLoading();
		});
	} catch(e) {
		console.error("Failed to start up Experimental Data Viewer: " + e);
	}
	
});
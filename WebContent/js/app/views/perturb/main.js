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
// views/perturb/BioTapestryPerturb
////////////////////////////////////////
//


define([
	"require",
	"dojo/Deferred",
	"dijit/layout/BorderContainer",
	"dijit/layout/ContentPane",
	"dojo/on",
    "dojo/dom",
	"static/XhrUris",    
	"dojo/domReady!"
],function(
	require,
	Deferred,
	BorderContainer,
	ContentPane,
	on,
	dom,
	XhrUris
) {
		
	try {
		
	} catch(e) {
		console.error("Failed to build Perturbation Data Viewer: "+e);
	}
	
	return {
		loadView: function() {
			var loadAsync = new Deferred();
    	
	    	// This will be the primary container of our application.
	    	var perturbationPane = new BorderContainer({
	    		id: "perturb_container"
	    	});
			    	
	    	//////////////////////////////////
	    	// Top region pane setup
	    	/////////////////////////////////
	    	var topPane = new ContentPane({
	    		region: "top",
	    		id: "top_pane"
	    	});

	        var hdr = new ContentPane({
	        	id: "header_pane"
	        });
			        
			topPane.addChild(hdr);
			
			var leftPane = new ContentPane({
				region: "left",
				id: "left_pane"
			});
			
			var centerPane = new ContentPane({
				region: "center",
				id: "center_pane"
			});
			
			var bottomPane = new ContentPane({
				region: "bottom",
		    	id: "footer_pane",
				content: "<span id=\"footerlabel\">BioTapestry Perturbation Window</span>"
			});
			
			perturbationPane.addChild(topPane);
			perturbationPane.addChild(leftPane);
			perturbationPane.addChild(centerPane);
			perturbationPane.addChild(bottomPane);
			
	        document.body.appendChild(perturbationPane.domNode);
	        perturbationPane.startup(); 
			
			loadAsync.resolve();
			
			return loadAsync.promise;
		}
	};
});
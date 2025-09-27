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
// views/expdata/main
////////////////////////////////////////
//


define([
    "dojo/request",
	"dojo/Deferred",
	"dijit/layout/BorderContainer",
	"dijit/layout/ContentPane",
	"dojo/on",
    "dojo/dom",
	"static/XhrUris",    
	"dojo/domReady!"
],function(
	request,
	Deferred,
	BorderContainer,
	ContentPane,
	on,
	dom,
	XhrUris
) {
	
	var hdrPane;
	
	return {
		loadView: function(withoutMessage) {
						
			var loadAsync = new Deferred();
    	
	    	// This will be the primary container of our application.
	    	var expDataPane = new BorderContainer({
	    		id: "expdata_container"
	    	});
			    	
	    	//////////////////////////////////
	    	// Top region pane setup
	    	/////////////////////////////////
	    	var topPane = new ContentPane({
	    		region: "top",
	    		id: "top_pane"
	    	});

	        hdrPane = new ContentPane({
	        	id: "header_pane",
	        	style: "padding: 0px 0px 0px 10px;"
	        });
			        
			topPane.addChild(hdrPane);
			
			var centerPane = new ContentPane({
				region: "center",
				id: "center_pane",
				content: "<span class=\"bigLoading\">Loading...</span>"
			});
			
			expDataPane.addChild(topPane);
			expDataPane.addChild(centerPane);
			
	        document.body.appendChild(expDataPane.domNode);
	        expDataPane.startup(); 
	        
	        if(!withoutMessage) {
	        	topPane.own(on(window,"message",function(e){
		        	require(["controllers/expdata/ExpDataController"],function(BioTapEdController){
		        		BioTapEdController[e.data.cmd](e.data.args);
		        	});
		        }));
	        }
	        			
			loadAsync.resolve();
			
			return loadAsync.promise;
		},
		
		setHeaderText: function(hdrText) {
			hdrPane.set("content",hdrText);
		}
	};
});
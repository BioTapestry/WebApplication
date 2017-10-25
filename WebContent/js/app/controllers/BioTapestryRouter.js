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
    "dojo/router",
    "dojo/_base/array"
],function(router,DojoArray){
	
	
	function parseModel(e) {
		console.debug("model:",e.params);
	};
	
	function parsePath(e) {
		console.debug("path:",e.params);
	};
	
	var handles = [];
	
	handles.push(router.register("/model/:id",parseModel));
	handles.push(router.register("/model/:id/overlay/:overlay/:module/:intensity",parseModel));
	handles.push(router.register("/model/:id/overlay/:overlay",parseModel));
	handles.push(router.register("/model/:id/overlay/:overlay/:module",parseModel));
	handles.push(router.register("/userpath/:id/:step",parsePath));
	handles.push(router.register("/userpath/:id",parsePath));
	
	router.startup();
	
	return {
		goTo: function(hashUri,withEvent) {
			router.go(hashUri);
		},
		unregisterAll: function() {
			DojoArray.forEach(handles,function(handle){
				handle.remove();
			});
		},
		registerHash: function(hash,callback) {
			handles.push(router.register(hash,callback));
		}
	};
});
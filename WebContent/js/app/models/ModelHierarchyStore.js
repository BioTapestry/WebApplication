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
    "dojo/_base/declare",
    "dojo/store/Memory",
    "dojo/store/Observable",
    "dijit/tree/ObjectStoreModel",
    "controllers/XhrController",
    "dojo/Deferred",
    "static/XhrUris"
],function(
	declare,
	Memory,
	Observable,
	ObjectStoreModel,
	XhrController,
	Deferred,
	XhrUris
){
	
	return declare([],{
		
		_treeModel: null,
		getModel: function() {
			return this._treeModel;
		},
	
		_treeStore: null,
		
		loadTreeData: function() {
			var self=this;
			var loadAsync = new Deferred();
			XhrController.xhrRequest(XhrUris.modeltree).then(function(data) {
				self._treeStore = new Memory({
					data: [{ID: "root", childNodes: data.root.childNodes}],
			        getChildren: function(object){
			        	return(object.childNodes || []);
			        },
			        getIdentity: function(item) {
			        	return item.ID;
			        }
				});
				
				self._treeStore = new Observable(self._treeStore);					
        		require(["controllers/GrnModelController"],function(GrnModelController){
        			GrnModelController.setFullBounds(data.allModelBounds);
        			GrnModelController.set("initialZoomMode_",data.firstZoomMode);
        			GrnModelController.set("navZoomMode_",data.navZoomMode);
        			GrnModelController.buildModels(
    					data.root.childNodes
    					,"root"
    					,{hasImages:data.hasImages,hasOverlays:data.hasOverlays,timeSliderDef: data.timeSliderDef}
					);
        		});
        		
        		self._treeModel = new ObjectStoreModel({
    				store: self._treeStore,
    		        query: {ID: 'root'},
    		        mayHaveChildren: function(item) {
    		        	return (item.childNodes && item.childNodes.length > 0);
    		        }
    		    });	
        		loadAsync.resolve(self._treeModel);
        	});				
			
			return loadAsync.promise;
		},
		
		put: function(item,options) {
			item.ID = Math.random();
			if(!options.parent.childNodes) {
				options.parent.childNodes = new Array();
			}
			options.parent.childNodes.push(item);				
		},
		
		constructor: function() {
			// not a lot happening here
		}
	});
});
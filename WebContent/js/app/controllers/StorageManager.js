/*
**    Copyright (C) 2003-2016 Institute for Systems Biology 
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
    "dojo/on"
    ,"dojo/_base/array"
],function(
	on
	,DojoArray
) {
	
	var lStorage = window.localStorage;
	var sStorage = window.sessionStorage;
	
	var testing = "TESTING_STORAGE";
	
	try {
		lStorage.setItem(testing,"TEST_ITEM");
		sStorage.setItem(testing,"TEST_ITEM");
		
		lStorage.removeItem(testing);
		sStorage.removeItem(testing);
		
	} catch(e) {
		console.error("[ERROR] local/session storage is not currently available!");
		lStorage = null;
		sStorage = null;
	}
	
	var handler = null;
	
	function _makeHandler() {
		handler = on.pausable(window,"storage",function(e){
			var storedObj = JSON.parse(e.newValue);
			switch(e.key) {
				case "GOTO":
					require(["controllers/ActionCollection"],function(ActionCollection){
						ActionCollection.CLIENT_SET_MODEL(storedObj);
					});
					break;
				
				case "SELECT":
					console.debug(storedObj.msg);
					break;
					
				case "OVERLAY":
					console.debug(storedObj.msg);
					break;
					
				case "ZOOM":
					console.debug(storedObj.msg);
					break;
			}
			// Remove the stored item as soon as we've acted on its contents. If we don't do this, subsequent
			// stored values which are identical will fail to trigger the StorageEvent, which is an onChange
			lStorage.removeItem(e.key);
			sStorage.removeItem(e.key);
		});
	}
	
	function _clearMyStores() {
		DojoArray.forEach(["GOTO","SELECT","ZOOM","OVERLAY"],function(store){
			lStorage.removeItem(store);
			sStorage.removeItem(store);
		});
		
	};

	// If we can store, clear all previous stores and make a handler
	(lStorage !== null && sStorage !== null) && _clearMyStores();
	(lStorage !== null && sStorage !== null) && _makeHandler();
	
	return {
		canStore: function() {
			return (lStorage !== null && sStorage !== null);
		},
		
		writeToSession: function(key,val,withOverwrite) {
			if(!sStorage.getItem(key) || withOverwrite) {
				sStorage.setItem(key,val);
			}
		},
		
		writeToLocal: function(key,val,withOverwrite) {
			if(!lStorage.getItem(key) || withOverwrite) {
				lStorage.setItem(key,val);
			}			
		},
		
		getFromSession: function(key) {
			if(sStorage) {
				return sStorage.getItem(key);
			}
			console.error("[ERROR] Session storage is not available!");
			return null;
		},
		
		getFromLocal: function(key) {
			if(lStorage) {
				return lStorage.getItem(key);
			}
			console.error("[ERROR] Local storage is not available!");
			return null;
		},
		
		removeFromLocal: function(key) {
			lStorage && lStorage.removeItem(key);
		},
		
		removeFromSession: function(key) {
			sStorage && sStorage.removeItem(key);
		},
		
		pauseWatching: function() {
			handler && handler.pause();
		},
		
		stopWatching: function() {
			handler && handler.remove();
		},
		
		enableWatching: function() {
			hanlder && handler.resume();
			!handler && _makeHandler();
		}
	};
});
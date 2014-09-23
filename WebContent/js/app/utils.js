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

define([],function(){
	
	
	return {
		// Makes a random ID by selecting a string of 5 consecutive letters from a random
		// start point in a randomly constructed string, then attaching that to a Date.now()
		// with the first 5 digits replaced by those letters
		
		makeId: function() {
			var idBase = Math.random().toString(36).replace(/[^a-z]+/g,'');
			var start = Math.round(Math.random() * (idBase.length-5));
			return idBase.substring(start,start+5)+Date.now().toString().substring(5);
		},
		
		//////////////////
		// toTitleCase
		/////////////////
		//
		// Helper method for a regexp that title cases a string
		
		toTitleCase: function(str) {
		    return str.replace(/\w*/g, function(txt){return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();});
		},
		
		//////////////////////
		// _stringToBool
		/////////////////////
		//
		// Some widget parameters must be of type boolean, and not string. This helper converts 
		// all string instances of "true" and "false" to boolean equivalents.

		stringToBool: function(these) {
			for(var k in these) {
				if(these.hasOwnProperty(k)) {
					if(these[k] === "true") {
						these[k] = true;
					}
					if(these[k] === "false") {
						these[k] = false;
					}								
				}
			}		
		},
		
		objectPropertyCount: function(obj,countThese) {
			var found = 0;
			for(var i in obj) {
				if(obj.hasOwnProperty(i) && (!countThese || countThese[i])) {
					found++;
				}
			}
			return found;
		}
		
	};
});
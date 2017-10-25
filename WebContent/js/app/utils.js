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
    "dojo/dom-construct"
    ,"dojo/sniff"
    ,"dojo/dom-style"
    ,"dojo/dom"
],function(
	domConstruct
	,has
	,domStyle
	,dom
){	
	
	return {
		///////////
		// makeId
		///////////
		//
		// Makes a random ID by selecting a string of 5 consecutive letters from a random
		// start point in a randomly constructed string, then attaching that to a Date.now()
		// with the first 5 digits replaced by those letters
		//
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
		//
		toTitleCase: function(str) {
		    return str.replace(/\w*/g, function(txt){return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();});
		},
		
		//////////////////////
		// _stringToBool
		/////////////////////
		//
		// Some widget parameters must be of type boolean, and not string. This helper converts 
		// all string instances of "true" and "false" to boolean equivalents.
		//
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
		
		///////////////////////
		// calcScrollbarSize
		//////////////////////
		//
		//
		calcScrollbarSize: function(parentTo) {
			var testDiv = domConstruct.create("div",{
				style: "width: 75px; height: 75px; overflow: scroll; top: -7777px; position: absolute;"
			},(parentTo || "app_container"));
			
			var sbSize = (testDiv.offsetWidth - testDiv.clientWidth);
			
			domConstruct.destroy(testDiv);
			
			return sbSize;
		},
		
		isPlusEquals: function(code) {
			return (
				(navigator.language === "ja" && code === 222) 
				|| (navigator.language === "ja" && has("mozilla") && code === 160)
				|| ((has("mozilla") || has("opera")) && code === 61)
				|| ((has("ie") || has("trident") || has("webkit")) && code === 187)
				|| ((has("mac") && has("mozilla")) && code === 107)
			);
		},
		
		isMinusUs: function(code) {
			return (
				(has("mozilla") && code === 173)
				|| ((has("ie") || has("trident") || has("webkit")) && code === 189)
				|| (has("opera") && code === 45)
			);
		},
		
		showClickError: function(duration) {
			var cursor = domStyle.get(window.document.body,"cursor") || "default";
			domStyle.set(window.document.body,"cursor","not-allowed");
			setTimeout(function(){
				domStyle.set(window.document.body,"cursor",cursor);
			},duration || 1000);
		}
		
	};
});
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
    "dojo/_base/array"
],function(
	DojoArray
){

	var hitPriority = {
		"pad":0,
		"gene":2,
		"slash":2,
		"bare": 2,
		"linkage":1,
		"tablet":2,
		"intercell":2,
		"net_module_label": 0,
		"net_module_interior": 5,
		"net_module_boundary": 0,
		"box":2,
		"note": 1, 
		"group": 4
	};
	
	var MAX_PRIORITY = 5;
	
	
	
	return {
		getTopPriorityHit: function(hits,excludes,toggledGroups){
						
			if(hits.length === 1) {
				return hits[0];
			}
			
			var toggledHit;
			if(toggledGroups) {
				DojoArray.forEach(hits,function(hit){
					if(hit.getType()==="group" && toggledGroups[hit.id]) {
						toggledHit = hit;
					}
				});
			}
			
			if(toggledHit) {
				return toggledHit;
			}
			
			var priorities = {};
			for(var i=0; i <= MAX_PRIORITY; i++) {
				priorities[i] = [];
			}
			
			DojoArray.forEach(hits,function(hit){
				if(!excludes || !excludes[hit.getType()]) {
					
					priorities[hitPriority[hit.getType()+(hit.component ? "_"+hit.component : "")]].push(hit);
				}
			});
									
			var toCheck;
						
			var pLength = (Object.keys(priorities).length);
			for(var i=0; (i < pLength) && !toCheck; i++) {
				if(priorities[i].length > 0) {
					toCheck = priorities[i];
				}
			}
			
			if(!toCheck) {
				return null;
			}
						
			if(toCheck.length === 1) {
				return toCheck[0];
			} else {
				var sortedCheck = _.sortBy(toCheck,function(i){
					if(i.getType() === "group") {
						return (-i.getOrder());
					} else {
						return i.id;	
					}
				});
				return sortedCheck[0];
			}
		},
		
		getTopNoteHit: function(hits) {
			var notes = [];
			
			DojoArray.forEach(hits,function(hit){
				if(hit.getType() === "note") {
					notes.push(hit);
				} 
			});
			
			return notes[0];
		}
	};


});
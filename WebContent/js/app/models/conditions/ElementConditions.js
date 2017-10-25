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
    "dojo/Stateful",
    "dojo/_base/declare"
],function(
	Stateful,
	declare
) {
	
	var ConditionStates = declare([Stateful],{
		havePath: null,
		_havePathSetter: function(val) {
			this.havePath = val;
		},
		_havePathGetter: function() {
			return this.havePath;
		},
		
		neverAPath: null,
		_neverAPathSetter: function(val) {
			this.neverAPath = val;
		},
		_neverAPathGetter: function() {
			return this.neverAPath;
		},
		
		directSearch: null,
		_directSearchSetter: function(val) {
			this.directSearch = val;
		},
		_directSearchGetter: function() {
			return this.directSearch;
		},
		
		drawNew: null,
		_drawNewSetter: function(val) {
			this.drawNew = val;
		},
		_drawNewGetter: function() {
			return this.drawNew;
		},
		
		drawOld: null,
		_drawOldSetter: function(val) {
			this.drawOld = val;
		},
		_drawOldGetter: function() {
			return this.drawOld;
		},
		
		HAS_MODULE: null,
		_HAS_MODULESetter: function(val) {
			this.HAS_MODULE = val;
		},
		_HAS_MODULEGetter: function() {
			return this.HAS_MODULE;
		},
		
		isInteractive: null,
		_isInteractiveSetter: function(val) {
			this.isInteractive = val;
		},
		_isInteractiveGetter: function() {
			return this.isInteractive;
		},
				
		clear: function(condition) {
			this.set(condition,null);
		},
		
		constructor: function(states) {
			declare.safeMixin(this,states);
		}
	});
	
	// request initial states from the server goes here
	
	var BTElementConditions = new ConditionStates({
		HAS_MODULE: false
	});
	
	// Singleton
	return BTElementConditions;

});
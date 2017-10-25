/*
**    Copyright (C) 2003-2015 Institute for Systems Biology 
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
    "app/utils",
    "static/XhrUris",
    "controllers/XhrController",
    "controllers/ActionController",
    "controllers/ActionCollection"
],function(
	declare,
	utils,
	XhrUris,
	XhrController
) {
	
	var MAX_UNDO_DEPTH = 20;
	
	var UndoableAction = declare([],{
		_id: null,
		_cmdKey: null,
		_cmdClass: null,
		_settings: null,	
		
		constructor: function(params) {
			this._id = params.id || ("act_" + utils.makeId());
			this._settings = params.settings;
			this._cmdKey = params.cmdKey;
			this._cmdClass = params.cmdClass;
		}
	});
	
	// Set of actions which can be un- or re-done.
	var _actionSet = [];
	
	// Cursor for our undo/redo position
	var _currAct = 0;
	
	function addAction(thisAction) {
		// If we're capped on undos *and* not going to drop any off
		// do to cursor location, we need to delete one
		if(_actionSet.length >= MAX_UNDO_DEPTH && _currAct <= 0) {
			_actionSet.splice(-1,1);
		}
		if(_currAct > 0) {
			// if we're mid-set, adding a new action removes the ability to redo things we've undone
			// remove all of them from the array
			_actionSet.splice(0,_currAct);
		}
		_actionSet.push(thisAction);
		_currAct = 0;
	};
	
	function undoAct() {
		if(_currAct >= (_actionSet.length-1)) {
			return false;
		}
		// TODO: Undo!
		_currAct++;
	};
	
	function redoAct() {
		if(_currAct <= 0) {
			return false;
		}
		// TODO: Redo!
		_currAct--;
	};
	
	return {
		addUndo: function(thisAction) {
			addAction(new UndoableAction(thisAction));
		},
		undo: function(){
			undoAct();
		},
		redo: function(){
			redoAct();
		}
		
	};
});

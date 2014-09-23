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
	
	var _objectIsDefined = false;
	
	var subClasses = {};
	
	function ClientState(args) {
		for(var i in args) {
			if(args.hasOwnProperty(i) && this[i] !== undefined) {
				this[i] = args[i];
				if(subClasses[i] && this[i] instanceof Array) {
					for(var j in args[i]) {
						if(args[i].hasOwnProperty(j)) {
							this[i][j]["class"] = subClasses[i];		
						}
					}
				}
			}
			this["class"] = ClientState.prototype["class"];
		}
	}
	
	// Sets the properties expected in the client state object by the server
	function _buildStateObject(def) {
		for(var i in def) {
			if(def.hasOwnProperty(i)) {
				ClientState.prototype[i] = (i === "class" ? def[i] : null);
				if(def[i] instanceof Array && def[i].length > 0 && def[i][0]["class"]) {
					subClasses[i] = def[i][0]["class"];
				}
			}
		}
		_objectIsDefined = true;
	}
	
	
	return {
		defineStateObject: function(object) {
			if(!_objectIsDefined) {
				_buildStateObject(object);
			}
		},
		
		getNewStateObject: function(args) {
			if(_objectIsDefined) {
				return new ClientState(args);	
			}
			return null;
		}
	};

});
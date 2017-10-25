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
    "dojo/dom-construct",
	"dojo/_base/declare"
],function(
	domConstruct,
	declare
) {
	
	////////////////////////////////
	// TextMessage
	///////////////////////////////
	//
	// A simple module for adding text messages to widgets
	// TODO: turn into a proper Dojo Widget

	return declare([],{
		
		_messageNode: null,
				
		getNode: function() {
			return this._messageNode;
		},
		
		insertMessage: function(placeAt,placement) {
			domConstruct.place(
				this._messageNode,
				placeAt,
				placement
			);
		},
		
		constructor: function(params) {
						
			this._messageNode = domConstruct.create(
				"p",{innerHTML: params.content,id: params.id,"class":"TextMessage"}
			);
		}
	});
});
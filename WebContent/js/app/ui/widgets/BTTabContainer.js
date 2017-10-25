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

//////////////////////////////
// BTTabContainer
/////////////////////////////
//
// Extension of dijit/layout/TabContainer which hides or shows
// the tablist based on whether or not there are 1 or more tabs.
//
define([
	"app/utils",
	// Dojo dependencies
	"dojo/_base/declare",
	"dijit/layout/TabContainer",
	"dojo/dom-style"
],function(
	utils,
	// Dojo dependencies
	declare,
	TabContainer,
	domStyle
){

	return declare([TabContainer],{
		//////////////////
		// removeChild
		/////////////////
		//
		// Override to hide the tablist if removing thisChild reduces the
		// TabContainer's number of children to 1 or fewer.
		//
		removeChild: function (thisChild) {
			var index = thisChild.index;
			
			this.inherited(arguments);
			
			domStyle.set(this.tablist.domNode, "display", (this.getChildren().length > 1 ? "block" : "none"));
			domStyle.set(this.domNode, "border-top", (this.getChildren().length > 1 ? "" : "1px solid black"));
			
			this.resize();

			require(["views"],function(BTViews){
				BTViews.tabClosed(index);
			});

		},
			
		addChild: function (thisChild) {
			this.inherited(arguments);
			
			domStyle.set(this.tablist.domNode, "display", (this.getChildren().length > 1 ? "block" : "none"));
			domStyle.set(this.domNode, "border-top", (this.getChildren().length > 1 ? "" : "1px solid black"));
		}
	
	
	});
});
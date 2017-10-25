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
    "dojo/_base/declare"
    ,"dgrid/Grid"
    ,"dgrid/Keyboard"
    ,"dgrid/Selection"
    ,"dgrid/extensions/ColumnHider"
    ,"dgrid/extensions/DijitRegistry"
    ,"dgrid/extensions/ColumnResizer"
    ,"dijit/Destroyable"
],function(
	declare
	,Grid
	,Keyboard
	,Selection
	,ColumnHider
	,DijitRegistry
	,ColumnResizer
	,Destroyable
) {
	//////////////////////
	// BTSelectableGrid
	//////////////////////
	//
	// A pre-mixed dgrid for general use. Includes a 'disable' method which will
	// empty out the grid while it is disabled, a placeAt method to allow for use
	// with other layout dijits, and mixes in Keyboard, Selection, ColumnHider, and ColumnResizer.
	//
	// DijitRegistry is mixed in to register the grid, Destroyable is mixed in to make it track handles
	// and be destroyed.
	//
	// SPECIAL NOTE: dgrid's DijitRegistry does NOT implement own(), but Destroyable DOES implement destroy, which clobbers the DijitRegistry
	// destroy. Destroyable and DijitRegistry must **always** be mixed in this order, or Destroyable will supercede the DijitRegistry
	// methods and then destruction of grids will fail.
	
	var SelectableGrid = declare([ Grid, Keyboard, Selection, ColumnHider, Destroyable, DijitRegistry, ColumnResizer ], {
		disabled: false,
		disable: function(val) {
			this.disabled = val;
			if(val) {
				this.refresh();
				this.renderArray([]);
			}
		},
		placeAt: function(intoThis) {
			intoThis.addChild && intoThis.addChild(this);
		}
	});
	
	return SelectableGrid;
});
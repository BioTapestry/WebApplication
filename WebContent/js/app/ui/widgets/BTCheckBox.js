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
    "dojo/dom-construct",
	"dojo/_base/declare",
	"dijit/form/CheckBox"
],function(
	domConstruct,
	declare,
	CheckBox
) {
	
	///////////////////////
	// BTCheckBox
	//////////////////////
	//
	// An extension of dijit/form/Checkbox which will place a label when
	// it's placed

	return declare([CheckBox],{
		
		uiElementType: "CHECK_BOX",
							
		label: null,

		labelPlacement: null,
		
		labelNode: null,
		
		"class": "BTCheckBox",
		
		/////////////
		// destroy
		////////////
		//
		// 		
		destroy: function() {
			domConstruct.destroy(this.labelNode);
			this.labelNode = null;
			this.inherited(arguments);
		},
		
		///////////
		// remove
		//////////
		//
		// If we've been removed from the parent widget, we need to get rid of our label's
		// DOM node; it will be remade if the button is put back
		//
		remove: function() {
			domConstruct.destroy(this.labelNode);
			this.labelNode = null;			
		},
		
		_setLabelAttr: function(val) {
			this.label = val;
			if(this.labelNode) {
				this.labelNode.innerHTML = val;
			}
		},
		
		/////////////////////////
		// _placeCheckBoxLabel
		////////////////////////
		//
		// Method for placing a <label> on the same parentNode
		// as the checkbox's domNode
		_placeCheckBoxLabel: function() {
			
			// If the checkbox is being moved, we need to remove the old label 
			// and make a new one at the new location
			if(this.labelNode) {
				domConstruct.destroy(this.labelNode.id);
				this.labelNode = null;
			}
				
			this.labelNode = domConstruct.create(
				"label",
				{ 
					innerHTML: this.label,
					"class":"BTCheckBoxLabel",
					"for": this.id,
					id: this.id+"_label"
				},
				this.domNode,
				(this.labelPlacement ? this.labelPlacement : "after")
			);			
		},
		
		/////////////
		// startup
		////////////
		//
		// Once the checkbox is in place, add its label; this method is needed for
		// any BTCheckBox which isn't set down into the DOM via placeAt.
		//
		startup: function() {
			this.inherited(arguments);
			
			this._placeCheckBoxLabel();
		},		
		
		//////////////////////
		// placeAt
		/////////////////////
		//
		// Extend the method to place the checkbox label when this checkbox goes
		// onto the domNode
		//
		placeAt: function() {
			
			this.inherited(arguments);
						
			this._placeCheckBoxLabel();
		}
	});
});